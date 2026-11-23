import {requireValue} from '../../src/common/require-value';
/** Requires real PostgreSQL 17, official pg_dump/pg_restore/psql and a DISPOSABLE source and target.
 *  No mock is accepted as backup/restore recovery evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {Pool} from 'pg';
const loadRecoveryModule=createRequire(join(process.cwd(),'package.json'));
const {backup}=loadRecoveryModule('./scripts/recovery/backup.cjs') as {
 backup(options:{directory:string;retention:string},env?:NodeJS.ProcessEnv):Promise<{manifest:string;restoreVerified:boolean}>;
};
const {verify}=loadRecoveryModule('./scripts/recovery/verify-backup.cjs') as {
 verify(manifest:string,env?:NodeJS.ProcessEnv):Promise<{archiveIntegrityVerified:boolean;manifestProvenanceVerified:boolean;decryptionVerified:boolean}>;
};
const {restore}=loadRecoveryModule('./scripts/recovery/restore.cjs') as {
 restore(options:{manifestFile:string;targetDatabase:string;execute?:boolean},env?:NodeJS.ProcessEnv):
 Promise<{status:string;restoredMigrationCount?:number}>;
};
if(process.env.BOOKCORE_TEST_DATABASE_DISPOSABLE!=='yes'||
   process.env.BOOKCORE_PHASE12_DISPOSABLE_SOURCE!=='yes'||
   !process.env.PGHOST||!process.env.PGUSER||!process.env.PGDATABASE||
   !process.env.BOOKCORE_DISPOSABLE_RESTORE_TARGET)
 throw new Error('PHASE12_REAL_PG17_DISPOSABLE_FIXTURES_REQUIRED');

test('Phase12 PG17: official custom-format dump is verified and includes migration ledger',
 {timeout:450000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'bookcore12-real-'));
 try{
  const source=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:1});
  try{
   const version=await source.query<{major:string}>("SELECT current_setting('server_version_num') AS major");
   assert.ok(requireValue(version.rows[0]).major.startsWith('17'),'requires real PostgreSQL 17');
   const ledger=await source.query<{count:string}>('SELECT count(*)::text AS count FROM bookcore_migrations');
   assert.ok(Number(requireValue(ledger.rows[0]).count)>=12);
  }finally{await source.end();}
  const fixture=process.env.BOOKCORE_RECOVERY_MANIFEST_FILE;
  const digest=process.env.BOOKCORE_TRUSTED_MANIFEST_SHA256;
  assert.ok(fixture&&digest,'an independently approved fixture and digest are required');
  const untrustedEnv={...process.env};
  delete untrustedEnv.BOOKCORE_TRUSTED_MANIFEST_SHA256;
  delete untrustedEnv.BOOKCORE_BACKUP_AGE_RECIPIENT;
  const result=await backup({directory:dir,retention:'30'},untrustedEnv);
  assert.equal(result.restoreVerified,false);
  assert.equal((await verify(result.manifest,untrustedEnv)).archiveIntegrityVerified,true);
  const targetDatabase=process.env.BOOKCORE_DISPOSABLE_RESTORE_TARGET;
  assert.ok(targetDatabase);
  const args={manifestFile:fixture,targetDatabase,execute:true};
  await assert.rejects(restore(args,untrustedEnv),/TRUSTED_MANIFEST_DIGEST_REQUIRED/);
  const wrongDigest=(digest[0]==='0'?'1':'0')+digest.slice(1);
  await assert.rejects(restore(args,{...process.env,BOOKCORE_TRUSTED_MANIFEST_SHA256:wrongDigest}),/BACKUP_MANIFEST_PROVENANCE_MISMATCH/);
  const verified=await verify(fixture);
  assert.equal(verified.manifestProvenanceVerified,true);
  assert.equal(verified.decryptionVerified,true,'fixture must be independently decrypted with the recovery identity');
  const preview=await restore({manifestFile:fixture,targetDatabase});
  assert.equal(preview.status,'DRY_RUN_VERIFIED_NO_MUTATION');
  if(process.env.BOOKCORE_PHASE12_RUN_RESTORE!=='yes')
   throw new Error('FULL_RESTORE_NOT_EXECUTED_EXPLICIT_OPT_IN_REQUIRED');
  await assert.rejects(restore(args,{...process.env,BOOKCORE_EXPECTED_SOURCE_DATABASE:'wrong_source'}),/RESTORE_SOURCE_IDENTITY_MISMATCH/);
  const restored=await restore(args);
  assert.equal(restored.status,'RESTORE_EXECUTED_MIGRATION_LEDGER_MATCHED');
  assert.ok((restored.restoredMigrationCount??0)>=12);
  // Audit-level reconciliation is separate from command exit status and migration ledger.
  const target=new Pool({connectionString:process.env.BOOKCORE_RESTORED_DATABASE_URL,max:1});
  try{
   const r=await target.query<{n:string}>(`SELECT count(*)::text AS n FROM public.bookcore_migrations`);
   assert.ok(Number(requireValue(r.rows[0]).n)>=12);
   const checks=await target.query<{bad_capacity:string;bad_history:string;bad_receipts:string;audit_rows:string}>(`
    SELECT (SELECT count(*) FROM sessions s WHERE seats_committed>capacity_total OR seats_committed<0
       OR seats_committed<>(SELECT count(*) FROM bookings b WHERE b.tenant_id=s.tenant_id AND b.session_id=s.id
         AND b.status IN ('CONFIRMED','ATTENDED','NO_SHOW')))::text AS bad_capacity,
      (SELECT count(*) FROM bookings b WHERE b.status IS DISTINCT FROM (SELECT e.to_status FROM booking_events e
         WHERE e.tenant_id=b.tenant_id AND e.booking_id=b.id ORDER BY e.event_order DESC LIMIT 1))::text AS bad_history,
      (SELECT count(*) FROM outbox_events o LEFT JOIN processed_outbox_events p ON p.event_id=o.id
        WHERE (o.published_at IS NULL) IS DISTINCT FROM (p.event_id IS NULL))::text AS bad_receipts,
      (SELECT count(*) FROM audit_events)::text AS audit_rows`);
   const state=requireValue(checks.rows[0]);
   assert.ok(Number(state.audit_rows)>0,'trusted fixture must include synthetic domain data');
   assert.equal(state.bad_capacity,'0');assert.equal(state.bad_history,'0');assert.equal(state.bad_receipts,'0');
   process.stdout.write(`RECOVERY_RECONCILIATION ${JSON.stringify(state)}\n`);
  }finally{await target.end();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
