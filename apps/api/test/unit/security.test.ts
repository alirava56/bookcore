import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRemoteIp,equalSecret,MonitorGuard } from '../../src/common/security/monitor.guard';
import { parseConfig as originalParseConfig } from '../../src/config/app-config';
import {withTestAuth} from '../test-auth';
const parseConfig=(env:NodeJS.ProcessEnv)=>originalParseConfig(withTestAuth(env));
import type { ExecutionContext } from '@nestjs/common';
const config=parseConfig({NODE_ENV:'test',DATABASE_URL:'postgres://u:pass@localhost/db',
 MONITOR_API_KEY:'0123456789abcdef0123456789abcdef'});
const ctx=(remoteAddress:string,header?:string):ExecutionContext=>({
 switchToHttp:()=>({getRequest:()=>({socket:{remoteAddress},headers:header?{'x-bookcore-monitor-key':header}:{}})})
}) as unknown as ExecutionContext;
test('monitor network allowlist ignores forwarded header and IPv4-mapped IPv6 works',()=>{
 assert.equal(normalizeRemoteIp('::ffff:127.0.0.1'),'127.0.0.1');
 assert.equal(normalizeRemoteIp('not-an-ip'),'');
 const guard=new MonitorGuard(config);
 assert.throws(()=>guard.canActivate(ctx('10.0.0.5',config.monitorApiKey)),/MONITOR_NETWORK_DENIED/);
});
test('monitor key requires exact secret with constant length digest comparison',()=>{
 assert.equal(equalSecret('secret','different'),false);
 assert.equal(equalSecret(config.monitorApiKey,config.monitorApiKey),true);
 const guard=new MonitorGuard(config);
 assert.throws(()=>guard.canActivate(ctx('127.0.0.1')),/MONITOR_AUTH_REQUIRED/);
 assert.equal(guard.canActivate(ctx('127.0.0.1',config.monitorApiKey)),true);
});
