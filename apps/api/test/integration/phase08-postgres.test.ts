import {requireValue} from '../../src/common/require-value';
import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {Pool,type QueryResult} from 'pg';
import {ReportingService} from '../../src/modules/reporting/reporting.service';
import {BookingService} from '../../src/modules/booking/booking.service';
import {OutboxWorker} from '../../src/modules/outbox/outbox.worker';
import {PermanentOutboxError} from '../../src/modules/outbox/outbox.domain';
import {buildApplication} from '../../src/bootstrap';
import {parseConfig} from '../../src/config/app-config';
import {AccessTokenService} from '../../src/modules/identity/token.service';
import type {DatabaseService} from '../../src/infrastructure/database/database.service';
import type {UnitOfWork} from '../../src/infrastructure/transactions/unit-of-work';
import type {TenantAuthorizationService} from '../../src/modules/organizations/authorization.service';
import type {AppConfig} from '../../src/config/app-config';
if(!process.env.MIGRATION_DATABASE_URL||!process.env.OUTBOX_DATABASE_URL)
 throw new Error('PHASE08_POSTGRESQL_OWNER_AND_WORKER_URLS_REQUIRED');
const owner=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:3});
const workerPool=new Pool({connectionString:process.env.OUTBOX_DATABASE_URL,max:4});
const id=randomUUID;
interface Seed {org:string;actor:string;sid:string;other:string;ids:string[];outbox:string[]}
async function seed():Promise<Seed> {
 const c=await owner.connect();
 try {
  await c.query('BEGIN');
  const actor=requireValue((await c.query<{id:string}>('INSERT INTO users(email) VALUES($1) RETURNING id',
   [`p08-${id()}@example.invalid`])).rows[0]).id;
  const session=requireValue((await c.query<{id:string}>(`INSERT INTO auth_sessions(user_id,expires_at)
    VALUES($1,clock_timestamp()+interval '7 days') RETURNING id`,[actor])).rows[0]).id;
  const org=requireValue((await c.query<{id:string}>(`INSERT INTO organizations(name) VALUES('P08 Test Gym') RETURNING id`)).rows[0]).id;
  const other=requireValue((await c.query<{id:string}>(`INSERT INTO organizations(name) VALUES('Unrelated Gym') RETURNING id`)).rows[0]).id;
  await c.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')`,[org,actor]);
  const trainerUser=requireValue((await c.query<{id:string}>('INSERT INTO users(email) VALUES($1) RETURNING id',
   [`p08-trainer-${id()}@example.invalid`])).rows[0]).id;
  await c.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'TRAINER')`,[org,trainerUser]);
  const branch=requireValue((await c.query<{id:string}>(`INSERT INTO branches(tenant_id,name) VALUES($1,'Gym Branch') RETURNING id`,[org])).rows[0]).id;
  const service=requireValue((await c.query<{id:string}>(`INSERT INTO services(tenant_id,title,duration_min)
    VALUES($1,'Yoga',60) RETURNING id`,[org])).rows[0]).id;
  const trainer=requireValue((await c.query<{id:string}>(`INSERT INTO resources(tenant_id,type,trainer_user_id,display_name)
    VALUES($1,'TRAINER',$2,'Test trainer') RETURNING id`,[org,trainerUser])).rows[0]).id;
  const ids:string[]=[],outbox:string[]=[];
  for(let i=0;i<6;i++){
   const start=new Date(Date.now()+(11+i)*86400000).toISOString();
   const end=new Date(Date.parse(start)+3600000).toISOString();
   const s=requireValue((await c.query<{id:string}>(`INSERT INTO sessions
    (tenant_id,branch_id,service_id,trainer_resource_id,start_at,end_at,timezone_snapshot,status,capacity_total,created_by)
    VALUES($1,$2,$3,$4,$5,$6,'Asia/Tehran','PUBLISHED',10,$7) RETURNING id`,
    [org,branch,service,trainer,start,end,actor])).rows[0]).id;
   await c.query(`INSERT INTO resource_allocations(tenant_id,session_id,resource_id,start_at,end_at)
     VALUES($1,$2,$3,$4,$5)`,[org,s,trainer,start,end]);
   // Six PostgreSQL microseconds within a single millisecond; Date round-trip must not affect pagination.
   const created=`2026-11-11T10:10:10.00000${i+1}Z`;
   const booking=requireValue((await c.query<{id:string}>(`INSERT INTO bookings
    (tenant_id,session_id,customer_id,created_by_actor_id,created_at)
    VALUES($1,$2,$3,$3,$4::timestamptz) RETURNING id`,[org,s,actor,created])).rows[0]).id;
   await c.query(`UPDATE sessions SET seats_committed=1 WHERE id=$1`,[s]);
   await c.query(`INSERT INTO booking_events(tenant_id,booking_id,from_status,to_status,actor_id)
     VALUES($1,$2,NULL,'CONFIRMED',$3)`,[org,booking,actor]);
   if(i===0){
    await c.query(`UPDATE bookings SET status='CANCELLED',cancelled_at=clock_timestamp(),
      cancel_reason='CUSTOMER_REQUEST' WHERE id=$1`,[booking]);
    await c.query(`UPDATE sessions SET seats_committed=0 WHERE id=$1`,[s]);
    await c.query(`INSERT INTO booking_events(tenant_id,booking_id,from_status,to_status,actor_id,reason)
      VALUES($1,$2,'CONFIRMED','CANCELLED',$3,'CUSTOMER_REQUEST')`,[org,booking,actor]);
   }
   const event=requireValue((await c.query<{id:string}>(`INSERT INTO outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload)
      VALUES($1,'BOOKING',$2,$3,$4::jsonb) RETURNING id`,
    [org,booking,i===0?'BookingCancelled':'BookingConfirmed',JSON.stringify({bookingId:booking,status:i===0?'CANCELLED':'CONFIRMED'})])).rows[0]).id;
   ids.push(booking);outbox.push(event);
  }
  await c.query('COMMIT');return {org,actor,sid:session,other,ids,outbox};
 }catch(err){await c.query('ROLLBACK');throw err;}finally{c.release();}
}
test('real PostgreSQL: occupancy role scope, tenant scope and historical cancellation count',
 {timeout:60000},async()=>{
 const f=await seed();const service=new ReportingService({connect:()=>owner.connect()} as DatabaseService);
 const principal={userId:f.actor,sessionId:f.sid,active:true as const};
 const result=await service.occupancy(principal,f.org,
  new Date(Date.now()+10*86400000).toISOString(),new Date(Date.now()+20*86400000).toISOString());
 assert.equal(result.sessions,6);assert.equal(result.confirmed,5);assert.equal(result.cancelledBookings,1);
 assert.equal(result.attended,0);assert.equal(result.noShow,0);
 await assert.rejects(()=>service.occupancy(principal,f.other,
  new Date(Date.now()+10*86400000).toISOString(),new Date(Date.now()+20*86400000).toISOString()));
 const guest=requireValue((await owner.query<{id:string}>(`INSERT INTO users(email) VALUES($1) RETURNING id`,
  [`p08-receptionist-${id()}@example.invalid`])).rows[0]).id;
 const guestSession=requireValue((await owner.query<{id:string}>(`INSERT INTO auth_sessions(user_id,expires_at)
  VALUES($1,clock_timestamp()+interval '7 days') RETURNING id`,[guest])).rows[0]).id;
 await owner.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'RECEPTIONIST')`,[f.org,guest]);
 await assert.rejects(()=>service.occupancy({userId:guest,sessionId:guestSession,active:true},f.org,
  new Date(Date.now()+10*86400000).toISOString(),new Date(Date.now()+20*86400000).toISOString()));
});
test('real PostgreSQL: six booking rows within same millisecond have no pagination loss',
 {timeout:60000},async()=>{
 const f=await seed();
 const service=new BookingService({connect:()=>owner.connect()} as DatabaseService,
  {} as UnitOfWork,{} as TenantAuthorizationService,
  {jwtActiveKid:'k1',jwtKeys:{k1:'a-real-test-only-cursor-secret'}} as unknown as AppConfig);
 const all:string[]=[];let cursor:string|undefined;
 do{
  const r=await service.mine({userId:f.actor,sessionId:f.sid,active:true},f.org,
   {from:'2026-11-11T10:10:10Z',to:'2026-11-11T10:10:11Z',limit:'2',...(cursor?{cursor}:{})});
  all.push(...r.items.map(x=>x.id));cursor=r.page.nextCursor??undefined;
 }while(cursor);
 assert.equal(all.length,6);assert.equal(new Set(all).size,6);
 assert.deepEqual(new Set(all),new Set(f.ids));
});
test('real PostgreSQL: two workers skip-locked claim, durable exactly-once receipt, expired lease reclaims',
 {timeout:60000},async()=>{
 const f=await seed(),a=new OutboxWorker(workerPool),b=new OutboxWorker(workerPool);
 await owner.query(`UPDATE outbox_events SET available_at=(
   SELECT least(min(available_at),clock_timestamp())-interval '1 hour' FROM outbox_events)
  WHERE id = ANY($1::uuid[])`,[f.outbox]);
 const [ar,br]=await Promise.all([a.claim(),b.claim()]);
 const relevant=[...ar,...br].filter(e=>f.outbox.includes(e.id));
 assert.ok(relevant.length>=1);assert.equal(new Set(relevant.map(x=>x.id)).size,relevant.length);
 const claimed=requireValue(relevant[0]);
 const stale=(ar.find(x=>x.id===claimed.id)?a:b);
 const replacement=stale===a?b:a;
 await owner.query(`UPDATE outbox_events SET lease_until=clock_timestamp()-interval '1 second',
   available_at=(SELECT min(available_at)-interval '1 hour' FROM outbox_events) WHERE id=$1`,[claimed.id]);
 const reclaimed=await replacement.claim();
 assert.ok(reclaimed.some(e=>e.id===claimed.id));
 assert.equal(await stale.process(claimed),'LEASE_LOST');
 const recovered=requireValue(reclaimed.find(e=>e.id===claimed.id));
 assert.equal(await replacement.process(recovered),'PROCESSED');
 assert.equal(await replacement.process(recovered),'LEASE_LOST');
 const receipts=await owner.query<{count:string}>(`SELECT count(*)::text AS count
   FROM processed_outbox_events WHERE event_id=$1`,[claimed.id]);
 assert.equal(receipts.rows[0]?.count,'1');
 const snapshot=await owner.query<{published_at:Date|null;attempts:number}>(
  'SELECT published_at,attempts FROM outbox_events WHERE id=$1',[claimed.id]);
 assert.ok(snapshot.rows[0]?.published_at);assert.ok(requireValue(snapshot.rows[0]).attempts>=2);
});
test('real PostgreSQL: unknown event quarantined without false published receipt',
 {timeout:60000},async()=>{
 const f=await seed();const event=requireValue((await owner.query<{id:string}>(`INSERT INTO outbox_events
   (tenant_id,aggregate_type,aggregate_id,event_type,payload)
   VALUES($1,'ORGANIZATION',$1,'UnrecognizedEvent','{}'::jsonb) RETURNING id`,[f.org])).rows[0]).id;
 await owner.query(`UPDATE outbox_events SET available_at=(
   SELECT min(available_at)-interval '1 hour' FROM outbox_events) WHERE id=$1`,[event]);
 const w=new OutboxWorker(workerPool),claimed=(await w.claim()).find(x=>x.id===event);
 assert.ok(claimed);
 let failure:unknown;try{await w.process(requireValue(claimed));}catch(err){failure=err;}
 assert.ok(failure);await w.failure(requireValue(claimed),failure);
 const row=await owner.query<{failed_at:Date|null;published_at:Date|null}>(
  'SELECT failed_at,published_at FROM outbox_events WHERE id=$1',[event]);
 assert.ok(row.rows[0]?.failed_at);assert.equal(row.rows[0]?.published_at,null);
});
test('real PostgreSQL: worker role cannot mutate users or delete receipt',
 {timeout:20000},async()=>{
 const c=await workerPool.connect();try{
  const r=await c.query<{can_update:boolean;can_delete:boolean}>(`SELECT
   has_table_privilege(current_user,'users','UPDATE') AS can_update,
   has_table_privilege(current_user,'processed_outbox_events','DELETE') AS can_delete`);
  assert.equal(r.rows[0]?.can_update,false);assert.equal(r.rows[0]?.can_delete,false);
 }finally{c.release();}
});
test('real PostgreSQL: two worker CLI processes persist one receipt per event and shut down cleanly',
 {timeout:60000},async()=>{
 const f=await seed();
 await owner.query(`UPDATE outbox_events SET available_at=(
   SELECT least(min(available_at),clock_timestamp())-interval '1 hour' FROM outbox_events)
   WHERE id=ANY($1::uuid[])`,[f.outbox]);
 const processes=Array.from({length:2},()=>{
  const child=spawn(process.execPath,['dist/scripts/outbox-worker.js'],{stdio:['ignore','pipe','pipe']});
  let output='';
  child.stdout.on('data',chunk=>{output+=String(chunk);});
  child.stderr.resume();
  return {child,closed:once(child,'close'),output:()=>output};
 });
 try{
  for(let i=0;i<24;i++){
   const state=await owner.query<{receipts:number}>(`SELECT count(*)::int AS receipts
    FROM processed_outbox_events WHERE tenant_id=$1 AND event_id=ANY($2::uuid[])`,[f.org,f.outbox]);
   if(state.rows[0]?.receipts===f.outbox.length&&processes.every(p=>p.output().includes('outbox_tick')))break;
   await delay(500);
  }
  const state=await owner.query(`SELECT
   (SELECT count(*)::int FROM outbox_events WHERE tenant_id=$1 AND published_at IS NOT NULL) AS published,
   (SELECT count(*)::int FROM processed_outbox_events WHERE tenant_id=$1) AS receipts,
   (SELECT sum(processed_count)::int FROM outbox_event_counters WHERE tenant_id=$1) AS projection`,[f.org]);
  assert.deepEqual(state.rows[0],{published:f.outbox.length,receipts:f.outbox.length,projection:f.outbox.length});
  assert.ok(processes.every(p=>p.output().includes('outbox_tick')));
 }finally{
  for(const p of processes)p.child.kill('SIGTERM');
  const forced=setTimeout(()=>{for(const p of processes)p.child.kill('SIGKILL');},5000);
  try{for(const p of processes)assert.deepEqual(await p.closed,[0,null]);}finally{clearTimeout(forced);}
 }
});
test('real PostgreSQL: legacy cancellation receipts require the booked session and tenant',
 {timeout:60000},async()=>{
 const f=await seed(),foreign=await seed(),worker=new OutboxWorker(workerPool);
 const result=await owner.query<{session_id:string}>('SELECT session_id FROM bookings WHERE id=$1',[f.ids[1]]);
 const booking=f.ids[0];assert.ok(booking);
 const correct=await owner.query<{session_id:string}>('SELECT session_id FROM bookings WHERE id=$1',[booking]);
 const sessionId=correct.rows[0]?.session_id;assert.ok(sessionId);
 const otherSession=result.rows[0]?.session_id;assert.ok(otherSession);
 const differentTenant=await owner.query<{session_id:string}>('SELECT session_id FROM bookings WHERE id=$1',[foreign.ids[0]]);
 const foreignSession=differentTenant.rows[0]?.session_id;assert.ok(foreignSession);
 type ClaimedEvent=Awaited<ReturnType<OutboxWorker['claim']>>[number];
 for(const reference of [otherSession,foreignSession,sessionId]){
  const valid:boolean=reference===sessionId;
  const inserted:QueryResult<ClaimedEvent>=await owner.query<ClaimedEvent>(`INSERT INTO outbox_events
   (tenant_id,aggregate_type,aggregate_id,event_type,payload,claimed_by,claim_started_at,lease_until,attempts)
   VALUES($1,'BOOKING',$2,'BookingCancelled',$3,$4,clock_timestamp(),clock_timestamp()+interval '45 seconds',1)
   RETURNING *`,[f.org,booking,{sessionId:reference,reason:'Session cancelled'},worker.id]);
  const claimed=requireValue(inserted.rows[0]);
  if(valid)assert.equal(await worker.process(claimed),'PROCESSED');
  else {
   let failure:unknown;
   await assert.rejects(worker.process(claimed),(err:unknown)=>{
    failure=err;
    return err instanceof PermanentOutboxError&&err.errorCode==='EVENT_BOOKING_SESSION_MISMATCH';
   });
   await worker.failure(claimed,failure);
  }
  const state=await owner.query(`SELECT e.published_at IS NOT NULL AS published,e.last_error_code,
   e.failed_at IS NOT NULL AS failed,p.event_id IS NOT NULL AS receipt FROM outbox_events e
   LEFT JOIN processed_outbox_events p ON p.event_id=e.id WHERE e.id=$1`,[claimed.id]);
  assert.deepEqual(state.rows[0],{published:valid,failed:!valid,receipt:valid,
   last_error_code:valid?null:'EVENT_BOOKING_SESSION_MISMATCH'});
 }
});
test('real NestJS HTTP: occupancy global guard and owner/manager vs receptionist/trainer/foreign',
 {timeout:60000},async()=>{
 const f=await seed();
 const app=await buildApplication(parseConfig({...process.env,NODE_ENV:'test'}));
 try {
  await app.listen(0,'127.0.0.1');
  const port=(app.getHttpServer().address() as {port:number}).port;
  const tokens=app.get(AccessTokenService);
  const path=(org:string)=>`http://127.0.0.1:${port}/api/v1/organizations/${org}/reports/occupancy?`+
   new URLSearchParams({from:new Date(Date.now()+10*86400000).toISOString(),
    to:new Date(Date.now()+20*86400000).toISOString()});
  const request=async(org:string,token?:string)=>{
   const result=await fetch(path(org),{headers:token?{Authorization:`Bearer ${token}`}:{}});
   return {status:result.status,body:await result.json() as Record<string,unknown>};
  };
  const ownerToken=tokens.issue(f.actor,f.sid);
  assert.equal((await request(f.org)).status,401);
  const good=await request(f.org,ownerToken);assert.equal(good.status,200);
  assert.equal(good.body.sessions,6);assert.equal(JSON.stringify(good.body).includes('@example.invalid'),false);
  assert.equal((await request(f.other,ownerToken)).status,404);
  for(const role of ['MANAGER','RECEPTIONIST','TRAINER'] as const){
   const person=requireValue((await owner.query<{id:string}>(`INSERT INTO users(email) VALUES($1) RETURNING id`,
     [`p08-${role}-${id()}@example.invalid`])).rows[0]).id;
   const sid=requireValue((await owner.query<{id:string}>(`INSERT INTO auth_sessions(user_id,expires_at)
     VALUES($1,clock_timestamp()+interval '7 days') RETURNING id`,[person])).rows[0]).id;
   await owner.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,$3)`,[f.org,person,role]);
   assert.equal((await request(f.org,tokens.issue(person,sid))).status,role==='MANAGER'?200:403);
  }
 }finally{await app.close();}
});
test('closing real pools',async()=>{await workerPool.end();await owner.end();});
