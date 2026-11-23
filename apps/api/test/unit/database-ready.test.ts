import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../../src/infrastructure/database/database.service';
import { parseConfig as originalParseConfig } from '../../src/config/app-config';
import {withTestAuth} from '../test-auth';
const parseConfig=(env:NodeJS.ProcessEnv)=>originalParseConfig(withTestAuth(env));
const config=parseConfig({NODE_ENV:'test',DATABASE_URL:'postgres://u:pass@localhost/db',
 MONITOR_API_KEY:'0123456789abcdef0123456789abcdef'});
test('readiness returns false if PostgreSQL query fails (unit, not DB proof)',async()=>{
 const db=new DatabaseService(config);
 const pool=(db as unknown as {pool:{query:()=>Promise<unknown>}}).pool;
 const orig=pool.query;pool.query=async()=>{throw new Error('connection unavailable');};
 try{assert.equal(await db.ready(),false);}finally{pool.query=orig;await db.onModuleDestroy();}
});
test('readiness requires all six migrations plus identity and scheduling tables (unit)',async()=>{
 const db=new DatabaseService(config);
 const pool=(db as unknown as {pool:{query:()=>Promise<unknown>}}).pool;
 const orig=pool.query;pool.query=async()=>({rows:[{name:'001_core.sql',checksum_sha256:'invalid'}]});
 try{assert.equal(await db.ready(),false);}finally{pool.query=orig;await db.onModuleDestroy();}
});
