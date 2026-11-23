import {requireValue} from '../../common/require-value';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {AGGREGATE_TABLES,PermanentOutboxError,validateEvent,retryDelayMs,failureCode,
 type EventEnvelope} from './outbox.domain';

type Claimed=EventEnvelope&{claimed_by:string;lease_until:Date|string};
export interface WorkerOptions {batchSize:number;leaseSeconds:number;maxAttempts:number;pollMs:number}
export const DEFAULT_WORKER:Readonly<WorkerOptions>={batchSize:1,leaseSeconds:45,maxAttempts:8,pollMs:1000};
export class OutboxWorker {
 readonly id=randomUUID();
 constructor(private readonly pool:Pool,private readonly options:WorkerOptions=DEFAULT_WORKER) {
  if(options.batchSize!==1||options.leaseSeconds<30||options.leaseSeconds>300||
   options.maxAttempts<1||options.maxAttempts>30||options.pollMs<50||options.pollMs>60000)
   throw new Error('INVALID_WORKER_CONFIG');
 }
 /** Claim exactly ONE event per tick. Sequential batches previously expired while awaiting earlier work.
  * Processing statement_timeout=10s is below the minimum 30s lease; after lease expiry
  * fenced updates cannot finalize an event for a stale owner. */
 async claim():Promise<Claimed[]> {
  const c=await this.pool.connect();
  let commitStarted=false,committed=false,broken=false;
  try {
   await c.query('BEGIN');
   await c.query("SET LOCAL statement_timeout='10000ms'");
   const r=await c.query<Claimed>(`WITH picked AS (
      SELECT e.id FROM outbox_events e WHERE e.published_at IS NULL AND e.failed_at IS NULL
       AND e.available_at<=clock_timestamp()
       AND (e.lease_until IS NULL OR e.lease_until<clock_timestamp())
       AND NOT EXISTS (SELECT 1 FROM outbox_events predecessor
         WHERE predecessor.tenant_id=e.tenant_id AND predecessor.aggregate_type=e.aggregate_type
          AND predecessor.aggregate_id=e.aggregate_id AND predecessor.id<>e.id
          AND predecessor.published_at IS NULL
          AND (predecessor.created_at,predecessor.id)<(e.created_at,e.id))
       ORDER BY e.available_at,e.created_at,e.id LIMIT $1 FOR UPDATE OF e SKIP LOCKED
     ) UPDATE outbox_events e SET claimed_by=$2::uuid,claim_started_at=clock_timestamp(),
      lease_until=clock_timestamp()+($3::int * interval '1 second'),attempts=e.attempts+1
      FROM picked WHERE e.id=picked.id RETURNING e.*`,
    [this.options.batchSize,this.id,this.options.leaseSeconds]);
   commitStarted=true;await c.query('COMMIT');committed=true;return r.rows;
  }catch(err){if(!commitStarted)try{await c.query('ROLLBACK');}catch{broken=true;}
   else broken=true;throw err;}
  finally{c.release(broken||(commitStarted&&!committed));}
 }
 /** Durable internal consumer: insert a unique receipt and mark processed in the SAME transaction. */
 async process(event:Claimed):Promise<'PROCESSED'|'LEASE_LOST'> {
  const c=await this.pool.connect();
  let commitStarted=false,committed=false,broken=false;
  try {
   await c.query('BEGIN');await c.query("SET LOCAL statement_timeout='10000ms'");
   const locked=await c.query<EventEnvelope>(`SELECT * FROM outbox_events
     WHERE id=$1 AND claimed_by=$2::uuid AND lease_until>clock_timestamp()
       AND published_at IS NULL AND failed_at IS NULL FOR UPDATE`,[event.id,this.id]);
   const current=locked.rows[0];
   if(!current){await c.query('ROLLBACK');return 'LEASE_LOST';}
   const related=validateEvent(current);
   const table=AGGREGATE_TABLES[current.aggregate_type];
   if(!table)throw new PermanentOutboxError('EVENT_AGGREGATE_UNSUPPORTED');
   // Existing composite tenant constraints + this query verify the actual aggregate's tenant.
   const check=current.aggregate_type==='MEMBERSHIP'
     ? 'SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2'
     :current.aggregate_type==='ORGANIZATION'
       ? 'SELECT 1 FROM organizations WHERE id=$1 AND id=$2'
       :`SELECT 1 FROM ${table} WHERE tenant_id=$1 AND id=$2`;
   const owner=await c.query(check,[current.tenant_id,current.aggregate_id]);
   if(!owner.rows.length)throw new PermanentOutboxError('EVENT_AGGREGATE_MISSING');
   if(related){
    const relationship=await c.query(`SELECT 1 FROM bookings b
      JOIN sessions s ON s.tenant_id=b.tenant_id AND s.id=b.session_id
      WHERE b.tenant_id=$1 AND b.id=$2 AND s.id=$3`,[current.tenant_id,current.aggregate_id,related.sessionId]);
    if(!relationship.rows.length)throw new PermanentOutboxError('EVENT_BOOKING_SESSION_MISMATCH');
   }
   const applied=await c.query<{event_id:string}>(`INSERT INTO processed_outbox_events
     (event_id,tenant_id,aggregate_type,aggregate_id,event_type,schema_version)
     VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
     [current.id,current.tenant_id,current.aggregate_type,current.aggregate_id,
      current.event_type,current.schema_version]);
   if(applied.rows.length){
    // An actual internal projection, not just a no-op receipt. Both changes commit together.
    await c.query(`INSERT INTO outbox_event_counters(tenant_id,event_type,processed_count)
      VALUES($1,$2,1) ON CONFLICT(tenant_id,event_type) DO UPDATE
        SET processed_count=outbox_event_counters.processed_count+1,
            updated_at=clock_timestamp()`,[current.tenant_id,current.event_type]);
   }
   const finalized=await c.query(`UPDATE outbox_events SET published_at=clock_timestamp(),claimed_by=NULL,
      claim_started_at=NULL,lease_until=NULL,last_error_code=NULL
      WHERE id=$1 AND claimed_by=$2 AND lease_until>clock_timestamp() RETURNING id`,
    [current.id,this.id]);
   if(!finalized.rowCount){await c.query('ROLLBACK');return 'LEASE_LOST';}
   commitStarted=true;await c.query('COMMIT');committed=true;return 'PROCESSED';
  }catch(err){if(!commitStarted)try{await c.query('ROLLBACK');}catch{broken=true;}
   else broken=true;throw err;}
  finally{c.release(broken||(commitStarted&&!committed));}
 }
 async failure(event:Claimed,err:unknown):Promise<void> {
  const code=failureCode(err),permanent=err instanceof PermanentOutboxError || event.attempts>=this.options.maxAttempts;
  const delay=retryDelayMs(event.attempts);
  const c=await this.pool.connect();
  try {
   await c.query(`UPDATE outbox_events SET claimed_by=NULL,claim_started_at=NULL,lease_until=NULL,
      last_error_code=$3,failed_at=CASE WHEN $4 THEN clock_timestamp() ELSE NULL END,
      available_at=CASE WHEN $4 THEN available_at ELSE clock_timestamp()+($5::int*interval '1 millisecond') END
      WHERE id=$1 AND claimed_by=$2 AND lease_until>clock_timestamp() AND published_at IS NULL`,
     [event.id,this.id,code,permanent,delay]);
  }finally{c.release();}
 }
 /** No public HTTP endpoint; bounded operational diagnostic with no UUID or payload logging. */
 async metrics():Promise<{pending:number;claimed:number;failed:number;oldestPendingSeconds:number|null;retries:number}> {
  const r=await this.pool.query<{pending:string;claimed:string;failed:string;oldest_seconds:string|null;retries:string}>(`
    SELECT count(*) FILTER (WHERE published_at IS NULL AND failed_at IS NULL)::text AS pending,
     count(*) FILTER (WHERE claimed_by IS NOT NULL AND lease_until>clock_timestamp() AND
      published_at IS NULL AND failed_at IS NULL)::text AS claimed,
     count(*) FILTER (WHERE failed_at IS NOT NULL)::text AS failed,
     EXTRACT(EPOCH FROM clock_timestamp()-min(created_at) FILTER
      (WHERE published_at IS NULL AND failed_at IS NULL))::text AS oldest_seconds,
     coalesce(sum(greatest(attempts-1,0)),0)::text AS retries FROM outbox_events`);
  const x=requireValue(r.rows[0]);
  return {pending:Number(x.pending),claimed:Number(x.claimed),failed:Number(x.failed),
   oldestPendingSeconds:x.oldest_seconds===null?null:Number(x.oldest_seconds),retries:Number(x.retries)};
 }
 async tick():Promise<{claimed:number;processed:number;failed:number;leaseLost:number;durationMs:number}> {
  const started=performance.now();
  const events=await this.claim();let processed=0,failed=0,leaseLost=0;
  for(const event of events){
   try {if(await this.process(event)==='PROCESSED')processed++;else leaseLost++;}
   catch(err){failed++;try{await this.failure(event,err);}catch{/* lease expiry allows a new claim; never conceal failure */}}
  }
  return {claimed:events.length,processed,failed,leaseLost,durationMs:Math.round(performance.now()-started)};
 }
}
/** Dedicated process, no HTTP routes, no external network calls in a claim transaction. */
export async function runOutboxWorker(env:NodeJS.ProcessEnv=process.env):Promise<void> {
 const url=env.OUTBOX_DATABASE_URL;
 if(!url||!/^postgres(?:ql)?:\/\//.test(url))throw new Error('OUTBOX_DATABASE_URL_REQUIRED');
 const pool=new Pool({connectionString:url,max:5,connectionTimeoutMillis:5000,application_name:'bookcore-outbox'});
 pool.on('error',()=>{/* handled by next poll; do not log credentials */});
 const worker=new OutboxWorker(pool);
 let stopping=false;let pollCount=0;
 const halt=()=>{stopping=true;};
 process.on('SIGTERM',halt);process.on('SIGINT',halt);
 try {
  while(!stopping){
   try {const result=await worker.tick();
    process.stdout.write(JSON.stringify({type:'outbox_tick',...result})+'\n');
    if(++pollCount%60===0)process.stdout.write(JSON.stringify({type:'outbox_backlog',...await worker.metrics()})+'\n');
   }catch{process.stderr.write(JSON.stringify({type:'outbox_error',code:'DEPENDENCY_UNAVAILABLE'})+'\n');}
   if(!stopping)await new Promise<void>(resolve=>setTimeout(resolve,DEFAULT_WORKER.pollMs));
  }
 }finally{process.removeListener('SIGTERM',halt);process.removeListener('SIGINT',halt);await pool.end();}
}
