import {requireValue} from '../../src/common/require-value';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fork,type ChildProcess} from 'node:child_process';
import {resolve} from 'node:path';
import {Pool} from 'pg';
import {buildApplication} from '../../src/bootstrap';
import {parseConfig} from '../../src/config/app-config';
import {AccessTokenService} from '../../src/modules/identity/token.service';
import {verifyBookingContentionResults} from '../../src/modules/booking/contention-result';
import {pruneRateBuckets} from '../../../../scripts/lifecycle-maintenance';

const needed=['DATABASE_URL','MIGRATION_DATABASE_URL','AUTH_JWT_ISSUER','AUTH_JWT_AUDIENCE',
 'AUTH_JWT_ACTIVE_KID','AUTH_JWT_KEYS_JSON','MONITOR_API_KEY'];
if(needed.some(x=>!process.env[x]))throw new Error('PHASE07_REAL_POSTGRESQL_CONFIG_REQUIRED');
const config=parseConfig({...process.env,NODE_ENV:'test',TX_LOCK_TIMEOUT_MS:'15000',TX_STATEMENT_TIMEOUT_MS:'30000'});
type Body=Record<string,unknown>;type HTTP={status:number;body:Body};
const benchmarkSamples:{status:number;ms:number}[]=[];
function percentiles(values:number[]):{p50:number;p95:number;p99:number} {
 if(!values.length)throw new Error('NO_BENCHMARK_SAMPLES');
 const sorted=[...values].sort((a,b)=>a-b),percentile=(p:number)=>
  Math.round(requireValue(sorted[Math.ceil(p*sorted.length)-1]) *1000)/1000;
 return {p50:percentile(.50),p95:percentile(.95),p99:percentile(.99)};
}

