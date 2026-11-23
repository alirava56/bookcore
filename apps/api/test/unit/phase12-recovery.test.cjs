'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const os=require('node:os');const path=require('node:path');const {spawnSync}=require('node:child_process');
const P=require('../../../../scripts/recovery/policy.cjs');
const {backup}=require('../../../../scripts/recovery/backup.cjs');
const {verify}=require('../../../../scripts/recovery/verify-backup.cjs');
const {restore}=require('../../../../scripts/recovery/restore.cjs');
const fakeDir=()=>fs.mkdtempSync(path.join(os.tmpdir(),'bookcore12-mock-'));
const envBase={PGHOST:'127.0.0.1',PGDATABASE:'bookcore_fixture',PGUSER:'fixture_owner',
 BOOKCORE_ENVIRONMENT:'test',BOOKCORE_DISPOSABLE_RESTORE_TARGET:'restore_sandbox',
 BOOKCORE_RESTORE_ACK:'RESTORE_DISPOSABLE:restore_sandbox',BOOKCORE_RESTORE_ALLOWED_LOGIN:'fixture_owner',
 BOOKCORE_RESTORE_ISOLATED_INSTANCE:'yes'};
function fakeExecutables(bin){
 const dump=path.join(bin,'pg_dump');fs.writeFileSync(dump,`#!/bin/sh\ncase "$1" in --version) echo 'pg_dump (PostgreSQL) 17.6';; *) for a in "$@"; do case "$a" in --file) shift;; esac; done; for a in "$@"; do if [ "$last" = '--file' ]; then printf 'MOCK_PGDUMP_ARCHIVE' > "$a"; fi; last="$a"; done;; esac\n`,{mode:0o700});
 fs.writeFileSync(path.join(bin,'pg_restore'),`#!/bin/sh\ncase "$1" in --list) echo 'mock list';; *) exit 0;; esac\n`,{mode:0o700});
 fs.writeFileSync(path.join(bin,'psql'),`#!/bin/sh\ncase "$*" in *session_user*) echo 'fixture_owner';; *server_version_num*) echo '170006';; *current_database*) echo 'bookcore_fixture';; *shobj_description*) echo 'bookcore-disposable-restore-v1';; *pg_class*) echo '0';; *bookcore_migrations*) exit 20;; *) exit 19;; esac\n`,{mode:0o700});
 fs.chmodSync(bin,0o700);
}
test('backup policy: database names and explicit connection are mandatory',()=>{
 for(const bad of ['a;drop','', '../db','x'.repeat(100)])assert.throws(()=>P.databaseName(bad));
 assert.throws(()=>P.checkPgEnvironment({}));P.checkPgEnvironment(envBase);
});
test('retention is bounded and expiration is not deletion permission',()=>{
 for(const value of [0,-1,3651,1.5,'not-a-day'])assert.throws(()=>P.retentionDays(value));
 assert.equal(P.retentionDays('30'),30);
});
test('restore fail-closed: production, remote, mismatched, no approval',()=>{
 P.restorePolicy(envBase,'restore_sandbox',true);
 assert.throws(()=>P.restorePolicy({...envBase,BOOKCORE_ENVIRONMENT:'production'},'restore_sandbox',true));
 assert.throws(()=>P.restorePolicy({...envBase,PGHOST:'remote-prod.example'},'restore_sandbox',true));
 assert.throws(()=>P.restorePolicy(envBase,'unlisted_db',true));
 assert.throws(()=>P.restorePolicy({...envBase,PGDATABASE:'restore_sandbox'},'restore_sandbox',true));
 assert.throws(()=>P.restorePolicy({...envBase,BOOKCORE_RESTORE_ACK:undefined},'restore_sandbox',true));
});
test('backup private directory rejects symlink and group-readable directory',()=>{
 const dir=fakeDir();const group=fakeDir();fs.chmodSync(group,0o755);
 const sym=path.join(dir,'link');fs.symlinkSync(group,sym);
 try{P.privateDirectory(dir);assert.throws(()=>P.privateDirectory(group));assert.throws(()=>P.privateDirectory(sym));}
 finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(group,{recursive:true,force:true});}
});
test('manifest rejects traversal and wrong sha, retention or format',()=>{
 const m={schemaVersion:1,backupId:'20261123T113000Z-11111111-1111-4111-8111-111111111111',format:'pg_dump_custom',
  sourceDatabase:'foo',createdAt:'2026-11-23T11:30:00Z',postgresClientVersion:'pg_dump (PostgreSQL) 17.6',
  encryption:'plain',filename:'bookcore-20261123T113000Z-11111111-1111-4111-8111-111111111111.dump',bytes:9,sha256:'a'.repeat(64),retentionDays:30};
 P.validateManifest(m);assert.throws(()=>P.validateManifest({...m,filename:'../../secret'}));
 assert.throws(()=>P.validateManifest({...m,sha256:'fake'}));
 assert.throws(()=>P.validateManifest({...m,encryption:'age'}));
});
test('backup and checksum test using synthetic command mocks, NOT actual PostgreSQL',async()=>{
 const dir=fakeDir(),bin=fakeDir();fakeExecutables(bin);
 const env={...envBase,PATH:bin+':'+process.env.PATH,BOOKCORE_PGRESTORE_BIN:path.join(bin,'pg_restore'),BOOKCORE_PGDUMP_BIN:path.join(bin,'pg_dump'),BOOKCORE_PSQL_BIN:path.join(bin,'psql')};
 try{
  const created=await backup({directory:dir,retention:'14'},env);
  assert.equal(created.status,'BACKUP_CREATED_AND_ARCHIVE_LIST_VERIFIED');
  assert.ok(fs.existsSync(created.manifest));
  assert.equal((await verify(created.manifest,env)).archiveIntegrityVerified,true);
  assert.equal((await restore({manifestFile:created.manifest,targetDatabase:'restore_sandbox'},env)).status,'DRY_RUN_VERIFIED_NO_MUTATION');
  const fd=fs.openSync(created.archive,'a');fs.writeSync(fd,'CORRUPTED');fs.closeSync(fd);
  await assert.rejects(()=>verify(created.manifest,env),/BACKUP_SIZE_MISMATCH|BACKUP_SHA256_MISMATCH/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(bin,{recursive:true,force:true});}
});
test('tool unavailable propagates failure; no output archive finalized',async()=>{
 const dir=fakeDir();try{await assert.rejects(()=>backup({directory:dir},
  {...envBase,PATH:'/nonexistent-only'}));assert.equal(fs.readdirSync(dir).length,0);}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('malformed command-line arguments are rejected, including repeated options',()=>{
 assert.throws(()=>P.parseArgs(['--manifest','a','--manifest','b'],['--manifest']));
 assert.throws(()=>P.parseArgs(['--execute'],['--manifest']));
 assert.equal(P.parseArgs(['--execute'],['--execute']).execute,true);
});
test('backup and restore tooling contain no unbounded destructive flags',()=>{
 const code=fs.readFileSync(path.resolve(__dirname,'../../../../scripts/recovery/restore.cjs'),'utf8');
 assert.doesNotMatch(code,/--clean|--create/);assert.match(code,/TARGET_NOT_EMPTY/);
 assert.match(code,/TARGET_NOT_MARKED_DISPOSABLE/);assert.match(code,/--single-transaction/);
});

test('retention preview never deletes archives and bounds workload',async()=>{
 const dir=fakeDir(),bin=fakeDir();fakeExecutables(bin);
 const env={...envBase,PATH:bin+':'+process.env.PATH,BOOKCORE_PGRESTORE_BIN:path.join(bin,'pg_restore'),BOOKCORE_PGDUMP_BIN:path.join(bin,'pg_dump'),BOOKCORE_PSQL_BIN:path.join(bin,'psql')};
 try{const item=await backup({directory:dir,retention:'1'},env);
  const {inspect}=require('../../../../scripts/recovery/retention-preview.cjs');
  const outcome=inspect(dir,{now:new Date('2100-01-01T00:00:00Z')});
  assert.equal(outcome.mode,'PREVIEW_ONLY');assert.equal(outcome.records[0].expired,true);
  assert.equal(outcome.noFilesDeleted,true);assert.ok(fs.existsSync(item.archive));
  assert.throws(()=>inspect(dir,{limit:0}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(bin,{recursive:true,force:true});}
});
