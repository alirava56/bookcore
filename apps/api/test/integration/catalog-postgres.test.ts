import {requireValue} from '../../src/common/require-value';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {parseConfig} from '../../src/config/app-config';
import {buildApplication} from '../../src/bootstrap';
import {AccessTokenService} from '../../src/modules/identity/token.service';
const required=['DATABASE_URL','MIGRATION_DATABASE_URL','AUTH_JWT_ISSUER','AUTH_JWT_AUDIENCE','AUTH_JWT_ACTIVE_KID','AUTH_JWT_KEYS_JSON','MONITOR_API_KEY'];
if(required.some(key=>!process.env[key]))throw new Error('PHASE05_REQUIRES_REAL_POSTGRESQL_AND_AUTH_TEST_CONFIG');
const cfg=parseConfig({...process.env,NODE_ENV:'test'});
type Obj=Record<string,unknown>;
async function fixture(){
 const app=await buildApplication(cfg);await app.listen(0,'127.0.0.1');
 const url=`http://127.0.0.1:${(app.getHttpServer().address() as {port:number}).port}/api/v1`;
 const owner=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:4});
 const apiPool=new Pool({connectionString:process.env.DATABASE_URL,max:4});
 async function actor(){
  const row=await owner.query<{id:string}>(`INSERT INTO users(email) VALUES($1) RETURNING id`,[`p05-${randomUUID()}@example.invalid`]);
  const uid=requireValue(row.rows[0]).id;
  const auth=await owner.query<{id:string}>(`INSERT INTO auth_sessions(user_id,expires_at)
      VALUES($1,clock_timestamp()+interval '2 days') RETURNING id`,[uid]);
  const token=app.get(AccessTokenService).issue(uid,requireValue(auth.rows[0]).id);
  return {uid,token};
 }
 async function call(path:string,method:'GET'|'POST'|'PATCH'='GET',token?:string,body?:unknown){
  const resp=await fetch(url+path,{method,headers:{...(token?{authorization:`Bearer ${token}`}:{}),
    ...(body!==undefined?{'content-type':'application/json'}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const text=await resp.text();return {status:resp.status,body:text?JSON.parse(text) as Obj:{}};
 }
 async function org(token:string){const res=await call('/organizations','POST',token,{name:'Catalog Integration',timezone:'Asia/Tehran'});
  assert.equal(res.status,201,JSON.stringify(res.body));return res.body.id as string;}
 async function cleanup(){await apiPool.end();await owner.end();await app.close();}
 return {app,owner,apiPool,actor,call,org,cleanup};
}
test('real PostgreSQL: scoped CRUD, audit/outbox, role and tenant privacy',async()=>{
 const f=await fixture();try{
  const a=await f.actor(),b=await f.actor(),orgA=await f.org(a.token),orgB=await f.org(b.token);
  assert.equal((await f.call(`/organizations/${orgA}/branches`,'GET',b.token)).status,404);
  assert.equal((await f.call(`/organizations/${orgA}/branches`,'POST',b.token,{name:'Foreign'})).status,404);
  const branch=await f.call(`/organizations/${orgA}/branches`,'POST',a.token,{name:'Central',address:'Tehran'});
  assert.equal(branch.status,201,JSON.stringify(branch.body));
  const service=await f.call(`/organizations/${orgA}/services`,'POST',a.token,{title:'Yoga',durationMin:60});
  assert.equal(service.status,201,JSON.stringify(service.body));
  const listing=await f.call(`/organizations/${orgA}/branches?limit=1`,'GET',a.token);
  assert.equal(listing.status,200);assert.equal((listing.body.items as unknown[]).length,1);
  const room=await f.call(`/organizations/${orgA}/resources`,'POST',a.token,
   {type:'ROOM',displayName:'Room A',branchId:branch.body.id});
  assert.equal(room.status,201,JSON.stringify(room.body));
  assert.equal((await f.call(`/organizations/${orgB}/resources`,'POST',b.token,
   {type:'ROOM',displayName:'Foreign Room',branchId:branch.body.id})).status,404);
  const events=await f.owner.query<{count:string}>(`SELECT count(*)::text AS count FROM audit_events
    WHERE tenant_id=$1 AND action IN ('BranchCreated','ServiceCreated','ResourceCreated')`,[orgA]);
  assert.equal(events.rows[0]?.count,'3');
  const outbox=await f.owner.query<{count:string}>(`SELECT count(*)::text AS count FROM outbox_events
    WHERE tenant_id=$1 AND event_type IN ('BranchCreated','ServiceCreated','ResourceCreated')`,[orgA]);
  assert.equal(outbox.rows[0]?.count,'3');
 }finally{await f.cleanup();}
});
test('real PostgreSQL: concurrent duplicate trainer resource results in exactly one committed row',async()=>{
 const f=await fixture();try{
  const manager=await f.actor(),trainer=await f.actor(),orgId=await f.org(manager.token);
  const invitation=await f.call(`/organizations/${orgId}/staff-invitations`,'POST',manager.token,
   {userId:trainer.uid,role:'TRAINER'});
  assert.equal(invitation.status,201);
  assert.equal((await f.call('/me/staff-invitations/accept','POST',trainer.token,
   {token:invitation.body.token})).status,200);
  const path=`/organizations/${orgId}/resources`;
  const [a,b]=await Promise.all([f.call(path,'POST',manager.token,{type:'TRAINER',displayName:'Coach',trainerUserId:trainer.uid}),
    f.call(path,'POST',manager.token,{type:'TRAINER',displayName:'Coach Two',trainerUserId:trainer.uid})]);
  assert.deepEqual([a.status,b.status].sort(),[201,409]);
  const count=await f.owner.query<{n:string}>(`SELECT count(*)::text AS n FROM resources
    WHERE tenant_id=$1 AND trainer_user_id=$2`,[orgId,trainer.uid]);
  assert.equal(count.rows[0]?.n,'1');
  assert.equal((await f.call(path,'GET',trainer.token)).status,403);
  const branch=await f.call(`/organizations/${orgId}/branches`,'POST',manager.token,{name:'Trainer Branch'});
  const resourceId=(a.status===201?a.body.id:b.body.id) as string;
  const targetHour=await f.call(`/organizations/${orgId}/business-hours`,'POST',manager.token,
   {resourceId,isoWeekday:1,startLocal:'08:00',endLocal:'16:00',endDayOffset:0});
  assert.equal(targetHour.status,201);
  assert.equal((await f.call(`/organizations/${orgId}/business-hours`,'POST',manager.token,
   {branchId:branch.body.id,isoWeekday:1,startLocal:'09:00',endLocal:'18:00',endDayOffset:0})).status,201);
  const scoped=await f.call(`/organizations/${orgId}/business-hours`,'GET',trainer.token);
  assert.equal(scoped.status,200);
  assert.equal((scoped.body.items as Array<{resourceId:string|null}>).length,1);
  assert.equal((scoped.body.items as Array<{resourceId:string|null}>)[0]?.resourceId,resourceId);

  // revocation during later writes: an already revoked trainer cannot be linked anew.
  assert.equal((await f.call(`/organizations/${orgId}/members/${trainer.uid}`,'PATCH',manager.token,{status:'REVOKED'})).status,200);
  await assert.rejects(()=>f.owner.query(`INSERT INTO resources(tenant_id,type,display_name,trainer_user_id)
    VALUES($1,'TRAINER','Illicit',$2)`,[orgId,trainer.uid]));
 }finally{await f.cleanup();}
});
test('real PostgreSQL: weekly overlap exclusion, UTC exception input, deactivation and history',async()=>{
 const f=await fixture();try{
  const actor=await f.actor(),orgId=await f.org(actor.token);
  const branch=await f.call(`/organizations/${orgId}/branches`,'POST',actor.token,{name:'West'});
  assert.equal(branch.status,201);
  const path=`/organizations/${orgId}/business-hours`;
  const first=await f.call(path,'POST',actor.token,{branchId:branch.body.id,isoWeekday:7,startLocal:'22:00',endLocal:'02:00',endDayOffset:1});
  assert.equal(first.status,201,JSON.stringify(first.body));
  const conflict=await f.call(path,'POST',actor.token,{branchId:branch.body.id,isoWeekday:1,startLocal:'01:30',endLocal:'03:00',endDayOffset:0});
  assert.equal(conflict.status,409,JSON.stringify(conflict.body));
  const deactivated=await f.call(`${path}/${first.body.id}`,'PATCH',actor.token,{active:false});
  assert.equal(deactivated.status,200);
  assert.equal((await f.call(`${path}/${first.body.id}`,'PATCH',actor.token,{active:false})).status,409);
  const after=await f.call(path,'POST',actor.token,{branchId:branch.body.id,isoWeekday:1,startLocal:'01:30',endLocal:'03:00',endDayOffset:0});
  assert.equal(after.status,201,JSON.stringify(after.body));
  const exceptionPath=`/organizations/${orgId}/schedule-exceptions`;
  const bad=await f.call(exceptionPath,'POST',actor.token,{branchId:branch.body.id,kind:'CLOSED',
   startAt:'2026-11-23T10:00:00Z',endAt:'2026-11-23T11:00:00Z',reason:'Holiday'});
  assert.equal(bad.status,422);
  const good=await f.call(exceptionPath,'POST',actor.token,{branchId:branch.body.id,kind:'CLOSED',
   startAt:'2026-11-23T10:00:00+03:30',endAt:'2026-11-23T11:00:00+03:30',reason:'Holiday'});
  assert.equal(good.status,201,JSON.stringify(good.body));
  assert.equal(good.body.startAt,'2026-11-23T06:30:00.000Z');
  assert.equal((await f.call(exceptionPath,'POST',actor.token,{branchId:branch.body.id,kind:'OPEN_OVERRIDE',
   startAt:'2026-11-23T10:30:00+03:30',endAt:'2026-11-23T11:30:00+03:30',reason:'Conflict'})).status,409);
  assert.equal((await f.call(`${exceptionPath}/${good.body.id}`,'PATCH',actor.token,{active:false})).status,200);
  const persisted=await f.owner.query<{active:boolean}>(`SELECT active FROM schedule_exceptions WHERE id=$1`,[good.body.id]);
  assert.equal(persisted.rows[0]?.active,false);
  await assert.rejects(()=>f.owner.query(`DELETE FROM schedule_exceptions WHERE id=$1`,[good.body.id]));
 }finally{await f.cleanup();}
});