async function call(url:string,path:string,method:string,token?:string,body?:unknown,key?:string):Promise<HTTP>{
 const started=performance.now();
 const r=await fetch(url+path,{method,signal:AbortSignal.timeout(20000),headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),
  ...(body!==undefined?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},
  ...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const raw=await r.text();if(method==='POST'&&/\/sessions\/[^/]+\/bookings$/.test(path))
  benchmarkSamples.push({status:r.status,ms:performance.now()-started});
 return {status:r.status,body:raw?JSON.parse(raw) as Body:{}};
}
async function fixture(){
 const app=await buildApplication(config);await app.listen(0,'127.0.0.1');
 const base=`http://127.0.0.1:${(app.getHttpServer().address() as {port:number}).port}/api/v1`;
 const owner=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:5});
 const issue=app.get(AccessTokenService);
 async function actor(){
  const u=await owner.query<{id:string}>(`INSERT INTO users(email) VALUES ($1) RETURNING id`,
   [`p07-${randomUUID()}@example.invalid`]);
  const id=requireValue(u.rows[0]).id;
  const s=await owner.query<{id:string}>(`INSERT INTO auth_sessions(user_id,expires_at)
      VALUES($1,clock_timestamp()+interval '7 days') RETURNING id`,[id]);
  return {id,token:issue.issue(id,requireValue(s.rows[0]).id),sid:requireValue(s.rows[0]).id};
 }
 return {base,owner,app,actor,close:async()=>{await owner.end();await app.close();}};
}
async function setup(f:Awaited<ReturnType<typeof fixture>>){
 const manager=await f.actor(),trainer=await f.actor();
 const org=await call(f.base,'/organizations','POST',manager.token,{name:'BookCore Phase07',timezone:'Asia/Tehran'});
 assert.equal(org.status,201,JSON.stringify(org));const orgId=org.body.id as string;
 const invite=await call(f.base,`/organizations/${orgId}/staff-invitations`,'POST',manager.token,{userId:trainer.id,role:'TRAINER'});
 assert.equal(invite.status,201,JSON.stringify(invite));
 const member=await call(f.base,'/me/staff-invitations/accept','POST',trainer.token,{token:invite.body.token});
 assert.equal(member.status,200,JSON.stringify(member));
 const branch=await call(f.base,`/organizations/${orgId}/branches`,'POST',manager.token,{name:'East Branch'});
 const service=await call(f.base,`/organizations/${orgId}/services`,'POST',manager.token,{title:'Personal coaching',durationMin:60});
 const resource=await call(f.base,`/organizations/${orgId}/resources`,'POST',manager.token,
  {type:'TRAINER',displayName:'Phase07 Trainer',trainerUserId:trainer.id});
 for(const item of [branch,service,resource])assert.equal(item.status,201,JSON.stringify(item));
 for(let day=1;day<=7;day++)for(const scope of [{branchId:branch.body.id},{resourceId:resource.body.id}]){
  const r=await call(f.base,`/organizations/${orgId}/business-hours`,'POST',manager.token,
   {...scope,isoWeekday:day,startLocal:'00:00',endLocal:'23:59',endDayOffset:0});
  assert.equal(r.status,201,JSON.stringify(r));
 }
 // A separate future date per new session avoids unintended GiST conflicts.
 let day=10;
 async function newSession(capacity:number){
  const date=new Date(Date.now()+day++*86400000);date.setUTCHours(10,0,0,0);
  const d=date.toISOString().slice(0,10);
  const body={branchId:branch.body.id,serviceId:service.body.id,trainerResourceId:resource.body.id,
   startAt:`${d}T13:30:00+03:30`,endAt:`${d}T14:30:00+03:30`,capacityTotal:capacity};
  const create=await call(f.base,`/organizations/${orgId}/sessions`,'POST',manager.token,body);
  assert.equal(create.status,201,JSON.stringify(create));
  const pub=await call(f.base,`/organizations/${orgId}/sessions/${create.body.id}/publish`,'POST',manager.token);
  assert.equal(pub.status,200,JSON.stringify(pub));return create.body.id as string;
 }
 return {manager,trainer,orgId,newSession};
}
async function spawnApi():Promise<{child:ChildProcess;url:string;stop:()=>Promise<void>}>{
 const child=fork(resolve(process.cwd(),'apps/api/test/integration/phase07-api-worker.cjs'),[],{
  cwd:process.cwd(),env:{...process.env,NODE_ENV:'test',TX_LOCK_TIMEOUT_MS:'15000',TX_STATEMENT_TIMEOUT_MS:'30000'},
  stdio:['ignore','pipe','pipe','ipc']});
 let output='';child.stderr?.on('data',chunk=>{output=(output+String(chunk)).slice(-8000);});
 child.stdout?.on('data',chunk=>{output=(output+String(chunk)).slice(-8000);});
 const port=await new Promise<number>((done,reject)=>{
  const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('WORKER_START_TIMEOUT:'+output));},30000);
  child.once('exit',code=>{clearTimeout(timer);reject(new Error('WORKER_EARLY_EXIT:'+code+':'+output));});
  child.on('message',m=>{if(m&&typeof m==='object'&&'kind' in m&&m.kind==='READY'&&'port' in m){
   clearTimeout(timer);done(m.port as number);
  }});
 });
 return {child,url:`http://127.0.0.1:${port}/api/v1`,stop:()=>new Promise<void>((done,reject)=>{
  const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('WORKER_SHUTDOWN_TIMEOUT'));},10000);
  child.once('exit',(code,signal)=>{clearTimeout(timer);if(code===0&&!signal)done();else reject(new Error(`WORKER_EXIT_${code}_${signal}:${output}`));});
  child.send('STOP');
 })};
}
test('Phase07 real PostgreSQL: 100 independent requests, capacity 1/20, 3 clean repetitions, two API processes',
 {timeout:600000},async()=>{
 const f=await fixture();const workers:Awaited<ReturnType<typeof spawnApi>>[]=[];
 try{
  const {orgId,newSession}=await setup(f);
  const customers=await Promise.all(Array.from({length:100},()=>f.actor()));
  workers.push(await spawnApi(),await spawnApi());
  const started=process.hrtime.bigint();
  for(const capacity of [1,20])for(let repetition=1;repetition<=3;repetition++){
   const sid=await newSession(capacity);
   const sampleFrom=benchmarkSamples.length;
   const responses=await Promise.all(customers.map((customer,i)=>call(requireValue(workers[i%2]).url,
    `/organizations/${orgId}/sessions/${sid}/bookings`,'POST',customer.token,{},randomUUID())));
   // A 503/timeout must NEVER count as a normal losing request.
   // Promise.all rejects on transport failure and AbortSignal.timeout rejects on stalls.
   const outcome=verifyBookingContentionResults(responses,capacity);
   const snapshot=await f.owner.query<{seats_committed:number;capacity_total:number;effective:string;events:string;notices:string;duplicates:string}>(`
    SELECT s.seats_committed,s.capacity_total,
      (SELECT count(*)::text FROM bookings WHERE session_id=s.id AND status='CONFIRMED') AS effective,
      (SELECT count(*)::text FROM booking_events e JOIN bookings b ON b.id=e.booking_id
        WHERE b.session_id=s.id AND e.to_status='CONFIRMED') AS events,
      (SELECT count(*)::text FROM outbox_events x JOIN bookings b ON b.id=x.aggregate_id
        WHERE b.session_id=s.id AND x.event_type='BookingConfirmed') AS notices,
      (SELECT count(*)::text FROM (SELECT customer_id FROM bookings WHERE session_id=s.id AND
        status IN ('CONFIRMED','ATTENDED','NO_SHOW') GROUP BY customer_id HAVING count(*)>1) duplicated) AS duplicates
     FROM sessions s WHERE s.id=$1`,[sid]);
   const state=requireValue(snapshot.rows[0]);
   assert.equal(state.seats_committed,capacity);assert.equal(state.capacity_total,capacity);
   for(const n of [state.effective,state.events,state.notices])assert.equal(n,String(capacity));
   assert.equal(state.duplicates,'0');
   const samples=benchmarkSamples.slice(sampleFrom);
   assert.equal(samples.length,100,'Every response must have an actual latency observation');
   const distribution=outcome.statusDistribution;
   process.stdout.write(JSON.stringify({event:'phase13_booking_contention',
      capacity,repetition,processes:2,requestCount:samples.length,statusDistribution:distribution,
      latencyMs:percentiles(samples.map(x=>x.ms)),persisted:{seatsCommitted:state.seats_committed,
       effective:Number(state.effective),bookingEvents:Number(state.events),outboxEvents:Number(state.notices)}})+'\n');
  }
  process.stdout.write(`P07_CAPACITY_2_PROCESSES_6_RUNS_MS=${Number(process.hrtime.bigint()-started)/1e6}\n`);
 }finally{
  const stops=await Promise.allSettled(workers.map(w=>w.stop()));
  await f.close();
  const failure=stops.find(x=>x.status==='rejected');
  if(failure?.status==='rejected')throw failure.reason;
 }
});
test('Phase07 PostgreSQL: duplicate booking, committed replay, cancellation double-release and customer scope',
 {timeout:120000},async()=>{
 const f=await fixture();try{
  const {orgId,newSession,manager}=await setup(f),sid=await newSession(2),a=await f.actor(),b=await f.actor();
  const path=`/organizations/${orgId}/sessions/${sid}/bookings`,key=randomUUID();
  const withoutBody=await fetch(`${f.base}${path}`,{method:'POST',signal:AbortSignal.timeout(20000),body:'{}',
   headers:{Authorization:`Bearer ${a.token}`,'Content-Type':'application/json','Idempotency-Key':key}});
  assert.equal(withoutBody.status,201);await withoutBody.body?.cancel();
  const committed=await f.owner.query<{id:string}>(`SELECT id FROM bookings WHERE tenant_id=$1 AND session_id=$2`,[orgId,sid]);
  assert.equal(committed.rowCount,1);
  const first=await call(f.base,path,'POST',a.token,{},key);
  assert.equal(first.status,201);assert.equal(first.body.id,committed.rows[0]?.id);
  const replay=await call(f.base,path,'POST',a.token,{},key);assert.deepEqual(replay.body,first.body);assert.equal(replay.status,201);
  const duplicate=await call(f.base,path,'POST',a.token,{},randomUUID());assert.equal(duplicate.status,409);
  const foreignHistory=await call(f.base,`/organizations/${orgId}/bookings/me`,'GET',b.token);
  assert.equal(foreignHistory.status,200);assert.deepEqual(foreignHistory.body.items,[]);
  const myHistory=await call(f.base,`/organizations/${orgId}/bookings/me`,'GET',a.token);
  assert.equal(myHistory.status,200);assert.ok((myHistory.body.items as Body[]).some((i:Body)=>i.id===first.body.id));
  const cancelPath=`/organizations/${orgId}/bookings/${first.body.id}/cancel`,cancelKey=randomUUID();
  const [one,two]=await Promise.all([
   call(f.base,cancelPath,'POST',a.token,{},cancelKey),
   call(f.base,cancelPath,'POST',a.token,{},cancelKey)]);
  assert.equal(one.status,200);assert.equal(two.status,200);assert.deepEqual(one.body,two.body);
  const row=await f.owner.query<{seats_committed:number;cancel_events:string}>(`
   SELECT s.seats_committed,(SELECT count(*)::text FROM booking_events WHERE booking_id=$2 AND to_status='CANCELLED') AS cancel_events
    FROM sessions s WHERE s.id=$1`,[sid,first.body.id]);
  assert.equal(requireValue(row.rows[0]).seats_committed,0);assert.equal(requireValue(row.rows[0]).cancel_events,'1');
  assert.equal((await call(f.base,cancelPath,'POST',b.token,{},randomUUID())).status,404);
  assert.equal((await call(f.base,path,'POST',b.token,{customerId:a.id},randomUUID())).status,404);
  assert.equal((await call(f.base,`/organizations/${orgId}/bookings/${first.body.id}/attendance`,'POST',manager.token,
   {status:'ATTENDED'},randomUUID())).status,409);
 }finally{await f.close();}
});
test('PostgreSQL: session cancellation racing booking or customer cancellation commits a single valid outcome',
 {timeout:120000},async()=>{
 const f=await fixture();try{
  const {orgId,newSession,manager}=await setup(f),customer=await f.actor();
  for(const action of ['book','cancel']){
   const sid=await newSession(1),path=`/organizations/${orgId}/sessions/${sid}`;
   const book=()=>call(f.base,`${path}/bookings`,'POST',customer.token,{},randomUUID());
   let customerOperation=book;
   if(action==='cancel'){
    const created=await book();assert.equal(created.status,201);
    customerOperation=()=>call(f.base,`/organizations/${orgId}/bookings/${created.body.id}/cancel`,
     'POST',customer.token,{},randomUUID());
   }
   const [session,booking]=await Promise.all([
    call(f.base,`${path}/cancel`,'POST',manager.token,{reason:'Synthetic cancellation race'},randomUUID()),
    customerOperation(),
   ]);
   assert.equal(session.status,200,JSON.stringify(session));
   assert.ok([action==='book'?201:200,409].includes(booking.status),JSON.stringify(booking));
   const hasBooking=action==='cancel'||booking.status===201;
   const result=await f.owner.query(`SELECT s.status,s.seats_committed,
    (SELECT count(*)::int FROM bookings WHERE tenant_id=$1 AND session_id=$2 AND status='CANCELLED') AS cancelled,
    (SELECT count(*)::int FROM booking_events e JOIN bookings b ON b.tenant_id=e.tenant_id AND b.id=e.booking_id
     WHERE b.tenant_id=$1 AND b.session_id=$2 AND e.to_status='CANCELLED') AS events,
    (SELECT count(*)::int FROM outbox_events o JOIN bookings b ON b.tenant_id=o.tenant_id AND b.id=o.aggregate_id
     WHERE b.tenant_id=$1 AND b.session_id=$2 AND o.event_type='BookingCancelled') AS notices
    FROM sessions s WHERE s.tenant_id=$1 AND s.id=$2`,[orgId,sid]);
   assert.deepEqual(result.rows[0],{status:'CANCELLED',seats_committed:0,
    cancelled:Number(hasBooking),events:Number(hasBooking),notices:Number(hasBooking)});
  }
 }finally{await f.close();}
});
test('PostgreSQL: bounded rate-bucket maintenance can run while a booking commits',
 {timeout:120000},async()=>{
 const f=await fixture();try{
  const {orgId,newSession,manager}=await setup(f),customer=await f.actor();
  const sid=await newSession(1);
  const maintenance=new Pool({connectionString:requireValue(process.env.BOOKCORE_MAINTENANCE_DATABASE_URL),max:1});
  try{
   const {login}=requireValue((await maintenance.query<{login:string}>('SELECT session_user::text AS login')).rows[0]);
   await f.owner.query(`INSERT INTO bookcore_operator_identities(login_role,actor_user_id,enabled) VALUES($1,$2,true)
    ON CONFLICT(login_role) DO UPDATE SET actor_user_id=excluded.actor_user_id,enabled=true`,[login,manager.id]);
  }finally{await maintenance.end();}
  const bucket=randomUUID().replaceAll('-','').padEnd(64,'0');
  await f.owner.query(`INSERT INTO auth_rate_limits(key_hash,bucket_start,count) VALUES($1,'2000-01-01',1)`,[bucket]);
  const [booked,pruned]=await Promise.all([
   call(f.base,`/organizations/${orgId}/sessions/${sid}/bookings`,'POST',customer.token,{},randomUUID()),
   pruneRateBuckets(1,48,'Synthetic concurrent maintenance drill',true),
  ]);
  assert.equal(booked.status,201,JSON.stringify(booked));assert.deepEqual(pruned,{apply:true,affected:1});
  const state=await f.owner.query(`SELECT s.seats_committed,b.status,
   EXISTS(SELECT 1 FROM auth_rate_limits WHERE key_hash=$4) AS bucket_present
   FROM sessions s JOIN bookings b ON b.tenant_id=s.tenant_id AND b.session_id=s.id
   WHERE s.tenant_id=$1 AND s.id=$2 AND b.id=$3`,[orgId,sid,booked.body.id,bucket]);
  assert.deepEqual(state.rows[0],{seats_committed:1,status:'CONFIRMED',bucket_present:false});
 }finally{await f.close();}
});
test('Phase07 PostgreSQL: session cancel with fifteen bookings and audit/outbox/history',
 {timeout:180000},async()=>{
 const f=await fixture();try{
  const {orgId,newSession,manager}=await setup(f),sid=await newSession(20);
  const customers=await Promise.all(Array.from({length:15},()=>f.actor()));
  const responses=await Promise.all(customers.map(a=>call(f.base,
   `/organizations/${orgId}/sessions/${sid}/bookings`,'POST',a.token,{},randomUUID())));
  assert.equal(responses.filter(x=>x.status===201).length,15,JSON.stringify(responses));
  const cancelled=await call(f.base,`/organizations/${orgId}/sessions/${sid}/cancel`,'POST',manager.token,
   {reason:'Operations cancelled'},randomUUID());assert.equal(cancelled.status,200,JSON.stringify(cancelled));
  const result=await f.owner.query<{seats_committed:number;status:string;bookings:string;events:string;allocations:string}>(`
    SELECT s.seats_committed,s.status,
     (SELECT count(*)::text FROM bookings WHERE session_id=s.id AND status='CANCELLED') bookings,
     (SELECT count(*)::text FROM booking_events e JOIN bookings b ON b.id=e.booking_id
       WHERE b.session_id=s.id AND e.to_status='CANCELLED') events,
     (SELECT count(*)::text FROM resource_allocations WHERE session_id=s.id AND active) allocations
    FROM sessions s WHERE id=$1`,[sid]);
  assert.equal(requireValue(result.rows[0]).status,'CANCELLED');assert.equal(requireValue(result.rows[0]).seats_committed,0);
  assert.equal(requireValue(result.rows[0]).bookings,'15');assert.equal(requireValue(result.rows[0]).events,'15');
  assert.equal(requireValue(result.rows[0]).allocations,'0');
 }finally{await f.close();}
});
test('Phase07 PostgreSQL: different idempotency payload, staff reason, counter corruption and session revocation',
 {timeout:160000},async()=>{
 const f=await fixture();try{
  const {orgId,newSession,manager}=await setup(f);
  const sid1=await newSession(2),sid2=await newSession(2),customer=await f.actor();
  const key=randomUUID();
  const first=await call(f.base,`/organizations/${orgId}/sessions/${sid1}/bookings`,'POST',customer.token,{},key);
  assert.equal(first.status,201,JSON.stringify(first));
  const mismatch=await call(f.base,`/organizations/${orgId}/sessions/${sid2}/bookings`,'POST',customer.token,{},key);
  assert.equal(mismatch.status,409);assert.equal(mismatch.body.code,'IDEMPOTENCY_KEY_REUSED');
  // The deferred constraint rejects deliberate counter drift at COMMIT.
  const client=await f.owner.connect();try{
   await client.query('BEGIN');await client.query('UPDATE sessions SET seats_committed=2 WHERE id=$1',[sid1]);
   await assert.rejects(client.query('COMMIT'),(err:unknown)=>{
    assert.equal((err as {code?:string}).code,'23514');return true;
   });
  }finally{await client.query('ROLLBACK').catch(()=>{});client.release();}
  const counter=await f.owner.query<{seats_committed:number}>(
    'SELECT seats_committed FROM sessions WHERE id=$1',[sid1]);assert.equal(counter.rows[0]?.seats_committed,1);
  const cancelled=await call(f.base,`/organizations/${orgId}/bookings/${first.body.id}/cancel`,
    'POST',manager.token,{reason:'Staff requested cancellation'},randomUUID());
  assert.equal(cancelled.status,200,JSON.stringify(cancelled));
  const event=await f.owner.query<{reason:string;actor_id:string}>(
    `SELECT reason,actor_id FROM booking_events WHERE booking_id=$1 AND to_status='CANCELLED'`,[first.body.id]);
  assert.equal(event.rows[0]?.reason,'Staff requested cancellation');assert.equal(event.rows[0]?.actor_id,manager.id);
  const history=await f.owner.query<{n:string}>(
    `SELECT count(*)::text AS n FROM booking_events WHERE booking_id=$1`,[first.body.id]);assert.equal(history.rows[0]?.n,'2');
  const before=await call(f.base,`/organizations/${orgId}/bookings/me`,'GET',customer.token);
  assert.equal(before.status,200);
  await f.owner.query('UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE id=$1',[customer.sid]);
  const revoked=await call(f.base,`/organizations/${orgId}/bookings/me`,'GET',customer.token);
  assert.equal(revoked.status,401);
 }finally{await f.close();}
});
test('Phase07 PostgreSQL: conflicting capacity change vs booking stays in legal committed state',
 {timeout:150000},async()=>{
 const f=await fixture();try{
  const {orgId,newSession,manager}=await setup(f),sid=await newSession(2),a=await f.actor(),b=await f.actor();
  const path=`/organizations/${orgId}/sessions/${sid}`;
  const first=await call(f.base,path+'/bookings','POST',a.token,{},randomUUID());assert.equal(first.status,201);
  const [capacity,book]=await Promise.all([
   call(f.base,path+'/capacity','PATCH',manager.token,{capacityTotal:1},randomUUID()),
   call(f.base,path+'/bookings','POST',b.token,{},randomUUID())]);
  assert.ok([200,409].includes(capacity.status));assert.ok([201,409].includes(book.status));
  const state=await f.owner.query<{seats_committed:number;capacity_total:number;n:string}>(
   `SELECT seats_committed,capacity_total,
       (SELECT count(*)::text FROM bookings b WHERE b.session_id=s.id AND b.status='CONFIRMED') n
      FROM sessions s WHERE id=$1`,[sid]);
  assert.ok(requireValue(state.rows[0]).seats_committed<=requireValue(state.rows[0]).capacity_total);
  assert.equal(String(requireValue(state.rows[0]).seats_committed),requireValue(state.rows[0]).n);
 }finally{await f.close();}
});
