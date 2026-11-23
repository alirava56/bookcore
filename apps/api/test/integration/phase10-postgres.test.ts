import {requireValue} from '../../src/common/require-value';
import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {setTimeout as delay} from 'node:timers/promises';
import {inspect} from '../../../../scripts/operational-integrity';
import {pruneRateBuckets} from '../../../../scripts/lifecycle-maintenance';
/** Real PostgreSQL only. Role-specific connection strings are REQUIRED, never mocked. */
const ownerUrl=process.env.MIGRATION_DATABASE_URL;
const opsUrl=process.env.OUTBOX_OPS_DATABASE_URL;
const inspectUrl=process.env.BOOKCORE_INSPECT_DATABASE_URL;
const maintainUrl=process.env.BOOKCORE_MAINTENANCE_DATABASE_URL;
if(!ownerUrl||!opsUrl||!inspectUrl||!maintainUrl)
 throw new Error('PHASE10_REAL_POSTGRESQL_ROLE_URLS_REQUIRED');
async function fixture(){
 const admin=new Pool({connectionString:ownerUrl,max:3});
 const ops=new Pool({connectionString:opsUrl,max:2});
 const insp=new Pool({connectionString:inspectUrl,max:2});
 const maint=new Pool({connectionString:maintainUrl,max:2});
 const owner=requireValue((await admin.query<{id:string}>(`INSERT INTO users(email) VALUES($1) RETURNING id`,
  [`p10-${randomUUID()}@example.invalid`])).rows[0]).id;
 const tenant=requireValue((await admin.query<{id:string}>(`INSERT INTO organizations(name) VALUES('P10 Fixture') RETURNING id`)).rows[0]).id;
 await admin.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')`,[tenant,owner]);
 for(const rolePool of [ops,insp,maint]){
  const actual=requireValue((await rolePool.query<{login:string}>(`SELECT session_user::text AS login`)).rows[0]).login;
  await admin.query(`INSERT INTO bookcore_operator_identities(login_role,actor_user_id,enabled)
     VALUES($1,$2,true) ON CONFLICT(login_role) DO UPDATE SET actor_user_id=excluded.actor_user_id,
     enabled=true`,[actual,owner]);
 }
 return {admin,ops,insp,maint,owner,tenant,close:async()=>{
  await Promise.all([admin.end(),ops.end(),insp.end(),maint.end()]);}};
}
test('PostgreSQL permissions: legacy spoofable requeue function disabled for ops and API',
 {timeout:45000},async()=>{
 const f=await fixture();try{
  const r=await f.admin.query<{api_old:boolean;ops_old:boolean;api_new:boolean;ops_new:boolean}>(`
    SELECT has_function_privilege('bookcore_app','public.bookcore_requeue_outbox(uuid,uuid,uuid,text)','EXECUTE') AS api_old,
     has_function_privilege('bookcore_ops','public.bookcore_requeue_outbox(uuid,uuid,uuid,text)','EXECUTE') AS ops_old,
     has_function_privilege('bookcore_app','public.bookcore_requeue_outbox_bound(uuid,uuid,text)','EXECUTE') AS api_new,
     has_function_privilege('bookcore_ops','public.bookcore_requeue_outbox_bound(uuid,uuid,text)','EXECUTE') AS ops_new`);
  assert.deepEqual(r.rows[0],{api_old:false,ops_old:false,api_new:false,ops_new:true});
 }finally{await f.close();}
});
test('PostgreSQL identity binding: requeue audit uses session_user mapping, not supplied UUID',
 {timeout:45000},async()=>{
 const f=await fixture();try{
  const event=requireValue((await f.admin.query<{id:string}>(`INSERT INTO outbox_events
   (tenant_id,aggregate_type,aggregate_id,event_type,payload,failed_at,last_error_code)
   VALUES($1,'ORGANIZATION',$1,'OrganizationCreated','{}'::jsonb,clock_timestamp(),'HANDLER_ERROR')
   RETURNING id`,[f.tenant])).rows[0]).id;
  const valid=await f.ops.query<{requeued:boolean}>(
   `SELECT bookcore_requeue_outbox_bound($1,$2,'Reissue failed event after investigation') AS requeued`,[f.tenant,event]);
  assert.equal(valid.rows[0]?.requeued,true);
  const changed=await f.admin.query<{failed_at:Date|null}>(`SELECT failed_at FROM outbox_events WHERE id=$1`,[event]);
  assert.equal(changed.rows[0]?.failed_at,null);
  const audited=await f.admin.query<{actor_id:string}>(`SELECT actor_id FROM audit_events
   WHERE tenant_id=$1 AND action='OUTBOX_REQUEUED' AND aggregate_id=$2`,[f.tenant,event]);
  assert.equal(audited.rows[0]?.actor_id,f.owner);
  const unauthorized=await f.admin.query<{n:string}>(`SELECT count(*)::text AS n FROM audit_events
    WHERE tenant_id=$1 AND aggregate_id=$2 AND actor_id<>$3`,[f.tenant,event,f.owner]);
  assert.equal(unauthorized.rows[0]?.n,'0');
 }finally{await f.close();}
});
test('PostgreSQL read-only inspection cannot inspect unrelated organization',
 {timeout:45000},async()=>{
 const f=await fixture();try{
  const r=await inspect(f.tenant,25) as {readOnly:boolean;completeScan:boolean;findings:unknown[]};
  assert.equal(r.readOnly,true);assert.equal(r.completeScan,false);assert.ok(Array.isArray(r.findings));
  const foreign=requireValue((await f.admin.query<{id:string}>(`INSERT INTO organizations(name) VALUES('P10 Foreign') RETURNING id`)).rows[0]).id;
  await assert.rejects(()=>inspect(foreign,25));
 }finally{await f.close();}
});
test('PostgreSQL: operator binding revocation serializes with privileged recovery',
 {timeout:45000},async()=>{
 const f=await fixture(),admin=await f.admin.connect(),ops=await f.ops.connect();
 try{
  const identity=requireValue((await ops.query<{login:string;pid:number}>(
   'SELECT session_user::text AS login,pg_backend_pid() AS pid')).rows[0]);
  const event=requireValue((await admin.query<{id:string}>(`INSERT INTO outbox_events
   (tenant_id,aggregate_type,aggregate_id,event_type,payload,failed_at,last_error_code)
   VALUES($1,'ORGANIZATION',$1,'OrganizationCreated','{}',clock_timestamp(),'HANDLER_ERROR') RETURNING id`,[f.tenant])).rows[0]);
  await admin.query('BEGIN');
  await admin.query(`UPDATE bookcore_operator_identities SET enabled=false WHERE login_role=$1`,[identity.login]);
  const recovery=ops.query(`SELECT bookcore_requeue_outbox_bound($1,$2,'Concurrent operator revocation drill')`,[f.tenant,event.id]);
  const denied=recovery.then(()=>null,(error:unknown)=>error);
  let waiting=false;
  for(let i=0;i<40&&!waiting;i++){
   const state=await f.admin.query<{waiting:boolean}>(`SELECT wait_event_type='Lock' AS waiting FROM pg_stat_activity WHERE pid=$1`,[identity.pid]);
   waiting=state.rows[0]?.waiting===true;if(!waiting)await delay(25);
  }
  await admin.query('COMMIT');
  assert.equal(waiting,true,'requeue must serialize on the operator binding');
  assert.ok((await denied) instanceof Error);
  await assert.rejects(recovery,{code:'42501'});
  const state=await admin.query(`SELECT e.failed_at IS NOT NULL AS quarantined,
   EXISTS(SELECT 1 FROM audit_events a WHERE a.tenant_id=e.tenant_id AND a.aggregate_id=e.id AND a.action='OUTBOX_REQUEUED') AS changed
   FROM outbox_events e WHERE id=$1`,[event.id]);
  assert.deepEqual(state.rows[0],{quarantined:true,changed:false});
 }finally{await admin.query('ROLLBACK');admin.release();ops.release();await f.close();}
});
test('PostgreSQL maintenance: bounded deletion, at least 48h old, produces immutable audit',
 {timeout:45000},async()=>{
 const f=await fixture();try{
  const old=randomUUID().replace(/-/g,'').padEnd(64,'0');
  const recent=randomUUID().replace(/-/g,'').padEnd(64,'1');
  await f.admin.query(`INSERT INTO auth_rate_limits(key_hash,bucket_start,count)
   VALUES($1,clock_timestamp()-interval '10 days',1),($2,clock_timestamp(),1)`,[old,recent]);
  const preview=await pruneRateBuckets(1,48,'Operational retention validation',false);
  assert.equal(preview.apply,false);assert.ok(preview.affected>=1);
  const applied=await pruneRateBuckets(1,48,'Operational retention validation',true);
  assert.equal(applied.affected,1);
  const remaining=await f.admin.query<{n:string}>(`SELECT count(*)::text AS n FROM auth_rate_limits WHERE key_hash=$1`,[recent]);
  assert.equal(remaining.rows[0]?.n,'1');
  const a=await f.admin.query<{n:string}>(`SELECT count(*)::text AS n FROM bookcore_maintenance_audit
    WHERE action='AUTH_RATE_BUCKET_PRUNED' AND actor_user_id=$1`,[f.owner]);
  assert.ok(Number(a.rows[0]?.n)>=1);
  await assert.rejects(()=>f.admin.query(`DELETE FROM bookcore_maintenance_audit WHERE actor_user_id=$1`,[f.owner]));
 }finally{await f.close();}
});
