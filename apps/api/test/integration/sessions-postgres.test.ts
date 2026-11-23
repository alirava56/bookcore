import {requireValue} from '../../src/common/require-value';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {buildApplication} from '../../src/bootstrap';
import {parseConfig} from '../../src/config/app-config';
import {AccessTokenService} from '../../src/modules/identity/token.service';
import {DatabaseService} from '../../src/infrastructure/database/database.service';
const required=['DATABASE_URL','MIGRATION_DATABASE_URL','AUTH_JWT_ISSUER','AUTH_JWT_AUDIENCE','AUTH_JWT_ACTIVE_KID','AUTH_JWT_KEYS_JSON','MONITOR_API_KEY'];
if(required.some(key=>!process.env[key]))throw new Error('REAL_POSTGRESQL_PHASE06_CONFIG_REQUIRED');
const config=parseConfig({...process.env,NODE_ENV:'test'});
type Resp={status:number;body:Record<string,unknown>};
async function fixture(){
 const app=await buildApplication(config);await app.listen(0,'127.0.0.1');
 const base=`http://127.0.0.1:${(app.getHttpServer().address() as {port:number}).port}/api/v1`;
 const owner=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:5});
 async function actor(){
  const user=await owner.query<{id:string}>(`INSERT INTO users(email) VALUES($1) RETURNING id`,[`p06-${randomUUID()}@example.invalid`]);
  const id=requireValue(user.rows[0]).id;
  const session=await owner.query<{id:string}>(`INSERT INTO auth_sessions(user_id,expires_at) VALUES($1,clock_timestamp()+interval '2 days') RETURNING id`,[id]);
  return {id,token:app.get(AccessTokenService).issue(id,requireValue(session.rows[0]).id)};
 }
 async function request(path:string,method='GET',token?:string,body?:unknown,key?:string):Promise<Resp>{
  const response=await fetch(base+path,{method,headers:{...(token?{authorization:`Bearer ${token}`}:{ }),
    ...(body!==undefined?{'content-type':'application/json'}:{}),...(key?{'idempotency-key':key}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const raw=await response.text();return {status:response.status,body:raw?JSON.parse(raw) as Record<string,unknown>:{}};
 }
 const close=async()=>{await owner.end();await app.close();};
 return {app,owner,actor,request,close};
}
async function setup(f:Awaited<ReturnType<typeof fixture>>){
 const manager=await f.actor(),trainer=await f.actor();
 const org=await f.request('/organizations','POST',manager.token,{name:'P06 Test',timezone:'Asia/Tehran'});
 assert.equal(org.status,201,JSON.stringify(org.body));const orgId=org.body.id as string;
 const invitation=await f.request(`/organizations/${orgId}/staff-invitations`,'POST',manager.token,
  {userId:trainer.id,role:'TRAINER'});
 assert.equal(invitation.status,201);
 assert.equal((await f.request('/me/staff-invitations/accept','POST',trainer.token,
  {token:invitation.body.token})).status,200);
 const branch=await f.request(`/organizations/${orgId}/branches`,'POST',manager.token,{name:'East Branch'});
 const service=await f.request(`/organizations/${orgId}/services`,'POST',manager.token,{title:'Personal Training',durationMin:60});
 const resource=await f.request(`/organizations/${orgId}/resources`,'POST',manager.token,{type:'TRAINER',displayName:'Coach',trainerUserId:trainer.id});
 for(const item of [branch,service,resource])assert.equal(item.status,201,JSON.stringify(item.body));
 for(let day=1;day<=7;day++)for(const target of [{branchId:branch.body.id},{resourceId:resource.body.id}]){
  const r=await f.request(`/organizations/${orgId}/business-hours`,'POST',manager.token,
   {...target,isoWeekday:day,startLocal:'00:00',endLocal:'23:59',endDayOffset:0});
  assert.equal(r.status,201,JSON.stringify(r.body));
 }
 const date=new Date(Date.now()+10*86400000);date.setUTCHours(10,0,0,0);
 const d=date.toISOString().slice(0,10);
 const body={branchId:branch.body.id,serviceId:service.body.id,trainerResourceId:resource.body.id,
  startAt:d+'T13:30:00+03:30',endAt:d+'T14:30:00+03:30',capacityTotal:20};
 const path=`/organizations/${orgId}/sessions`;
 return {manager,trainer,orgId,body,path};
}
test('Phase06 PostgreSQL: draft allocation, publication, public projection and tenant privacy',async()=>{
 const f=await fixture();try{
  const {manager,trainer,orgId,body,path}=await setup(f);
  const created=await f.request(path,'POST',manager.token,body);
  assert.equal(created.status,201,JSON.stringify(created.body));assert.equal(created.body.status,'DRAFT');
  const id=created.body.id as string;
  const allocation=await f.owner.query<{count:string}>(`SELECT count(*)::text AS count FROM resource_allocations WHERE tenant_id=$1 AND session_id=$2 AND active`,[orgId,id]);
  assert.equal(allocation.rows[0]?.count,'1');
  assert.equal((await f.request(`/public/organizations/${orgId}/sessions/${id}`)).status,404);
  assert.equal((await f.request(`${path}/${id}`,'GET',trainer.token)).status,200);
  const published=await f.request(`${path}/${id}/publish`,'POST',manager.token);
  assert.equal(published.status,200,JSON.stringify(published.body));
  const publicDetail=await f.request(`/public/organizations/${orgId}/sessions/${id}`);
  assert.equal(publicDetail.status,200,JSON.stringify(publicDetail.body));
  for(const forbidden of ['tenantId','trainerResourceId','roomResourceId','seatsCommitted','capacityTotal','version'])
   assert.equal(Object.hasOwn(publicDetail.body,forbidden),false,forbidden);
  const foreign=await f.actor();assert.equal((await f.request(`${path}/${id}`,'GET',foreign.token)).status,404);
  assert.equal((await f.request(`${path}/${id}/publish`,'POST',trainer.token)).status,403);
  assert.equal((await f.request(`${path}/${id}/finish`,'POST',manager.token)).status,409);
 }finally{await f.close();}
});
test('Phase06 PostgreSQL: overlapping trainer creation is rejected with no leaked session',async()=>{
 const f=await fixture();try{
  const {manager,orgId,body,path}=await setup(f);
  const [a,b]=await Promise.all([f.request(path,'POST',manager.token,body),f.request(path,'POST',manager.token,body)]);
  assert.deepEqual([a.status,b.status].sort(),[201,409],JSON.stringify([a,b]));
  const rows=await f.owner.query<{count:string}>(`SELECT count(*)::text AS count FROM sessions WHERE tenant_id=$1`,[orgId]);
  assert.equal(rows.rows[0]?.count,'1');
  const allocs=await f.owner.query<{count:string}>(`SELECT count(*)::text AS count FROM resource_allocations WHERE tenant_id=$1 AND active`,[orgId]);
  assert.equal(allocs.rows[0]?.count,'1');
 }finally{await f.close();}
});
test('Phase06 PostgreSQL: capacity idempotency, cancellation 15 bookings, history and outbox',async()=>{
 const f=await fixture();try{
  const {manager,orgId,body,path}=await setup(f);
  const c=await f.request(path,'POST',manager.token,body);assert.equal(c.status,201,JSON.stringify(c.body));
  const id=c.body.id as string;const pub=await f.request(`${path}/${id}/publish`,'POST',manager.token);
  assert.equal(pub.status,200,JSON.stringify(pub.body));
  const capacityKey=randomUUID();const cap=await f.request(`${path}/${id}/capacity`,'PATCH',manager.token,{capacityTotal:18},capacityKey);
  assert.equal(cap.status,200,JSON.stringify(cap.body));
  const replay=await f.request(`${path}/${id}/capacity`,'PATCH',manager.token,{capacityTotal:18},capacityKey);
  assert.equal(replay.status,200);assert.equal(replay.body.version,cap.body.version);
  assert.equal((await f.request(`${path}/${id}/capacity`,'PATCH',manager.token,{capacityTotal:19},capacityKey)).status,409);
  const conn=await f.owner.connect();try {
   await conn.query('BEGIN');
   for(let i=0;i<15;i++){
    const user=await conn.query<{id:string}>(`INSERT INTO users(email) VALUES($1) RETURNING id`,[`p06-cust-${randomUUID()}@example.invalid`]);
    const bid=await conn.query<{id:string}>(`INSERT INTO bookings(tenant_id,session_id,customer_id,created_by_actor_id)
       VALUES($1,$2,$3,$4) RETURNING id`,[orgId,id,requireValue(user.rows[0]).id,manager.id]);
    await conn.query(`INSERT INTO booking_events(tenant_id,booking_id,from_status,to_status,actor_id)
     VALUES($1,$2,NULL,'CONFIRMED',$3)`,[orgId,requireValue(bid.rows[0]).id,manager.id]);
   }
   await conn.query('UPDATE sessions SET seats_committed=15 WHERE tenant_id=$1 AND id=$2',[orgId,id]);
   await conn.query('COMMIT');
  }catch(err){await conn.query('ROLLBACK');throw err;}finally{conn.release();}
  const failed=await f.request(`${path}/${id}/capacity`,'PATCH',manager.token,{capacityTotal:14},randomUUID());
  assert.equal(failed.status,409);assert.equal((await f.request(`${path}/${id}/capacity`,'PATCH',manager.token,{capacityTotal:14},randomUUID())).status,409);
  const key=randomUUID();const [a,b]=await Promise.all([
   f.request(`${path}/${id}/cancel`,'POST',manager.token,{reason:'Instructor unavailable'},key),
   f.request(`${path}/${id}/cancel`,'POST',manager.token,{reason:'Instructor unavailable'},key)]);
  assert.deepEqual([a.status,b.status],[200,200],JSON.stringify([a,b]));
  assert.equal(a.body.version,b.body.version);
  const state=await f.owner.query<{status:string;seats_committed:number}>(`SELECT status,seats_committed FROM sessions WHERE id=$1`,[id]);
  assert.equal(state.rows[0]?.status,'CANCELLED');assert.equal(state.rows[0]?.seats_committed,0);
  const all=await f.owner.query<{n:string}>(`SELECT count(*)::text AS n FROM bookings WHERE session_id=$1 AND status='CANCELLED'`,[id]);
  assert.equal(all.rows[0]?.n,'15');
  const events=await f.owner.query<{n:string}>(`SELECT count(*)::text AS n FROM booking_events e JOIN bookings b ON b.id=e.booking_id
   WHERE b.session_id=$1 AND e.to_status='CANCELLED'`,[id]);assert.equal(events.rows[0]?.n,'15');
  const notices=await f.owner.query<{n:string}>(`SELECT count(*)::text AS n FROM outbox_events
   WHERE tenant_id=$1 AND event_type='BookingCancelled' AND payload->>'sessionId'=$2`,[orgId,id]);
  assert.equal(notices.rows[0]?.n,'15');
  const allocs=await f.owner.query<{n:string}>(`SELECT count(*)::text AS n FROM resource_allocations WHERE session_id=$1 AND active`,[id]);
  assert.equal(allocs.rows[0]?.n,'0');
 }finally{await f.close();}
});
test('Phase06 PostgreSQL: forced SQL failure rolls back partial uncommitted cancellation',async()=>{
 const f=await fixture();try{
  const {manager,body,path}=await setup(f);
  const created=await f.request(path,'POST',manager.token,body);assert.equal(created.status,201);
  const id=created.body.id as string;
  const client=await f.owner.connect();try{
   await client.query('BEGIN');
   await client.query(`UPDATE sessions SET status='CANCELLED',cancel_reason='forced rollback' WHERE id=$1`,[id]);
   await assert.rejects(()=>client.query('SELECT 1/0'));
   await client.query('ROLLBACK');
  }finally{client.release();}
  const result=await f.owner.query<{status:string}>(`SELECT status FROM sessions WHERE id=$1`,[id]);
  assert.equal(result.rows[0]?.status,'DRAFT');
  const alloc=await f.owner.query<{n:string}>(`SELECT count(*)::text AS n FROM resource_allocations WHERE session_id=$1 AND active`,[id]);
  assert.equal(alloc.rows[0]?.n,'1');
 }finally{await f.close();}
});
test('Phase06 PostgreSQL: direct counter drift and forged session references cannot commit',async()=>{
 const f=await fixture();try{
  const {manager,body,path}=await setup(f);
  const created=await f.request(path,'POST',manager.token,body);
  assert.equal(created.status,201,JSON.stringify(created.body));
  const id=created.body.id as string;
  await assert.rejects(()=>f.owner.query(`UPDATE sessions SET seats_committed=1 WHERE id=$1`,[id]));
  const status=await f.owner.query<{seats_committed:number}>(`SELECT seats_committed FROM sessions WHERE id=$1`,[id]);
  assert.equal(status.rows[0]?.seats_committed,0);
  const foreign=await f.actor();const tenant=await f.request('/organizations','POST',foreign.token,{name:'Foreign Tenant',timezone:'Asia/Tehran'});
  assert.equal(tenant.status,201);
  await assert.rejects(()=>f.owner.query(`UPDATE sessions SET tenant_id=$1 WHERE id=$2`,[tenant.body.id,id]));
  await assert.rejects(()=>f.owner.query(`INSERT INTO resource_allocations(tenant_id,session_id,resource_id,start_at,end_at)
     VALUES($1,$2,$3,clock_timestamp(),clock_timestamp()+interval '1 hour')`,[tenant.body.id,id,body.trainerResourceId]));
  const allocations=await f.owner.query<{n:string}>(`SELECT count(*)::text AS n FROM resource_allocations WHERE session_id=$1`,[id]);
  assert.equal(allocations.rows[0]?.n,'1');
 }finally{await f.close();}
});
test('Phase06 PostgreSQL: cancelled session is terminal and booking events are append-only',async()=>{
 const f=await fixture();try{
  const {manager,body,path}=await setup(f);
  const created=await f.request(path,'POST',manager.token,body);assert.equal(created.status,201);
  const id=created.body.id as string;
  const cancelled=await f.request(`${path}/${id}/cancel`,'POST',manager.token,{reason:'Weather closure'},randomUUID());
  assert.equal(cancelled.status,200,JSON.stringify(cancelled.body));
  assert.equal((await f.request(`${path}/${id}/publish`,'POST',manager.token)).status,409);
  await assert.rejects(()=>f.owner.query(`UPDATE sessions SET cancel_reason='changed' WHERE id=$1`,[id]));
  await assert.rejects(()=>f.owner.query(`UPDATE sessions SET status='DRAFT' WHERE id=$1`,[id]));
  const row=await f.owner.query<{status:string;cancel_reason:string}>(`SELECT status,cancel_reason FROM sessions WHERE id=$1`,[id]);
  assert.equal(row.rows[0]?.status,'CANCELLED');assert.equal(row.rows[0]?.cancel_reason,'Weather closure');
 }finally{await f.close();}
});
test('Phase06 PostgreSQL: adjacent half-open intervals accepted for same trainer',async()=>{
 const f=await fixture();try{
  const {manager,body,path,orgId}=await setup(f);
  const first=await f.request(path,'POST',manager.token,body);
  assert.equal(first.status,201,JSON.stringify(first.body));
  const later={...body,startAt:body.endAt,endAt:body.endAt.replace('14:30:00','15:30:00')};
  const second=await f.request(path,'POST',manager.token,later);
  assert.equal(second.status,201,JSON.stringify(second.body));
  const count=await f.owner.query<{n:string}>(`SELECT count(*)::text AS n FROM resource_allocations WHERE tenant_id=$1 AND active`,[orgId]);
  assert.equal(count.rows[0]?.n,'2');
 }finally{await f.close();}
});
test('Phase06 PostgreSQL: revalidates trainer membership and CLOSED exceptions before Publish',async()=>{
 const f=await fixture();try{
  const {manager,trainer,orgId,body,path}=await setup(f);
  const first=await f.request(path,'POST',manager.token,body);
  assert.equal(first.status,201,JSON.stringify(first.body));
  const stop=await f.request(`/organizations/${orgId}/schedule-exceptions`,'POST',manager.token,
   {branchId:body.branchId,kind:'CLOSED',startAt:body.startAt,endAt:body.endAt,reason:'Unexpected closure'});
  assert.equal(stop.status,201,JSON.stringify(stop.body));
  assert.equal((await f.request(`${path}/${first.body.id}/publish`,'POST',manager.token)).status,409);
  const still=await f.owner.query<{status:string}>(`SELECT status FROM sessions WHERE id=$1`,[first.body.id]);
  assert.equal(still.rows[0]?.status,'DRAFT');
  await f.request(`/organizations/${orgId}/schedule-exceptions/${stop.body.id}`,'PATCH',manager.token,{active:false});
  assert.equal((await f.request(`/organizations/${orgId}/members/${trainer.id}`,'PATCH',manager.token,{status:'REVOKED'})).status,200);
  assert.equal((await f.request(`${path}/${first.body.id}/publish`,'POST',manager.token)).status,409);
 }finally{await f.close();}
});
test('PostgreSQL: session creation replays after a deliberately lost commit acknowledgement',async t=>{
 const f=await fixture();try{
  const {manager,orgId,body,path}=await setup(f);
  const database=f.app.get(DatabaseService),connect=database.connect.bind(database);
  const wrapped=new WeakSet<object>();let lost=false;
  const hook=t.mock.method(database,'connect',async()=>{
   const connection=await connect();
   if(!wrapped.has(connection)){
    wrapped.add(connection);
    const query=connection.query;
    t.mock.method(connection,'query',async(sql:unknown,...params:unknown[])=>{
     const result:unknown=await Reflect.apply(query,connection,[sql,...params]);
     if(sql==='COMMIT'&&!lost){
      lost=true;throw Object.assign(new Error('Synthetic loss of database acknowledgement'),{code:'ECONNRESET'});
     }
     return result;
    });
   }
   return connection;
  });
  const key=randomUUID();const ambiguous=await f.request(path,'POST',manager.token,body,key);
  hook.mock.restore();
  assert.equal(lost,true);assert.equal(ambiguous.status,503);assert.equal(ambiguous.body.code,'UNKNOWN_COMMIT_OUTCOME');
  const committed=await f.owner.query<{id:string}>(`SELECT id FROM sessions WHERE tenant_id=$1`,[orgId]);
  assert.equal(committed.rowCount,1);
  const replay=await f.request(path,'POST',manager.token,body,key);
  assert.equal(replay.status,201);assert.equal(replay.body.id,committed.rows[0]?.id);
  const counts=await f.owner.query(`SELECT (SELECT count(*)::int FROM resource_allocations WHERE tenant_id=$1) AS allocations,
   (SELECT count(*)::int FROM outbox_events WHERE tenant_id=$1 AND event_type='SessionDraftCreated') AS events`,[orgId]);
  assert.deepEqual(counts.rows[0],{allocations:1,events:1});
 }finally{await f.close();}
});
test('PostgreSQL: resource deactivation racing session creation preserves allocation integrity',async()=>{
 const f=await fixture();try{
  const {manager,orgId,body,path}=await setup(f);
  const [creation]=await Promise.all([
   f.request(path,'POST',manager.token,body,randomUUID()),
   f.owner.query('UPDATE resources SET active=false WHERE tenant_id=$1 AND id=$2',[orgId,body.trainerResourceId]),
  ]);
  assert.ok([201,404].includes(creation.status),JSON.stringify(creation));
  const snapshot=await f.owner.query(`SELECT r.active,
   (SELECT count(*)::int FROM sessions WHERE tenant_id=$1) AS sessions,
   (SELECT count(*)::int FROM resource_allocations WHERE tenant_id=$1) AS allocations
   FROM resources r WHERE r.tenant_id=$1 AND r.id=$2`,[orgId,body.trainerResourceId]);
  const retained=creation.status===201?1:0;
  assert.deepEqual(snapshot.rows[0],{active:false,sessions:retained,allocations:retained});
  if(retained)assert.equal((await f.request(`${path}/${creation.body.id}/publish`,'POST',manager.token)).status,404);
 }finally{await f.close();}
});
