import {requireValue} from '../../src/common/require-value';
import test from 'node:test';import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {buildApplication} from '../../src/bootstrap';
import {parseConfig} from '../../src/config/app-config';
import {AccessTokenService} from '../../src/modules/identity/token.service';
const OWNER_URL=process.env.MIGRATION_DATABASE_URL;
if(!OWNER_URL||!process.env.DATABASE_URL)throw new Error('PHASE09_REAL_POSTGRESQL_URLS_REQUIRED');
const config=parseConfig({...process.env,NODE_ENV:'test'});
type Response={status:number;body:Record<string,unknown>};
async function setup(){
 const app=await buildApplication(config);await app.listen(0,'127.0.0.1');
 const url=`http://127.0.0.1:${(app.getHttpServer().address() as {port:number}).port}/api/v1`;
 const db=new Pool({connectionString:OWNER_URL,max:5});
 const tokens=app.get(AccessTokenService);
 async function actor(userId?:string){
  const id=userId??requireValue((await db.query<{id:string}>('INSERT INTO users(email) VALUES($1) RETURNING id',
   [`p09-${randomUUID()}@example.invalid`])).rows[0]).id;
  const session=requireValue((await db.query<{id:string}>(`INSERT INTO auth_sessions(user_id,expires_at)
    VALUES($1,clock_timestamp()+interval '7 days') RETURNING id`,[id])).rows[0]).id;
  return {id,token:tokens.issue(id,session),session};
 }
 async function call(path:string,method='GET',token?:string,body?:unknown,key?:string):Promise<Response>{
  const r=await fetch(url+path,{method,headers:{...(token?{authorization:`Bearer ${token}`}:{ }),
   ...(body!==undefined?{'content-type':'application/json'}:{}),...(key?{'idempotency-key':key}:{})},
   ...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const t=await r.text();return {status:r.status,body:t?JSON.parse(t) as Record<string,unknown>:{}};
 }
 async function org(token:string){const x=await call('/organizations','POST',token,{name:'P09 Gym',timezone:'Asia/Tehran'});
  assert.equal(x.status,201,JSON.stringify(x));return x.body.id as string;}
 return {db,app,actor,call,org,close:async()=>{await db.end();await app.close();}};
}
test('real PG: membership reactivation requires a fresh invitation and session', {timeout:90000},async()=>{
 const f=await setup();try{
  const owner=await f.actor(),manager=await f.actor(),trainer=await f.actor();
  const org=await f.org(owner.token),root=`/organizations/${org}`;
  const member=`${root}/members/${trainer.id}`;
  const accept=(session:string,token:unknown)=>f.call('/me/staff-invitations/accept','POST',session,{token});
  const issue=(userId:string,role:string)=>f.call(`${root}/staff-invitations`,'POST',owner.token,{userId,role});
  const managerInvite=await issue(manager.id,'MANAGER');
  assert.equal((await accept(manager.token,managerInvite.body.token)).status,200);
  const original=await issue(trainer.id,'TRAINER');
  assert.equal((await accept(trainer.token,original.body.token)).status,200);
  for(const body of [{role:null},{status:null},{role:'CUSTOMER'},{status:'SUSPENDED'},{}]){
   assert.equal((await f.call(member,'PATCH',owner.token,body)).status,400);
  }
  assert.equal((await f.call(member,'PATCH',manager.token,{role:'OWNER'})).status,403);
  assert.equal((await f.call(`${root}/members/${owner.id}`,'PATCH',owner.token,{status:'REVOKED'})).status,409);
  assert.equal((await f.call(member,'PATCH',owner.token,{role:'RECEPTIONIST'})).status,200);
  assert.equal((await f.call(member,'PATCH',owner.token,{status:'REVOKED'})).status,200);
  for(const admin of [owner,manager]){
   const denied=await f.call(member,'PATCH',admin.token,{status:'ACTIVE'});
   assert.equal(denied.status,409);assert.equal(denied.body.code,'STAFF_INVITATION_REQUIRED');
  }
  assert.equal((await f.call(root,'GET',trainer.token)).status,404);
  assert.equal((await accept(trainer.token,original.body.token)).status,409);
  const fresh=await f.actor(trainer.id);
  for(const fixture of [
   {created:'3 days',expires:'1 day',direction:'-',code:'INVITATION_EXPIRED'},
   {created:'1 hour',expires:'1 day',direction:'+',code:'INVITATION_STALE'},
  ]){
   const token=randomBytes(32).toString('base64url');
   const inserted=await f.db.query<{id:string}>(`INSERT INTO staff_invitations
    (tenant_id,invitee_id,invited_by,role,token_hash,created_at,expires_at)
    VALUES($1,$2,$3,'TRAINER',$4,clock_timestamp()-$5::interval,clock_timestamp()+$6::interval) RETURNING id`,
    [org,trainer.id,owner.id,createHash('sha256').update(token).digest('hex'),fixture.created,`${fixture.direction}${fixture.expires}`]);
   const result=await accept(fresh.token,token);
   assert.equal(result.status,409);assert.equal(result.body.code,fixture.code);
   if(fixture.code==='INVITATION_EXPIRED')await f.db.query(`UPDATE staff_invitations SET status='REVOKED',
    acted_at=clock_timestamp() WHERE id=$1`,[inserted.rows[0]?.id]);
  }
  const invite=await issue(trainer.id,'TRAINER');assert.equal(invite.status,201);
  const old=await accept(trainer.token,invite.body.token);
  assert.equal(old.status,401);assert.equal(old.body.code,'FRESH_SESSION_REQUIRED');
  assert.equal((await accept(fresh.token,invite.body.token)).status,200);
  assert.equal((await accept(fresh.token,invite.body.token)).status,409);
  assert.equal((await f.call(root,'GET',trainer.token)).status,401);
  assert.equal((await f.call(root,'GET',fresh.token)).status,200);
 }finally{await f.close();}
});
test('real PG: direct membership creation denied; invite acceptance is explicit, single-use and tenant scoped',
 {timeout:90000},async()=>{
 const f=await setup();try{
  const owner=await f.actor(),invitee=await f.actor(),stranger=await f.actor(),org=await f.org(owner.token);
  const old=await f.call(`/organizations/${org}/members`,'POST',owner.token,{userId:invitee.id,role:'TRAINER'});
  assert.equal(old.status,409);
  const [a,b]=await Promise.all(Array.from({length:2},()=>f.call(`/organizations/${org}/staff-invitations`,'POST',owner.token,{userId:invitee.id,role:'TRAINER'})));
  assert.ok(a&&b);
  assert.deepEqual([a.status,b.status].sort(),[201,409]);
  const token=(a.status===201?a.body.token:b.body.token) as string;
  assert.match(token,/^[A-Za-z0-9_-]{43}$/);
  const before=await f.db.query<{n:string}>(`SELECT count(*)::text AS n FROM memberships
    WHERE tenant_id=$1 AND user_id=$2 AND status='ACTIVE'`,[org,invitee.id]);assert.equal(before.rows[0]?.n,'0');
  const wrong=await f.call('/me/staff-invitations/accept','POST',stranger.token,{token});assert.equal(wrong.status,404);
  const [one,two]=await Promise.all(Array.from({length:2},()=>f.call('/me/staff-invitations/accept','POST',invitee.token,{token})));
  assert.ok(one&&two);
  assert.deepEqual([one.status,two.status].sort(),[200,409]);
  const after=await f.db.query<{n:string}>(`SELECT count(*)::text AS n FROM memberships
    WHERE tenant_id=$1 AND user_id=$2 AND status='ACTIVE' AND role='TRAINER'`,[org,invitee.id]);
  assert.equal(after.rows[0]?.n,'1');
  const list=await f.call(`/organizations/${org}/staff-invitations`,'GET',owner.token);
  assert.equal(list.status,200);assert.equal(JSON.stringify(list.body).includes(token),false);
 }finally{await f.close();}
});
test('real PG: revocation serializes a manager mutation and invitation resolution', {timeout:90000},async()=>{
 const f=await setup();try{
  const owner=await f.actor(),manager=await f.actor(),invitee=await f.actor(),org=await f.org(owner.token);
  const path=`/organizations/${org}`;
  const managerInvite=await f.call(`${path}/staff-invitations`,'POST',owner.token,{userId:manager.id,role:'MANAGER'});
  assert.equal((await f.call('/me/staff-invitations/accept','POST',manager.token,{token:managerInvite.body.token})).status,200);
  const [revoke,mutation]=await Promise.all([
   f.call(`${path}/members/${manager.id}`,'PATCH',owner.token,{status:'REVOKED'}),
   f.call(`${path}/branches`,'POST',manager.token,{name:'Racing branch'}),
  ]);
  assert.equal(revoke.status,200);
  assert.ok([201,404].includes(mutation.status),JSON.stringify(mutation));
  const result=await f.db.query<{status:string;branches:number;audit:number}>(`SELECT m.status,
   (SELECT count(*)::int FROM branches WHERE tenant_id=m.tenant_id) AS branches,
   (SELECT count(*)::int FROM audit_events WHERE tenant_id=m.tenant_id AND action='BranchCreated') AS audit
   FROM memberships m WHERE tenant_id=$1 AND user_id=$2`,[org,manager.id]);
  assert.deepEqual(result.rows[0],{status:'REVOKED',branches:mutation.status===201?1:0,audit:mutation.status===201?1:0});
  assert.equal((await f.call(`${path}/branches`,'POST',manager.token,{name:'After revocation'})).status,404);
  const issued=await f.call(`${path}/staff-invitations`,'POST',owner.token,{userId:invitee.id,role:'TRAINER'});
  assert.equal(issued.status,201);
  const [accept,withdraw]=await Promise.all([
   f.call('/me/staff-invitations/accept','POST',invitee.token,{token:issued.body.token}),
   f.call(`${path}/staff-invitations/${issued.body.id}/revoke`,'POST',owner.token,{reason:'Synthetic race drill'}),
  ]);
  assert.deepEqual([accept.status,withdraw.status].sort(),[200,409]);
  const winner=await f.db.query<{status:string;member:string|null}>(`SELECT i.status,m.status AS member
   FROM staff_invitations i LEFT JOIN memberships m ON m.tenant_id=i.tenant_id AND m.user_id=i.invitee_id
   WHERE i.tenant_id=$1 AND i.id=$2`,[org,issued.body.id]);
  assert.deepEqual(winner.rows[0],accept.status===200?{status:'ACCEPTED',member:'ACTIVE'}:{status:'REVOKED',member:null});
 }finally{await f.close();}
});
test('real PG: customer consent scopes staff booking and revocation serializes mutation',
 {timeout:90000},async()=>{
 const f=await setup();try{
  const owner=await f.actor(),customer=await f.actor(),other=await f.actor(),trainerActor=await f.actor(),org=await f.org(owner.token),
    foreign=await f.org(other.token);
  const branch=requireValue((await f.db.query<{id:string}>(`INSERT INTO branches(tenant_id,name)
    VALUES($1,'P09 Branch') RETURNING id`,[org])).rows[0]).id;
  const service=requireValue((await f.db.query<{id:string}>(`INSERT INTO services(tenant_id,title,duration_min)
    VALUES($1,'P09 Training',60) RETURNING id`,[org])).rows[0]).id;
  await f.db.query(`INSERT INTO memberships(tenant_id,user_id,role,status) VALUES($1,$2,'TRAINER','ACTIVE')`,[org,trainerActor.id]);
  await assert.rejects(()=>f.db.query(`INSERT INTO resources(tenant_id,type,trainer_user_id,display_name)
    VALUES($1,'TRAINER',$2,'Rejected Owner')`,[org,owner.id]),
    (error:unknown)=>Boolean(error&&typeof error==='object'&&'code' in error&&error.code==='23514'));
  const trainer=requireValue((await f.db.query<{id:string}>(`INSERT INTO resources(tenant_id,type,trainer_user_id,display_name)
    VALUES($1,'TRAINER',$2,'P09 Trainer') RETURNING id`,[org,trainerActor.id])).rows[0]).id;
  let startDay=10;
  async function newSession(){
   const start=new Date(Date.now()+startDay++*86400000);start.setUTCHours(10,0,0,0);
   const end=new Date(start.getTime()+3600000);
   const c=await f.db.connect();try{
    await c.query('BEGIN');
    const s=requireValue((await c.query<{id:string}>(`INSERT INTO sessions
      (tenant_id,branch_id,service_id,trainer_resource_id,start_at,end_at,timezone_snapshot,status,capacity_total,created_by)
      VALUES($1,$2,$3,$4,$5,$6,'Asia/Tehran','PUBLISHED',2,$7) RETURNING id`,
      [org,branch,service,trainer,start,end,owner.id])).rows[0]).id;
    await c.query(`INSERT INTO resource_allocations(tenant_id,session_id,resource_id,start_at,end_at)
      VALUES($1,$2,$3,$4,$5)`,[org,s,trainer,start,end]);
    await c.query('COMMIT');return s;
   }catch(err){await c.query('ROLLBACK');throw err;}finally{c.release();}
  }
  const s1=await newSession();
  const noConsent=await f.call(`/organizations/${org}/sessions/${s1}/bookings`,'POST',owner.token,{customerId:customer.id},randomUUID());
  assert.equal(noConsent.status,403);
  const foreignRequest=await f.call(`/organizations/${foreign}/booking-consents`,'POST',owner.token,{durationDays:5});
  assert.equal(foreignRequest.status,201);assert.equal(foreignRequest.body.customerId,owner.id);
  const grant=await f.call(`/organizations/${org}/booking-consents`,'POST',customer.token,{durationDays:10});
  assert.equal(grant.status,201,JSON.stringify(grant));const consentId=grant.body.id as string;
  const booked=await f.call(`/organizations/${org}/sessions/${s1}/bookings`,'POST',owner.token,{customerId:customer.id},randomUUID());
  assert.equal(booked.status,201,JSON.stringify(booked));
  const actual=await f.db.query<{customer_id:string;created_by_actor_id:string}>(`SELECT customer_id,created_by_actor_id
   FROM bookings WHERE tenant_id=$1 AND id=$2`,[org,booked.body.id]);
  assert.equal(actual.rows[0]?.customer_id,customer.id);assert.equal(actual.rows[0]?.created_by_actor_id,owner.id);
  const revoked=await f.call(`/organizations/${org}/booking-consents/${consentId}/revoke`,'POST',customer.token,{});
  assert.equal(revoked.status,200);
  const s2=await newSession();
  const later=await f.call(`/organizations/${org}/sessions/${s2}/bookings`,'POST',owner.token,{customerId:customer.id},randomUUID());
  assert.equal(later.status,403);
  const persisted=await f.db.query<{n:string}>(`SELECT count(*)::text AS n FROM bookings WHERE tenant_id=$1
   AND session_id=$2`,[org,s2]);assert.equal(persisted.rows[0]?.n,'0');
  const renewed=await f.call(`/organizations/${org}/booking-consents`,'POST',customer.token,{durationDays:1});
  assert.equal(renewed.status,201);
  const [withdraw,attempt]=await Promise.all([
   f.call(`/organizations/${org}/booking-consents/${renewed.body.id}/revoke`,'POST',customer.token,{}),
   f.call(`/organizations/${org}/sessions/${s2}/bookings`,'POST',owner.token,{customerId:customer.id},randomUUID()),
  ]);
  assert.equal(withdraw.status,200);
  assert.ok([201,403].includes(attempt.status),JSON.stringify(attempt));
  const race=await f.db.query(`SELECT c.revoked_at IS NOT NULL AS revoked,s.seats_committed,
   (SELECT count(*)::int FROM bookings b WHERE b.tenant_id=s.tenant_id AND b.session_id=s.id) AS bookings
   FROM sessions s JOIN booking_consents c ON c.tenant_id=s.tenant_id WHERE s.id=$1 AND c.id=$2`,[s2,renewed.body.id]);
  const committed=attempt.status===201?1:0;
  assert.deepEqual(race.rows[0],{revoked:true,seats_committed:committed,bookings:committed});
 }finally{await f.close();}
});
test('real PG: operator-only function and immutable consent identity reject direct tampering',
 {timeout:60000},async()=>{
 const f=await setup();try{
  const owner=await f.actor(),org=await f.org(owner.token),customer=await f.actor();
  const grant=await f.call(`/organizations/${org}/booking-consents`,'POST',customer.token,{durationDays:2});
  assert.equal(grant.status,201);const id=grant.body.id;
  const permission=await f.db.query<{api_can_requeue:boolean}>(`SELECT has_function_privilege('bookcore_app',
    'public.bookcore_requeue_outbox(uuid,uuid,uuid,text)','EXECUTE') AS api_can_requeue`);
  assert.equal(permission.rows[0]?.api_can_requeue,false);
  await assert.rejects(()=>f.db.query(`UPDATE booking_consents SET customer_id=$1 WHERE id=$2`,[owner.id,id]),
   (e:unknown)=>Boolean(e&&typeof e==='object'&&'code' in e&&e.code==='23514'));
  const history=await f.db.query<{n:string}>(`SELECT count(*)::text AS n FROM outbox_events
   WHERE tenant_id=$1 AND event_type='BookingConsentGranted'`,[org]);assert.equal(history.rows[0]?.n,'1');
 }finally{await f.close();}
});
test('real PG: lost invitation response recoverable through metadata list, revoke, and fresh issue',
 {timeout:90000},async()=>{
 const f=await setup();try{
  const owner=await f.actor(),invitee=await f.actor(),org=await f.org(owner.token);
  const one=await f.call(`/organizations/${org}/staff-invitations`,'POST',owner.token,
   {userId:invitee.id,role:'TRAINER'});
  assert.equal(one.status,201,JSON.stringify(one));
  // Simulate lost HTTP body: recovery must not query for the hash or recover raw token.
  const listing=await f.call(`/organizations/${org}/staff-invitations`,'GET',owner.token);
  assert.equal(listing.status,200);
  assert.equal(JSON.stringify(listing.body).includes(String(one.body.token)),false);
  const revoke=await f.call(`/organizations/${org}/staff-invitations/${one.body.id}/revoke`,'POST',owner.token,
   {reason:'Original invitation response lost before secure delivery'});
  assert.equal(revoke.status,200);
  const two=await f.call(`/organizations/${org}/staff-invitations`,'POST',owner.token,
   {userId:invitee.id,role:'TRAINER'});
  assert.equal(two.status,201,JSON.stringify(two));
  assert.notEqual(two.body.token,one.body.token);
  const stale=await f.call('/me/staff-invitations/accept','POST',invitee.token,{token:one.body.token});
  assert.equal(stale.status,409);
  const fresh=await f.call('/me/staff-invitations/accept','POST',invitee.token,{token:two.body.token});
  assert.equal(fresh.status,200);
  const audit=await f.db.query<{count:string}>(`SELECT count(*)::text AS count FROM audit_events
    WHERE tenant_id=$1 AND action IN('StaffInvitationCreated','StaffInvitationRevoked','StaffInvitationAccepted')`,[org]);
  assert.equal(audit.rows[0]?.count,'4');
 }finally{await f.close();}
});
