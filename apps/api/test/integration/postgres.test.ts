import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import {REQUIRED_MIGRATION_SHA256} from '../../src/infrastructure/database/migration-checksums';

// This is an ACTUAL integration test: no mocks, never skipped. Requires schema migrated first.
test('PostgreSQL 17 and the complete migration ledger are visible',async()=>{
 const url=process.env.DATABASE_URL;
 assert.ok(url,'DATABASE_URL is required for real PostgreSQL test');
 const pool=new Pool({connectionString:url,max:2,connectionTimeoutMillis:3000});
 try {
  const version=await pool.query<{server_version_num:string}>('SHOW server_version_num');
  assert.equal(version.rows[0]?.server_version_num.slice(0,2),'17');
  const schema=await pool.query<{present:boolean}>("SELECT to_regclass('public.sessions') IS NOT NULL AS present");
  assert.equal(schema.rows[0]?.present,true);
  const ledger=await pool.query<{name:string;checksum_sha256:string}>("SELECT name,checksum_sha256 FROM bookcore_migrations ORDER BY name");
  assert.deepEqual(Object.fromEntries(ledger.rows.map(r=>[r.name,r.checksum_sha256])),REQUIRED_MIGRATION_SHA256);
  const denied=await pool.query<{can_update:boolean}>(`SELECT has_any_column_privilege(current_user,'users','UPDATE') AS can_update`);
  assert.equal(denied.rows[0]?.can_update,false);
 } finally {await pool.end();}
});
