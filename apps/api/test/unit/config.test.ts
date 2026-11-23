import test from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig as originalParseConfig } from '../../src/config/app-config';
import {withTestAuth} from '../test-auth';
const parseConfig=(env:NodeJS.ProcessEnv)=>originalParseConfig(withTestAuth(env));
const env={NODE_ENV:'test',DATABASE_URL:'postgres://tester:pass@127.0.0.1:55432/db',
 MONITOR_API_KEY:'0123456789abcdef0123456789abcdef',MONITOR_ALLOWED_IPS:'127.0.0.1,::1'};
test('config accepts well-formed explicit environment',()=>{
 const cfg=parseConfig(env);assert.equal(cfg.environment,'test');assert.equal(cfg.dbPoolMax,10);
 assert.deepEqual(cfg.monitorAllowedIps,['127.0.0.1','::1']);
});
test('missing database URL fails before binding',()=>{
 assert.throws(()=>parseConfig({...env,DATABASE_URL:undefined}),/CONFIG_MISSING_DATABASE_URL/);
});
test('production rejects placeholder monitor key and weak database password',()=>{
 assert.throws(()=>parseConfig({...env,NODE_ENV:'production',MONITOR_API_KEY:'REPLACE_WITH_A_RANDOM_32_PLUS_CHARACTER_SECRET'}),/CONFIG_INVALID_MONITOR_API_KEY/);
 assert.throws(()=>parseConfig({...env,NODE_ENV:'production',DATABASE_URL:'postgres://u:CHANGE_ME@localhost/db'}),/CONFIG_INVALID_DATABASE_PASSWORD/);
});
test('CORS wildcard, Swagger in production and invalid IP fail closed',()=>{
 assert.throws(()=>parseConfig({...env,CORS_ORIGINS:'*'}),/CONFIG_INVALID_CORS_ORIGINS/);
 assert.throws(()=>parseConfig({...env,NODE_ENV:'production',ENABLE_SWAGGER_UI:'true'}),/CONFIG_FORBIDDEN_SWAGGER_PRODUCTION/);
 assert.throws(()=>parseConfig({...env,MONITOR_ALLOWED_IPS:'not_an_ip'}),/CONFIG_INVALID_MONITOR_ALLOWED_IPS/);
});
test('invalid port and body limit rejected',()=>{
 assert.throws(()=>parseConfig({...env,HTTP_PORT:'0'}),/CONFIG_INVALID_HTTP_PORT/);
 assert.throws(()=>parseConfig({...env,JSON_BODY_LIMIT:'unlimited'}),/CONFIG_INVALID_JSON_BODY_LIMIT/);
});
