import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { UnitOfWork } from '../../src/infrastructure/transactions/unit-of-work';
import { UnknownCommitOutcome,sqlDisposition,confirmedPgAbort } from '../../src/infrastructure/transactions/sqlstate';
import type { DatabaseService } from '../../src/infrastructure/database/database.service';
import { parseConfig as originalParseConfig } from '../../src/config/app-config';
import {withTestAuth} from '../test-auth';
const parseConfig=(env:NodeJS.ProcessEnv)=>originalParseConfig(withTestAuth(env));
const cfg=parseConfig({NODE_ENV:'test',DATABASE_URL:'postgres://u:pass@localhost/db',
 MONITOR_API_KEY:'0123456789abcdef0123456789abcdef'});
function mockDb(failAt?:string,err?:Error) {
 const log:string[]=[],releases:boolean[]=[];
 const client=({query:async (sql:string)=>{log.push(sql);
   if(failAt && sql===failAt)throw err??new Error('fault');return {rows:[]};},
   release:(destroy?:boolean)=>{releases.push(Boolean(destroy));}}) as unknown as PoolClient;
 const db={connect:async()=>client} as unknown as DatabaseService;
 return {uow:new UnitOfWork(db,cfg),log,releases};
}
test('transaction uses one connection BEGIN/config/COMMIT and releases it',async()=>{
 const {uow,log,releases}=mockDb();
 assert.equal(await uow.run(async()=>42),42);
 assert.deepEqual(log.slice(0,2),['BEGIN ISOLATION LEVEL READ COMMITTED',"SELECT set_config('lock_timeout', $1, true)"]);
 assert.equal(log.at(-1),'COMMIT');assert.deepEqual(releases,[false]);
});
test('failure before COMMIT rolls back and releases',async()=>{
 const {uow,log,releases}=mockDb();
 await assert.rejects(uow.run(async()=>{throw new Error('business failure');}));
 assert.equal(log.at(-1),'ROLLBACK');assert.deepEqual(releases,[false]);
});
test('unknown COMMIT outcome never retried and connection discarded',async()=>{
 const {uow,log,releases}=mockDb('COMMIT',new Error('ECONNRESET'));
 await assert.rejects(uow.run(async()=>1),UnknownCommitOutcome);
 assert.equal(log.filter(v=>v==='COMMIT').length,1);assert.deepEqual(releases,[true]);
});
test('SQLSTATE network vs server ERROR distinction',()=>{
 assert.equal(confirmedPgAbort({code:'40P01',severity:'FATAL'}),false);
 assert.equal(sqlDisposition({code:'40P01',severity:'ERROR'}),'retryable-abort');
 assert.equal(sqlDisposition({code:'23P01',severity:'ERROR'}),'conflict');
 assert.equal(sqlDisposition({code:'55P03',severity:'ERROR'}),'timeout');
});
test('known commit rejection is propagated, never labeled success',async()=>{
 const ex=Object.assign(new Error('server aborted'),{code:'23514',severity:'ERROR'});
 const {uow,releases}=mockDb('COMMIT',ex);
 await assert.rejects(uow.run(async()=>42),/server aborted/);
 assert.deepEqual(releases,[true]);
});
test('bounded retry budget rejects invalid values',async()=>{
 const {uow}=mockDb();await assert.rejects(uow.run(async()=>null,0),/INVALID_TRANSACTION_RETRY_BUDGET/);
});
