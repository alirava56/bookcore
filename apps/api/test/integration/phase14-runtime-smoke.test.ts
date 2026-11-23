import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {parseConfig} from '../../src/config/app-config';
import {buildApplication} from '../../src/bootstrap';
import {REQUIRED_MIGRATION_SHA256} from '../../src/infrastructure/database/migration-checksums';

const keys=['DATABASE_URL','MIGRATION_DATABASE_URL','AUTH_JWT_ISSUER','AUTH_JWT_AUDIENCE',
 'AUTH_JWT_ACTIVE_KID','AUTH_JWT_KEYS_JSON','MONITOR_API_KEY'];
if(process.env.BOOKCORE_TEST_DATABASE_DISPOSABLE!=='yes'||keys.some(x=>!process.env[x]))
 throw Error('PHASE14_DISPOSABLE_POSTGRESQL_CONFIG_REQUIRED');

test('Phase14 real NestJS bootstrap, global auth, private monitoring and migration ledger',
 {timeout:60000},async()=>{
 const config=parseConfig({...process.env,NODE_ENV:'test'});
 const app=await buildApplication(config);
 const pool=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:1});
 try{
  await app.listen(0,'127.0.0.1');
  const listener=app.getHttpServer().address() as {port:number};
  const base=`http://127.0.0.1:${listener.port}/api/v1`;
  const live=await fetch(`${base}/health/live`,{signal:AbortSignal.timeout(10000)});
  assert.equal(live.status,200);
  const me=await fetch(`${base}/me`,{signal:AbortSignal.timeout(10000)});
  assert.equal(me.status,401,'global APP_GUARD must deny unauthenticated self API');
  const ready=await fetch(`${base}/health/ready`,{signal:AbortSignal.timeout(10000)});
  assert.notEqual(ready.status,200,'private readiness cannot be anonymous');
  const metrics=await fetch(`${base}/internal/metrics`,{signal:AbortSignal.timeout(10000)});
  assert.notEqual(metrics.status,200,'private metrics cannot be anonymous');
  const applied=await pool.query<{count:string}>(`SELECT count(*)::text AS count FROM bookcore_migrations`);
  assert.equal(Number(applied.rows[0]?.count),Object.keys(REQUIRED_MIGRATION_SHA256).length);
 }finally{await pool.end();await app.close();}
});
