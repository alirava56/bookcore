import {requireValue} from '../../src/common/require-value';
import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';import {Pool} from 'pg';
import {scanTenant} from '../../../../scripts/operational-inspection-v2';
/** These tests MUST run against a disposable PostgreSQL 17 database with migrations 001-012 applied.
 *  They intentionally fail closed when connection credentials are absent. Do NOT run on live customer data.
 */
if(process.env.BOOKCORE_TEST_DATABASE_DISPOSABLE!=='yes'||!process.env.MIGRATION_DATABASE_URL||
 !process.env.BOOKCORE_INSPECT_DATABASE_URL||!process.env.BOOKCORE_INSPECT_UNBOUND_DATABASE_URL)
 throw new Error('PHASE11_DISPOSABLE_POSTGRESQL17_AND_SEPARATE_INSPECTOR_LOGIN_REQUIRED');
process.env.BOOKCORE_INSPECTION_CURSOR_KEY ??= randomBytes(32).toString('base64url');
const adminUrl=requireValue(process.env.MIGRATION_DATABASE_URL);
async function fixture(){
 const admin=new Pool({connectionString:adminUrl,max:3});
 const inspector=new Pool({connectionString:process.env.BOOKCORE_INSPECT_DATABASE_URL,max:1});
 const owner=requireValue((await admin.query<{id:string}>(`INSERT INTO users(email) VALUES($1) RETURNING id`,
  [`p11-owner-${randomUUID()}@example.invalid`])).rows[0]).id;
 const tenant=requireValue((await admin.query<{id:string}>(`INSERT INTO organizations(name) VALUES('P11 Disposable Fixture') RETURNING id`)).rows[0]).id;
 await admin.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')`,[tenant,owner]);
 const login=requireValue((await inspector.query<{login:string}>(`SELECT session_user::text AS login`)).rows[0]).login;
 await admin.query(`INSERT INTO bookcore_operator_identities(login_role,actor_user_id,enabled)
    VALUES($1,$2,true) ON CONFLICT(login_role) DO UPDATE SET actor_user_id=excluded.actor_user_id,enabled=true`,[login,owner]);
 return {admin,inspector,owner,tenant,login,close:async()=>{await Promise.all([admin.end(),inspector.end()]);}};
}
test('Phase11 PostgreSQL: >100 consents traverse via signed cursor without skipped records',
 {timeout:150000},async()=>{
 const f=await fixture();try{
  for(let i=0;i<105;i++){
   const customer=requireValue((await f.admin.query<{id:string}>(`INSERT INTO users(email) VALUES($1) RETURNING id`,
     [`p11-consent-${randomUUID()}@example.invalid`])).rows[0]).id;
   await f.admin.query(`INSERT INTO booking_consents(tenant_id,customer_id,expires_at)
       VALUES($1,$2,clock_timestamp()+interval '10 days')`,[f.tenant,customer]);
  }
  const opts={tenant:f.tenant,kind:'CONSENT' as const,limit:20,maxPages:2,all:false};
  const first=await scanTenant(opts);
  assert.equal(first.scanned,40);assert.deepEqual(first.incompleteKinds,['CONSENT']);
  assert.ok(first.cursors.CONSENT);
  const rest=await scanTenant({...opts,maxPages:5,cursor:first.cursors.CONSENT});
  assert.equal(first.scanned+rest.scanned,105);
  assert.deepEqual(rest.completedKinds,['CONSENT']);
  assert.equal(rest.incompleteKinds.length,0);
  assert.equal(rest.asOf,first.asOf);
  assert.equal(rest.consistentSnapshot,false);
  assert.equal(rest.certifiedIntegrity,false);
 }finally{await f.close();}
});
test('Phase11 PostgreSQL: scope-denied inspector login, revoked binding and suspended owner',
 {timeout:60000},async()=>{
 const f=await fixture();try{
  const opts={tenant:f.tenant,kind:'SESSION' as const,limit:10,maxPages:1,all:false};
  const foreign=requireValue((await f.admin.query<{id:string}>(`INSERT INTO organizations(name) VALUES('P11 Other Tenant') RETURNING id`)).rows[0]).id;
  await assert.rejects(()=>scanTenant({...opts,tenant:foreign}));
  await f.admin.query(`UPDATE bookcore_operator_identities SET enabled=false WHERE login_role=$1`,[f.login]);
  await assert.rejects(()=>scanTenant(opts));
  await f.admin.query(`UPDATE bookcore_operator_identities SET enabled=true WHERE login_role=$1`,[f.login]);
  await f.admin.query(`UPDATE users SET status='SUSPENDED' WHERE id=$1`,[f.owner]);
  await assert.rejects(()=>scanTenant(opts));
  await f.admin.query(`UPDATE users SET status='ACTIVE' WHERE id=$1`,[f.owner]);
  const replacementOwner=requireValue((await f.admin.query<{id:string}>(`INSERT INTO users(email) VALUES($1) RETURNING id`,
   [`p12-replacement-owner-${randomUUID()}@example.invalid`])).rows[0]).id;
  await f.admin.query(`INSERT INTO memberships(tenant_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
   [f.tenant,replacementOwner]);
  await f.admin.query(`UPDATE memberships SET status='REVOKED',revoked_at=clock_timestamp()
    WHERE tenant_id=$1 AND user_id=$2`,[f.tenant,f.owner]);
  await assert.rejects(()=>scanTenant(opts));
 }finally{await f.close();}
});
test('Phase11 PostgreSQL: no unauthenticated EXECUTE; GUC or SET ROLE cannot forge session_user',
 {timeout:60000},async()=>{
 const f=await fixture();try{
  const access=await f.admin.query<{api:boolean;worker:boolean;inspector:boolean}>(`
   SELECT has_function_privilege('bookcore_app',
     'public.bookcore_inspect_tenant_page(uuid,text,text,timestamptz,int)','EXECUTE') AS api,
    has_function_privilege('bookcore_worker',
     'public.bookcore_inspect_tenant_page(uuid,text,text,timestamptz,int)','EXECUTE') AS worker,
    has_function_privilege('bookcore_inspector',
     'public.bookcore_inspect_tenant_page(uuid,text,text,timestamptz,int)','EXECUTE') AS inspector`);
  assert.deepEqual(access.rows[0],{api:false,worker:false,inspector:true});
  await f.inspector.query(`SELECT set_config('bookcore.actor_id',$1,false)`,[randomUUID()]);
  assert.equal((await f.inspector.query<{login:string}>(`SELECT session_user::text AS login`)).rows[0]?.login,f.login);
  const result=await scanTenant({tenant:f.tenant,kind:'SESSION',limit:1,maxPages:1,all:false});
  assert.equal(result.tenantId,f.tenant);
  const caller=new Pool({connectionString:adminUrl,max:1});
  try{
   const sessionLogin=(await caller.query<{login:string}>(`SELECT session_user::text AS login`)).rows[0]?.login;
   try{await caller.query(`SET ROLE bookcore_inspector`);}catch{/* a rejected SET ROLE is safe too */}
   const after=(await caller.query<{login:string}>(`SELECT session_user::text AS login`)).rows[0]?.login;
   assert.equal(after,sessionLogin,'SET ROLE must not alter authenticated LOGIN');
  }finally{await caller.end();}
 }finally{await f.close();}
});
test('Phase11 PostgreSQL: legacy sample API remains read-only and explicitly incomplete',
 {timeout:45000},async()=>{
 const f=await fixture();try{
  await f.inspector.query('BEGIN READ ONLY');
  try{
   const r=await f.inspector.query<{sample:{readOnly:boolean;completeScan:boolean;legacySampleOnly:boolean}}>(
    `SELECT public.bookcore_inspect_tenant($1::uuid,2) AS sample`,[f.tenant]);
   assert.equal(r.rows[0]?.sample.readOnly,true);
   assert.equal(r.rows[0]?.sample.completeScan,false);
   assert.equal(r.rows[0]?.sample.legacySampleOnly,true);
   await f.inspector.query('COMMIT');
  }catch(err){await f.inspector.query('ROLLBACK');throw err;}
 }finally{await f.close();}
});


test('Phase11 PostgreSQL: unbound LOGIN must not inspect even if granted inspector group',
 {timeout:45000},async()=>{
 const f=await fixture();const unbound=new Pool({connectionString:process.env.BOOKCORE_INSPECT_UNBOUND_DATABASE_URL,max:1});
 try{
  await assert.rejects(()=>unbound.query(
   `SELECT public.bookcore_inspect_tenant_page($1,'SESSION',NULL,NULL,10)`,[f.tenant]));
  await assert.rejects(()=>unbound.query(`SELECT * FROM public.audit_events LIMIT 1`));
 }finally{await unbound.end();await f.close();}
});
test('Phase11 PostgreSQL: registry bound to unrelated user cannot impersonate tenant owner',
 {timeout:45000},async()=>{
 const f=await fixture();try{
  const outsider=requireValue((await f.admin.query<{id:string}>(`INSERT INTO users(email) VALUES($1) RETURNING id`,
   [`p11-outsider-${randomUUID()}@example.invalid`])).rows[0]).id;
  await f.admin.query(`UPDATE bookcore_operator_identities SET actor_user_id=$2 WHERE login_role=$1`,[f.login,outsider]);
  await assert.rejects(()=>scanTenant({tenant:f.tenant,kind:'SESSION',limit:10,maxPages:1,all:false}));
 }finally{await f.close();}
});
test('Phase11 PostgreSQL: immutable AuditEvent cannot be modified directly',
 {timeout:45000},async()=>{
 const f=await fixture();try{
  const event=requireValue((await f.admin.query<{id:string}>(`INSERT INTO audit_events
   (tenant_id,actor_id,action,aggregate_type,aggregate_id,metadata)
   VALUES($1,$2,'PHASE11_TEST','ORGANIZATION',$1,'{}') RETURNING id`,[f.tenant,f.owner])).rows[0]).id;
  await assert.rejects(()=>f.admin.query(`UPDATE audit_events SET action='FORGED' WHERE id=$1`,[event]));
  await assert.rejects(()=>f.admin.query(`DELETE FROM audit_events WHERE id=$1`,[event]));
 }finally{await f.close();}
});

test('Phase11 PostgreSQL: real BookingEvent chain is read by event_order; invalid extra transition rejected',
 {timeout:75000},async()=>{
 const f=await fixture();try{
  const trainer=requireValue((await f.admin.query<{id:string}>(`INSERT INTO users(email) VALUES($1) RETURNING id`,
   [`p11-trainer-${randomUUID()}@example.invalid`])).rows[0]).id;
  const customer=requireValue((await f.admin.query<{id:string}>(`INSERT INTO users(email) VALUES($1) RETURNING id`,
   [`p11-customer-${randomUUID()}@example.invalid`])).rows[0]).id;
  await f.admin.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'TRAINER')`,[f.tenant,trainer]);
  const branch=requireValue((await f.admin.query<{id:string}>(`INSERT INTO branches(tenant_id,name) VALUES($1,'Inspection Branch') RETURNING id`,[f.tenant])).rows[0]).id;
  const service=requireValue((await f.admin.query<{id:string}>(`INSERT INTO services(tenant_id,title,duration_min)
    VALUES($1,'Inspection Session',60) RETURNING id`,[f.tenant])).rows[0]).id;
  const resource=requireValue((await f.admin.query<{id:string}>(`INSERT INTO resources(tenant_id,type,trainer_user_id,display_name)
    VALUES($1,'TRAINER',$2,'Inspection Trainer') RETURNING id`,[f.tenant,trainer])).rows[0]).id;
  const c=await f.admin.connect();let bid:string|undefined;
  try{
   await c.query('BEGIN');
   const session=requireValue((await c.query<{id:string}>(`INSERT INTO sessions
    (tenant_id,branch_id,service_id,trainer_resource_id,start_at,end_at,timezone_snapshot,capacity_total,created_by)
    VALUES($1,$2,$3,$4,clock_timestamp()+interval '10 days',clock_timestamp()+interval '10 days 1 hour',
     'Asia/Tehran',1,$5) RETURNING id`,[f.tenant,branch,service,resource,f.owner])).rows[0]);
   await c.query(`INSERT INTO resource_allocations(tenant_id,session_id,resource_id,start_at,end_at)
     SELECT tenant_id,id,trainer_resource_id,start_at,end_at FROM sessions WHERE tenant_id=$1 AND id=$2`,[f.tenant,session.id]);
   await c.query(`UPDATE sessions SET status='PUBLISHED' WHERE tenant_id=$1 AND id=$2`,[f.tenant,session.id]);
   bid=requireValue((await c.query<{id:string}>(`INSERT INTO bookings(tenant_id,session_id,customer_id,created_by_actor_id)
     VALUES($1,$2,$3,$4) RETURNING id`,[f.tenant,session.id,customer,f.owner])).rows[0]).id;
   await c.query(`UPDATE sessions SET seats_committed=1 WHERE tenant_id=$1 AND id=$2`,[f.tenant,session.id]);
   await c.query(`INSERT INTO booking_events(tenant_id,booking_id,from_status,to_status,actor_id)
      VALUES($1,$2,NULL,'CONFIRMED',$3)`,[f.tenant,bid,f.owner]);
   await c.query(`UPDATE bookings SET status='CANCELLED',cancelled_at=clock_timestamp(),
       cancel_reason='Test cancellation' WHERE tenant_id=$1 AND id=$2`,[f.tenant,bid]);
   await c.query(`UPDATE sessions SET seats_committed=0 WHERE tenant_id=$1 AND id=$2`,[f.tenant,session.id]);
   await c.query(`INSERT INTO booking_events(tenant_id,booking_id,from_status,to_status,actor_id,reason)
      VALUES($1,$2,'CONFIRMED','CANCELLED',$3,'Test cancellation')`,[f.tenant,bid,f.owner]);
   await c.query('COMMIT');
  }catch(err){await c.query('ROLLBACK');throw err;}finally{c.release();}
  const history=await f.admin.query<{event_order:string;to_status:string}>(`SELECT event_order::text,to_status
    FROM booking_events WHERE booking_id=$1 ORDER BY event_order`,[bid]);
  assert.deepEqual(history.rows.map(r=>r.to_status),['CONFIRMED','CANCELLED']);
  const result=await scanTenant({tenant:f.tenant,kind:'BOOKING',limit:20,maxPages:2,all:false});
  assert.ok(!result.findings.some(v=>v.id===bid),JSON.stringify(result.findings));
  await assert.rejects(()=>f.admin.query(`INSERT INTO booking_events
    (tenant_id,booking_id,from_status,to_status,actor_id) VALUES($1,$2,'CANCELLED','ATTENDED',$3)`,
    [f.tenant,bid,f.owner]));
 }finally{await f.close();}
});

test('Phase12 PostgreSQL: last active OWNER cannot be revoked; original security trigger is retained',
 {timeout:45000},async()=>{
 const f=await fixture();try{
  await assert.rejects(()=>f.admin.query(`UPDATE memberships SET status='REVOKED',revoked_at=clock_timestamp()
    WHERE tenant_id=$1 AND user_id=$2`,[f.tenant,f.owner]), {code:'23514'});
  const check=await f.admin.query<{n:string}>(`SELECT count(*)::text AS n FROM memberships
    WHERE tenant_id=$1 AND role='OWNER' AND status='ACTIVE'`,[f.tenant]);
  assert.equal(requireValue(check.rows[0]).n,'1');
 }finally{await f.close();}
});
