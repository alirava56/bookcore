import test from 'node:test';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { APP_CONFIG,parseConfig as originalParseConfig } from '../../src/config/app-config';
import {withTestAuth} from '../test-auth';
const parseConfig=(env:NodeJS.ProcessEnv)=>originalParseConfig(withTestAuth(env));
import { DatabaseService } from '../../src/infrastructure/database/database.service';
import { configureApplication } from '../../src/bootstrap';

const cfg=parseConfig({NODE_ENV:'test',DATABASE_URL:'postgres://u:pass@localhost/db',
 MONITOR_API_KEY:'0123456789abcdef0123456789abcdef'});
test('HTTP /live public; /ready guarded, dependent on DB, and correlation header present',async()=>{
 const fakeDb={ready:async()=>false,onModuleDestroy:async()=>{}};
 const moduleFixture=await Test.createTestingModule({imports:[AppModule.forRoot(cfg)]})
  .overrideProvider(APP_CONFIG).useValue(cfg).overrideProvider(DatabaseService).useValue(fakeDb).compile();
 const app=moduleFixture.createNestApplication({bodyParser:false});
 await assert.rejects(()=>configureApplication(app,{...cfg,port:cfg.port+1}),/CONFIG_INJECTION_MISMATCH/);
 await configureApplication(app,cfg);
 try {
  await app.listen(0,'127.0.0.1');
  const address=app.getHttpServer().address() as {port:number};
  const url=`http://127.0.0.1:${address.port}/api/v1/health`;
  const live=await fetch(url+'/live');
  assert.equal(live.status,200);assert.deepEqual(await live.json(),{status:'ok'});
  assert.match(live.headers.get('x-request-id')??'',/^[0-9a-f-]{36}$/);
  const privateResponse=await fetch(`http://127.0.0.1:${address.port}/api/v1/me`);
  assert.equal(privateResponse.status,401);
  const deny=await fetch(url+'/ready');assert.equal(deny.status,401);
  assert.match(deny.headers.get('content-type')??'',/application\/problem\+json/);
  const unready=await fetch(url+'/ready',{headers:{'X-BookCore-Monitor-Key':cfg.monitorApiKey}});
  assert.equal(unready.status,503);assert.equal((await unready.json() as {code:string}).code,'DEPENDENCY_UNAVAILABLE');
  fakeDb.ready=async()=>true;
  const ready=await fetch(url+'/ready',{headers:{'X-BookCore-Monitor-Key':cfg.monitorApiKey}});
  assert.equal(ready.status,200);
 } finally {await app.close();}
});
