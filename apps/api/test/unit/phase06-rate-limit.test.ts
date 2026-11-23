import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExecutionContext} from '@nestjs/common';
import {AuthRateLimitGuard} from '../../src/common/security/rate-limit.guard';
import type {DatabaseService} from '../../src/infrastructure/database/database.service';
test('public session limits are bound to stable route identity, not arbitrary UUID URLs',async()=>{
 const hashes:string[]=[];
 const fakeDb={connect:async()=>({query:async(_sql:string,params:unknown[])=>{
  hashes.push(params[0] as string);return {rows:[{count:1}]};},release:()=>{}})} as unknown as DatabaseService;
 const guard=new AuthRateLimitGuard(fakeDb);
 let path='/api/v1/public/organizations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/sessions';
 const ctx={getClass:()=>({name:'PublicSessionController'}),getHandler:()=>({name:'list'}),
  switchToHttp:()=>({getRequest:()=>({path,socket:{remoteAddress:'127.0.0.1'}})})} as unknown as ExecutionContext;
 assert.equal(await guard.canActivate(ctx),true);
 path='/api/v1/public/organizations/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sessions';
 assert.equal(await guard.canActivate(ctx),true);
 assert.equal(hashes[0],hashes[1]);
});
