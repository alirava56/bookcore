import test from 'node:test';
import assert from 'node:assert/strict';
import {Reflector} from '@nestjs/core';
import type {ExecutionContext} from '@nestjs/common';
import {GlobalAuthGuard,Public,MonitoringRoute} from '../../src/common/security/authorization';
import type {AccessTokenService} from '../../src/modules/identity/token.service';
import type {DatabaseService} from '../../src/infrastructure/database/database.service';
import {ProblemException} from '../../src/common/errors/problem';

const make=(auth?:string)=>{
 const handler=()=>{};
 const context={getHandler:()=>handler,getClass:()=>class PrivateProbe{},switchToHttp:()=>({getRequest:()=>({
  headers:{authorization:auth},socket:{remoteAddress:'127.0.0.1'}
 })})} as unknown as ExecutionContext;
 return {context,handler};
};
test('global guard rejects undecorated anonymous route without @UseGuards',async()=>{
 const {context}=make();const guard=new GlobalAuthGuard(new Reflector(),{} as AccessTokenService,{} as DatabaseService);
 await assert.rejects(()=>guard.canActivate(context),(e:unknown)=>e instanceof ProblemException&&e.problemCode==='AUTHENTICATION_REQUIRED');
});
test('method-scoped public routes work; class metadata alone must not grant access',async()=>{
 const {context,handler}=make();Public()(handler);
 const guard=new GlobalAuthGuard(new Reflector(),{} as AccessTokenService,{} as DatabaseService);
 assert.equal(await guard.canActivate(context),true);
 const other=make();assert.notEqual(other.handler,handler);
 await assert.rejects(()=>guard.canActivate(other.context),/AUTHENTICATION_REQUIRED/);
});
test('monitor bypass is narrowly scoped to annotated method (second guard still required)',async()=>{
 const {context,handler}=make();MonitoringRoute()(handler);
 const guard=new GlobalAuthGuard(new Reflector(),{} as AccessTokenService,{} as DatabaseService);
 assert.equal(await guard.canActivate(context),true);
});
test('invalid bearer token denied before DB lookup',async()=>{
 const {context}=make('Bearer invalid');
 const guard=new GlobalAuthGuard(new Reflector(),{verify:()=>{throw new ProblemException(401,'INVALID_ACCESS_TOKEN');}} as unknown as AccessTokenService,
  {connect:()=>{throw new Error('must not connect');}} as unknown as DatabaseService);
 await assert.rejects(()=>guard.canActivate(context),/INVALID_ACCESS_TOKEN/);
});
