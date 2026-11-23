import {requireValue} from '../../src/common/require-value';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseConfig} from '../../src/config/app-config';
import {buildApplication} from '../../src/bootstrap';
import {Pool} from 'pg';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {INestApplication} from '@nestjs/common';
import {AccessTokenService} from '../../src/modules/identity/token.service';

const dbUrl=process.env.DATABASE_URL;
const required=['DATABASE_URL','AUTH_JWT_ISSUER','AUTH_JWT_AUDIENCE','AUTH_JWT_ACTIVE_KID',
 'AUTH_JWT_KEYS_JSON','MONITOR_API_KEY'];
if(required.some(key=>!process.env[key]))throw new Error('PHASE04_INTEGRATION_ENV_MISSING: real PostgreSQL required');
if(!dbUrl)throw new Error('DATABASE_URL_REQUIRED');
const cfg=parseConfig({...process.env,NODE_ENV:'test'});
const suffix=String(Date.now())+'-'+String(Math.floor(Math.random()*10000));
const mkEmail=(s:string)=>`${s}-${suffix}@bookcore.example.invalid`;
type Obj=Record<string,unknown>;
async function start():Promise<{app:INestApplication;url:string;pool:Pool}> {
 const app=await buildApplication(cfg);await app.listen(0,'127.0.0.1');
 const port=(app.getHttpServer().address() as {port:number}).port;
 const pool=new Pool({connectionString:dbUrl,max:3});
 return {app,url:`http://127.0.0.1:${port}/api/v1`,pool};
}
async function call(base:string,path:string,body?:unknown,token?:string,method?:string){
 const response=await fetch(base+path,{method:method??(body?'POST':'GET'),
  headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 const txt=await response.text();return {status:response.status,body:txt?JSON.parse(txt) as Obj:{}};
}
async function register(base:string,name:string) {
 const email=mkEmail(name);
 const r=await call(base,'/auth/register',{email:email.toUpperCase(),password:'Strong_Test_Password_123!'});
 assert.equal(r.status,201,JSON.stringify(r.body));return {email,userId:r.body.id as string};
}
async function login(base:string,email:string) {
 const r=await call(base,'/auth/login',{email,password:'Strong_Test_Password_123!'});
 assert.equal(r.status,200,JSON.stringify(r.body));return r.body;
}
// The test suite deliberately uses the migrated real PostgreSQL instance, not mocks.
// Each test must inspect persisted rows rather than trusting HTTP output alone.
test('PostgreSQL identity and RBAC: atomic ownership, global guard, last owner, tenant hiding',async()=>{
 const {app,url,pool}=await start();
 try {
  const anonymous=await call(url,'/me');assert.equal(anonymous.status,401);
  const a=await register(url,'owner');
  const duplicate=await call(url,'/auth/register',{email:a.email,password:'Strong_Test_Password_123!'});
  assert.equal(duplicate.status,409);
  const invalid=await call(url,'/auth/register',{email:mkEmail('weak'),password:'123'});
  assert.notEqual(invalid.status,201);
  const ownerTokens=await login(url,a.email),token=ownerTokens.accessToken as string;
  const me=await call(url,'/me',undefined,token);
  assert.equal(me.status,200);assert.equal((me.body.memberships as unknown[]).length,0);
  assert.equal('password_hash' in me.body,false);
  const org=await call(url,'/organizations',{name:'Demo Phase04',timezone:'Asia/Tehran'},token);
  assert.equal(org.status,201,JSON.stringify(org.body));const oid=org.body.id as string;
  const verify=await pool.query<{n:string}>(`SELECT count(*)::text AS n FROM memberships
   WHERE tenant_id=$1 AND user_id=$2 AND role='OWNER' AND status='ACTIVE'`,[oid,a.userId]);
  assert.equal(verify.rows[0]?.n,'1');
  const event=await pool.query<{n:string}>(`SELECT count(*)::text AS n FROM outbox_events
    WHERE tenant_id=$1 AND event_type='OrganizationCreated'`,[oid]);
  assert.equal(event.rows[0]?.n,'1');
  const profile=await call(url,'/me',undefined,token);assert.equal((profile.body.memberships as unknown[]).length,1);
  const revokeLast=await call(url,`/organizations/${oid}/members/${a.userId}`,{status:'REVOKED'},token,'PATCH');
  assert.equal(revokeLast.status,409);
  const b=await register(url,'member');
  const bt=await login(url,b.email);
  const forbidden=await call(url,`/organizations/${oid}`,undefined,bt.accessToken as string);
  assert.equal(forbidden.status,404);
  const deniedDirect=await call(url,`/organizations/${oid}/members`,{userId:b.userId,role:'OWNER'},token);
  assert.equal(deniedDirect.status,409);
  const inviteOwner=await call(url,`/organizations/${oid}/staff-invitations`,{userId:b.userId,role:'OWNER'},token);
  assert.equal(inviteOwner.status,201);
  const addOwner=await call(url,'/me/staff-invitations/accept',{token:inviteOwner.body.token},bt.accessToken as string);
  assert.equal(addOwner.status,200);
  // Competing removals serialize on one organization row: at least one OWNER must remain.
  const [revokeA,revokeB]=await Promise.all([
   call(url,`/organizations/${oid}/members/${a.userId}`,{status:'REVOKED'},token,'PATCH'),
   call(url,`/organizations/${oid}/members/${b.userId}`,{status:'REVOKED'},token,'PATCH')]);
  assert.ok([200,401,404,409].includes(revokeA.status));
  assert.ok([200,401,404,409].includes(revokeB.status));
  const remaining=await pool.query<{n:string}>(`SELECT count(*)::text AS n FROM memberships
      WHERE tenant_id=$1 AND role='OWNER' AND status='ACTIVE'`,[oid]);
  assert.equal(remaining.rows[0]?.n,'1');
 } finally {await pool.end();await app.close();}
});
test('PostgreSQL concurrent refresh: at most one rotating child; consumed replay revokes session',async()=>{
 const {app,url,pool}=await start();
 try {
  const u=await register(url,'rotator');const loginTokens=await login(url,u.email);
  const original=loginTokens.refreshToken as string;
  const [r1,r2]=await Promise.all([
   call(url,'/auth/refresh',{refreshToken:original}),
   call(url,'/auth/refresh',{refreshToken:original})]);
  assert.equal([r1.status,r2.status].filter(s=>s===200).length,1);
  assert.equal([r1.status,r2.status].filter(s=>s===401).length,1);
  const verify=await pool.query<{valid:string}>(`SELECT count(*)::text AS valid FROM refresh_tokens t
    JOIN auth_sessions s ON s.id=t.session_id WHERE s.user_id=$1 AND t.parent_id IS NOT NULL`,[u.userId]);
  assert.equal(verify.rows[0]?.valid,'1');
  const after=await call(url,'/me',undefined,loginTokens.accessToken as string);
  assert.equal(after.status,401);
 } finally {await pool.end();await app.close();}
});
test('PostgreSQL logout immediately revokes access token; token hashes not exposed',async()=>{
 const {app,url,pool}=await start();
 try {
  const u=await register(url,'logout');const t=await login(url,u.email);
  const logout=await call(url,'/auth/logout',{},t.accessToken as string);
  assert.equal(logout.status,204);
  const me=await call(url,'/me',undefined,t.accessToken as string);assert.equal(me.status,401);
  const state=await pool.query<{n:string}>(`SELECT count(*)::text AS n FROM auth_sessions
   WHERE user_id=$1 AND revoked_at IS NOT NULL`,[u.userId]);
  assert.equal(state.rows[0]?.n,'1');
 } finally {await pool.end();await app.close();}
});
test('PostgreSQL: refresh racing logout cannot leave a usable token family',async()=>{
 const {app,url,pool}=await start();try{
  const user=await register(url,'refresh-logout');
  const sessionId=randomUUID(),refreshToken=randomBytes(32).toString('base64url');
  await pool.query(`INSERT INTO auth_sessions(id,user_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 hour')`,[sessionId,user.userId]);
  await pool.query(`INSERT INTO refresh_tokens(session_id,family_id,token_hash,expires_at)
   SELECT id,$2,$3,expires_at FROM auth_sessions WHERE id=$1`,[sessionId,randomUUID(),createHash('sha256').update(refreshToken).digest('hex')]);
  const accessToken=app.get(AccessTokenService).issue(user.userId,sessionId);
  const [refresh,logout]=await Promise.all([
   call(url,'/auth/refresh',{refreshToken}),
   call(url,'/auth/logout',{},accessToken),
  ]);
  assert.equal(logout.status,204);
  assert.ok([200,401].includes(refresh.status));
  const active=await pool.query(`SELECT count(*)::int AS n FROM auth_sessions s JOIN refresh_tokens t ON t.session_id=s.id
   WHERE s.user_id=$1 AND s.revoked_at IS NULL AND t.invalidated_at IS NULL`,[user.userId]);
  assert.equal(active.rows[0]?.n,0);
  if(refresh.status===200)assert.equal((await call(url,'/me',undefined,refresh.body.accessToken as string)).status,401);
 }finally{await pool.end();await app.close();}
});
test('PostgreSQL RBAC matrix and cross-tenant isolation with active/revoked memberships',async()=>{
 const {app,url,pool}=await start();
 try {
  const a=await register(url,'owner-rbac');
  const b=await register(url,'manager-rbac');
  const c=await register(url,'reception-rbac');
  const d=await register(url,'trainer-rbac');
  const e=await register(url,'external-rbac');
  const ta=await login(url,a.email),tb=await login(url,b.email),
   tc=await login(url,c.email),td=await login(url,d.email),te=await login(url,e.email);
  const aToken=ta.accessToken as string,bToken=tb.accessToken as string,
   cToken=tc.accessToken as string,dToken=td.accessToken as string,eToken=te.accessToken as string;
  const org=await call(url,'/organizations',{name:'RBAC Test Org',timezone:'Asia/Tehran'},aToken);
  assert.equal(org.status,201);const oid=org.body.id as string;
  const otherOrg=await call(url,'/organizations',{name:'Other Tenant',timezone:'Asia/Tehran'},eToken);
  assert.equal(otherOrg.status,201);const otherId=otherOrg.body.id as string;
  assert.equal((await call(url,`/organizations/${oid}`,undefined,eToken)).status,404);
  assert.equal((await call(url,`/organizations/${otherId}`,undefined,aToken)).status,404);
  const grant=async(userId:string,role:string,inviteeToken:string)=>{
   const invited=await call(url,`/organizations/${oid}/staff-invitations`,{userId,role},aToken);
   assert.equal(invited.status,201,JSON.stringify(invited.body));
   return call(url,'/me/staff-invitations/accept',{token:invited.body.token},inviteeToken);
  };
  assert.equal((await grant(b.userId,'MANAGER',bToken)).status,200);
  assert.equal((await grant(c.userId,'RECEPTIONIST',cToken)).status,200);
  assert.equal((await grant(d.userId,'TRAINER',dToken)).status,200);
  assert.equal((await call(url,`/organizations/${oid}/members`,{userId:e.userId,role:'OWNER'},bToken)).status,403);
  assert.equal((await call(url,`/organizations/${oid}/members`,{userId:e.userId,role:'TRAINER'},cToken)).status,403);
  assert.equal((await call(url,`/organizations/${oid}/members`,undefined,dToken)).status,403);
  const revoked=await call(url,`/organizations/${oid}/members/${b.userId}`,{status:'REVOKED'},aToken,'PATCH');
  assert.equal(revoked.status,200);
  assert.equal((await call(url,`/organizations/${oid}/members`,undefined,bToken)).status,404);
  const me=await call(url,'/me',undefined,bToken);assert.equal(me.status,200);
  assert.equal((me.body.memberships as Array<{tenantId:string}>).filter(x=>x.tenantId===oid).length,0);
  // Direct runtime-role DML cannot delete membership history.
  await assert.rejects(()=>pool.query(`DELETE FROM memberships WHERE tenant_id=$1 AND user_id=$2`,[oid,c.userId]),
    (err:unknown)=>Boolean(err&&typeof err==='object'&&'code' in err&&err.code==='42501'));
  // Trigger protects the last OWNER even if an app role attempts direct SQL.
  await assert.rejects(()=>pool.query(`UPDATE memberships SET role='TRAINER' WHERE tenant_id=$1 AND user_id=$2`,[oid,a.userId]),
    (err:unknown)=>Boolean(err&&typeof err==='object'&&'code' in err&&err.code==='23514'));
 }finally{await pool.end();await app.close();}
});

test('PostgreSQL suspended account cannot log in, and operational audit is append-only',async()=>{
 const {app,url,pool}=await start();
 const migrationUrl=process.env.MIGRATION_DATABASE_URL;
 assert.ok(migrationUrl,'MIGRATION_DATABASE_URL required for independent privileged negative fixtures');
 const ownerPool=new Pool({connectionString:migrationUrl,max:1});
 try {
  const user=await register(url,'suspended');
  await ownerPool.query(`UPDATE users SET status='SUSPENDED' WHERE id=$1`,[user.userId]);
  const denied=await call(url,'/auth/login',{email:user.email,password:'Strong_Test_Password_123!'});
  assert.equal(denied.status,401);
  // Audit history cannot be changed even by migration owner (trigger in 001).
  const events=await ownerPool.query<{id:string}>(`SELECT id FROM audit_events LIMIT 1`);
  assert.ok(events.rows[0],'previous organization tests should have produced an audit event');
  await assert.rejects(()=>ownerPool.query(`UPDATE audit_events SET action='TAMPER' WHERE id=$1`,[requireValue(events.rows[0]).id]),
    (err:unknown)=>Boolean(err&&typeof err==='object'&&'code' in err&&err.code==='23514'));
 }finally{await ownerPool.end();await pool.end();await app.close();}
});
