import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {TenantAuthorizationService} from '../../src/modules/organizations/authorization.service';
import {OrganizationsService} from '../../src/modules/organizations/organizations.service';
import {ProblemException} from '../../src/common/errors/problem';
import type {DatabaseService} from '../../src/infrastructure/database/database.service';
import type {UnitOfWork} from '../../src/infrastructure/transactions/unit-of-work';
import type {AuthenticatedPrincipal} from '../../src/common/security/authorization';
const principal:AuthenticatedPrincipal={userId:'2cc0bb2e-9f15-46cd-b262-b9e48232ca0d',
 sessionId:'01234567-1234-4234-9234-123456789012',active:true};
const tenant='6ddfd634-556a-4c5d-8c45-1deac80c5d0b';
test('tenant read denies principal without verified active membership',async()=>{
 const db={connect:async()=>({query:async()=>({rows:[]}),release:()=>{}})} as unknown as DatabaseService;
 const policy=new TenantAuthorizationService(db);
 await assert.rejects(()=>policy.forRead(principal,tenant),(e:unknown)=>e instanceof ProblemException&&e.getStatus()===404);
});
test('receptionist cannot manage membership (403)',async()=>{
 const db={connect:async()=>({query:async()=>({rows:[{role:'RECEPTIONIST'}]}),release:()=>{}})} as unknown as DatabaseService;
 const policy=new TenantAuthorizationService(db);
 await assert.rejects(()=>policy.forRead(principal,tenant,true),(e:unknown)=>e instanceof ProblemException&&e.getStatus()===403);
});
test('manager cannot create OWNER even if DB would accept insert',async()=>{
 let inserted=false;
 const fakeClient={query:async(sql:string)=>{
  if(sql.includes('lock_bookcore_organization'))return {rows:[{ok:true}]};
  if(sql.includes('FROM auth_sessions'))return {rows:[{active:true}]};
  if(sql.includes('FROM memberships'))return {rows:[{role:'MANAGER'}]};
  if(sql.includes('INSERT INTO memberships'))inserted=true;
  return {rows:[]};
 }} as unknown as PoolClient;
 const fakeUow={run:async(fn:(c:PoolClient)=>Promise<unknown>)=>fn(fakeClient)} as unknown as UnitOfWork;
 const policy=new TenantAuthorizationService({} as DatabaseService);
 const org=new OrganizationsService({} as DatabaseService,fakeUow,policy);
 await assert.rejects(()=>org.add(principal,tenant,{userId:principal.userId,role:'OWNER' as never}),/ROLE_ESCALATION_DENIED/);
 assert.equal(inserted,false);
});
test('empty membership patch cannot silently pass',async()=>{
 const org=new OrganizationsService({} as DatabaseService,{} as UnitOfWork,{} as TenantAuthorizationService);
 await assert.rejects(()=>org.patch(principal,tenant,principal.userId,{}),/EMPTY_MEMBERSHIP_PATCH/);
});
