import test from 'node:test';
import assert from 'node:assert/strict';
import {Test} from '@nestjs/testing';
import {AppModule} from '../../src/app.module';
import {parseConfig,APP_CONFIG} from '../../src/config/app-config';
import {withTestAuth} from '../test-auth';
import {DatabaseService} from '../../src/infrastructure/database/database.service';
import {configureApplication} from '../../src/bootstrap';
import {MetricsService} from '../../src/common/observability/metrics.registry';
import {LifecycleState} from '../../src/common/observability/lifecycle-state';

const config=parseConfig(withTestAuth({NODE_ENV:'test',DATABASE_URL:'postgres://u:pass@127.0.0.1/bookcore',
 MONITOR_API_KEY:'0123456789abcdef0123456789abcdef',MAX_INFLIGHT_REQUESTS:'1'}));

test('private monitoring is fail-closed, cardinality safe, and health honors draining (Nest HTTP)',async()=>{
 const fakeDb={ready:async()=>false,poolStatistics:()=>({total:6,idle:2,waiting:1}),
  onModuleDestroy:async()=>{}};
 const fixture=await Test.createTestingModule({imports:[AppModule.forRoot(config)]})
  .overrideProvider(APP_CONFIG).useValue(config)
  .overrideProvider(DatabaseService).useValue(fakeDb).compile();
 const app=fixture.createNestApplication({bodyParser:false});
 await configureApplication(app,config);
 try{
  await app.listen(0,'127.0.0.1');
  const port=(app.getHttpServer().address() as {port:number}).port;
  const base=`http://127.0.0.1:${port}/api/v1`;
  assert.equal((await fetch(`${base}/internal/metrics`)).status,401);
  assert.equal((await fetch(`${base}/internal/metrics`,{headers:{'X-BookCore-Monitor-Key':'invalid'}})).status,401);
  const authorized=await fetch(`${base}/internal/metrics`,{headers:{'X-BookCore-Monitor-Key':config.monitorApiKey}});
  assert.equal(authorized.status,200);assert.match(authorized.headers.get('content-type')??'',/text\/plain/);
  const exposition=await authorized.text();assert.match(exposition,/bookcore_http_requests_total/);
  assert.match(exposition,/bookcore_db_pool_connections\{state="waiting"\} 1/);
  assert.ok(!exposition.includes(config.monitorApiKey));
  const metrics=app.get(MetricsService);
  metrics.requestStart();
  const overloaded=await fetch(`${base}/organizations`);
  assert.equal(overloaded.status,503);assert.equal((await overloaded.json() as {code:string}).code,'SERVER_OVERLOADED');
  metrics.requestFinish('GET','unmatched',503,0);
  assert.equal((await fetch(`${base}/health/live`)).status,200);
  app.get(LifecycleState).beforeApplicationShutdown();
  const ready=await fetch(`${base}/health/ready`,{headers:{'X-BookCore-Monitor-Key':config.monitorApiKey}});
  assert.equal(ready.status,503);
  assert.equal((await ready.json() as {code:string}).code,'INSTANCE_DRAINING');
 }finally{await app.close();}
});
