import test from 'node:test';
import assert from 'node:assert/strict';
import {parseConfig} from '../../src/config/app-config';
import {withTestAuth} from '../test-auth';
import type {ExecutionContext} from '@nestjs/common';
import {AuthRateLimitGuard} from '../../src/common/security/rate-limit.guard';
import type {DatabaseService} from '../../src/infrastructure/database/database.service';
const config=parseConfig(withTestAuth({NODE_ENV:'test',DATABASE_URL:'postgres://localhost/bookcore',
 MONITOR_API_KEY:'x'.repeat(32)}));
test('public session limits are bound to stable route identity, not arbitrary UUID URLs',async()=>{
 const hashes:string[]=[];
 const fakeDb={connect:async()=>({query:async(_sql:string,params:unknown[])=>{
  hashes.push(params[0] as string);return {rows:[{count:1}]};},release:()=>{}})} as unknown as DatabaseService;
 const guard=new AuthRateLimitGuard(fakeDb,config);
 let path='/api/v1/public/organizations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/sessions';
 const ctx={getClass:()=>({name:'PublicSessionController'}),getHandler:()=>({name:'list'}),
  switchToHttp:()=>({getRequest:()=>({path,socket:{remoteAddress:'127.0.0.1'}})})} as unknown as ExecutionContext;
 assert.equal(await guard.canActivate(ctx),true);
 path='/api/v1/public/organizations/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sessions';
 assert.equal(await guard.canActivate(ctx),true);
 assert.equal(hashes[0],hashes[1]);
});

test('login separates people behind trusted ingress and ignores untrusted forwarded identities',async()=>{
 const counts=new Map<string,number>();
 const db={connect:async()=>({query:async(_sql:string,[key]:string[])=>{
  assert.ok(key);
  const count=(counts.get(key)??0)+1;
  counts.set(key,count);
  return {rows:[{count}]};
 },release:()=>{}})} as unknown as DatabaseService;
 const guard=new AuthRateLimitGuard(db,{...config,authRateLimitProxyIps:['10.1.1.1']});
 const login=(peer:string,forwarded?:string)=>guard.canActivate({
  getClass:()=>({name:'IdentityController'}),getHandler:()=>({name:'login'}),
  switchToHttp:()=>({getRequest:()=>({socket:{remoteAddress:peer},headers:{'x-forwarded-for':forwarded}})})
 } as unknown as ExecutionContext);
 const results=await Promise.allSettled(Array.from({length:11},()=>login('10.1.1.1','192.0.2.10')));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,10);
 for(const result of results)if(result.status==='rejected')assert.match(String(result.reason),/AUTH_RATE_LIMITED/);
 assert.equal(await login('10.1.1.1','192.0.2.11'),true);
 for(const forwarded of [undefined,'invalid','192.0.2.10, 192.0.2.11'])
  await assert.rejects(login('10.1.1.1',forwarded),/NETWORK_IDENTITY_REQUIRED/);
 for(let i=0;i<10;i++)assert.equal(await login('192.0.2.9','192.0.2.10'),true);
 await assert.rejects(login('192.0.2.9','192.0.2.11'),/AUTH_RATE_LIMITED/);
});
