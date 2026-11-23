const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const P=require('../../../../scripts/recovery/policy.cjs');
const {backup}=require('../../../../scripts/recovery/backup.cjs');
const {restore}=require('../../../../scripts/recovery/restore.cjs');
const env={PGHOST:'127.0.0.1',PGDATABASE:'source_db',PGUSER:'approved_login',BOOKCORE_ENVIRONMENT:'test',
 BOOKCORE_RESTORE_ALLOWED_LOGIN:'approved_login',BOOKCORE_DISPOSABLE_RESTORE_TARGET:'restore_sandbox',
 BOOKCORE_RESTORE_ISOLATED_INSTANCE:'yes',BOOKCORE_EXPECTED_SOURCE_DATABASE:'source_db',BOOKCORE_RESTORE_ACK:'RESTORE_DISPOSABLE:restore_sandbox'};
function pinnedEnv(bin){return {...env,PATH:bin+':'+process.env.PATH,BOOKCORE_PGDUMP_BIN:path.join(bin,'pg_dump'),BOOKCORE_PSQL_BIN:path.join(bin,'psql'),BOOKCORE_PGRESTORE_BIN:path.join(bin,'pg_restore'),BOOKCORE_AGE_BIN:path.join(bin,'age')}}
function binFixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'b13-bin-'));fs.chmodSync(dir,0o700);
 const write=(name,body)=>fs.writeFileSync(path.join(dir,name),'#!/bin/sh\n'+body+'\n',{mode:0o700});
 write('pg_dump',`if [ "$1" = "--version" ]; then echo 'pg_dump (PostgreSQL) 17.6'; exit 0; fi;\nprev=''; for arg in "$@"; do if [ "$prev" = '--file' ]; then printf 'FAKE_CUSTOM_ARCHIVE' > "$arg"; exit 0; fi; prev="$arg"; done; printf 'FAKE_CUSTOM_ARCHIVE'`);
 write('pg_restore',`if [ "$1" = "--version" ]; then echo 'pg_restore (PostgreSQL) 17.6'; else echo 'list of fake objects'; fi`);
 write('age',`if [ "$1" = "--encrypt" ]; then while [ "$#" -gt 0 ]; do if [ "$1" = "--output" ]; then shift; cat > "$1"; exit 0; fi; shift; done; fi; exit 9`);
 write('psql',`case "$*" in *SHOW*) echo '170006';; *session_user*) if [ "$MOCK_SPOOF_SESSION_USER" = 1 ]; then printf 'spoofed_login\\trestore_sandbox\\t170006\\n'; else printf 'approved_login\\trestore_sandbox\\t170006\\n'; fi;; *pg_stat_activity*) echo 0;; *shobj_description*) echo bookcore-disposable-restore-v1;; *current_database*) echo 'source_db';; *has_table_privilege*) echo 'yes';; *pg_class*) echo 0;; *bookcore_migrations*) if [ -n "$MOCK_LEDGER_PATH" ]; then cat "$MOCK_LEDGER_PATH"; else exit 8; fi;; *) exit 9;; esac`);
 return dir;
}
test('restore rejects unapproved operator and isolation before destructive command',()=>{
 assert.throws(()=>P.restorePolicy({...env,PGUSER:'different'},'restore_sandbox',true),/RESTORE_LOGIN_MISMATCH/);
 assert.throws(()=>P.restorePolicy({...env,BOOKCORE_RESTORE_ALLOWED_LOGIN:undefined},'restore_sandbox',true),/RESTORE_CREDENTIAL_REQUIRED/);
 assert.throws(()=>P.restorePolicy({...env,BOOKCORE_RESTORE_ISOLATED_INSTANCE:undefined},'restore_sandbox',true),/RESTORE_ISOLATION_REQUIRED/);
});
test('remote PG transport rejects disable, require and hostaddr bypass',()=>{
 assert.throws(()=>P.checkPgEnvironment({...env,PGHOST:'db.internal',PGSSLMODE:'disable'}),/TLS_VERIFY_FULL/);
 assert.throws(()=>P.checkPgEnvironment({...env,PGHOST:'db.internal',PGSSLMODE:'require'}),/TLS_VERIFY_FULL/);
 assert.throws(()=>P.checkPgEnvironment({...env,PGHOSTADDR:'8.8.8.8'}),/HOSTADDR_OVERRIDE_DENIED/);
 P.checkPgEnvironment({...env,PGHOST:'/var/run/postgresql'});
});
test('pg tool versions reject unsupported clients and banner forgery',()=>{
 assert.equal(P.postgresMajor('pg_dump (PostgreSQL) 17.6','pg_dump'),17);
 assert.throws(()=>P.postgresMajor('pg_dump (PostgreSQL) 16.9','pg_dump'),/VERSION_UNSUPPORTED/);
 assert.throws(()=>P.postgresMajor('untrusted','pg_restore'),/VERSION_UNSUPPORTED/);
});
test('production tools require pinned trusted executable paths',()=>{
 assert.throws(()=>P.tool('pg_dump',{BOOKCORE_ENVIRONMENT:'production'}),/TRUSTED_TOOL_PATH_REQUIRED/);
 assert.throws(()=>P.tool('psql',{BOOKCORE_PSQL_BIN:'psql'}),/TOOL_PATH_NOT_ABSOLUTE/);
});
test('encrypted backup producer succeeds without private identity but never claims decrypted validation',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'b13-backup-')),bin=binFixture();fs.chmodSync(dir,0o700);
 try{const result=await backup({directory:dir},{...pinnedEnv(bin),
  BOOKCORE_BACKUP_AGE_RECIPIENT:'age1'+'a'.repeat(40),BOOKCORE_AGE_IDENTITY_FILE:undefined});
  assert.equal(result.encrypted,true);
  assert.equal(result.status,'ENCRYPTED_BACKUP_CREATED_DECRYPTION_UNVERIFIED');
  assert.equal(result.decryptionVerified,false);assert.equal(result.restoreVerified,false);
  assert.ok(fs.existsSync(result.archive));
 }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(bin,{recursive:true,force:true});}
});
test('independent manifest digest detects jointly rewritten archive and manifest',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'b13-backup-')),bin=binFixture();fs.chmodSync(dir,0o700);
 try {const result=await backup({directory:dir},{...pinnedEnv(bin)});
  const trusted=crypto.createHash('sha256').update(fs.readFileSync(result.manifest)).digest('hex');
  const {verify}=require('../../../../scripts/recovery/verify-backup.cjs');
  const checked=await verify(result.manifest,{...pinnedEnv(bin),BOOKCORE_PGRESTORE_BIN:path.join(bin,'pg_restore'),BOOKCORE_TRUSTED_MANIFEST_SHA256:trusted});
  assert.equal(checked.manifestProvenanceVerified,true);
  fs.appendFileSync(result.manifest,' ');await assert.rejects(()=>verify(result.manifest,
   {...pinnedEnv(bin),BOOKCORE_PGRESTORE_BIN:path.join(bin,'pg_restore'),BOOKCORE_TRUSTED_MANIFEST_SHA256:trusted}),/PROVENANCE_MISMATCH/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(bin,{recursive:true,force:true});}
});
test('simulated execute restore preflight attempts verification and never silently reports success',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'b13-backup-')),bin=binFixture();fs.chmodSync(dir,0o700);
 try {const e={...pinnedEnv(bin),BOOKCORE_PGRESTORE_BIN:path.join(bin,'pg_restore'),BOOKCORE_PSQL_BIN:path.join(bin,'psql'),BOOKCORE_AGE_BIN:path.join(bin,'age')};const b=await backup({directory:dir},e);
  e.BOOKCORE_TRUSTED_MANIFEST_SHA256=crypto.createHash('sha256').update(fs.readFileSync(b.manifest)).digest('hex');
  await assert.rejects(()=>restore({manifestFile:b.manifest,targetDatabase:'restore_sandbox',execute:true},e),
   /EXTERNAL_COMMAND_FAILED/); // fake psql rejects migration ledger after pg_restore fake returns success
 }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(bin,{recursive:true,force:true});}
});

test('authenticated session_user mismatch is rejected before restore starts',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'b13-backup-')),bin=binFixture();fs.chmodSync(dir,0o700);
 try{const e={...pinnedEnv(bin),BOOKCORE_PGRESTORE_BIN:path.join(bin,'pg_restore'),BOOKCORE_PSQL_BIN:path.join(bin,'psql'),BOOKCORE_AGE_BIN:path.join(bin,'age')};const b=await backup({directory:dir},e);
  e.BOOKCORE_TRUSTED_MANIFEST_SHA256=crypto.createHash('sha256').update(fs.readFileSync(b.manifest)).digest('hex');
  await assert.rejects(()=>restore({manifestFile:b.manifest,targetDatabase:'restore_sandbox',execute:true},
   {...e,MOCK_SPOOF_SESSION_USER:'1'}),/RESTORE_AUTHENTICATED_LOGIN_MISMATCH/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(bin,{recursive:true,force:true});}
});
test('mock execute restores then validates the full migration ledger and critical ACL; no real PG involved',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'b13-backup-')),bin=binFixture();fs.chmodSync(dir,0o700);
 try {const dbm=path.resolve(__dirname,'../../../../db/migrations');
  const ledger=path.join(dir,'ledger.fixture');
  const rows=fs.readdirSync(dbm).filter(x=>/^\d{3}_.*\.sql$/.test(x)).sort().map(name=>
   name+'\t'+crypto.createHash('sha256').update(fs.readFileSync(path.join(dbm,name))).digest('hex'));
  assert.ok(rows.length>=12);fs.writeFileSync(ledger,rows.join('\n')+'\n',{mode:0o600});
  const e={...pinnedEnv(bin),MOCK_LEDGER_PATH:ledger,BOOKCORE_PGRESTORE_BIN:path.join(bin,'pg_restore'),BOOKCORE_PSQL_BIN:path.join(bin,'psql'),BOOKCORE_AGE_BIN:path.join(bin,'age')};
  const b=await backup({directory:dir},e);
  e.BOOKCORE_TRUSTED_MANIFEST_SHA256=crypto.createHash('sha256').update(fs.readFileSync(b.manifest)).digest('hex');
  const r=await restore({manifestFile:b.manifest,targetDatabase:'restore_sandbox',execute:true},e);
  assert.equal(r.status,'RESTORE_EXECUTED_MIGRATION_LEDGER_MATCHED');
  assert.equal(r.restoredMigrationCount,rows.length);assert.equal(r.deepIntegrityVerified,false);
  assert.equal(r.restoreState,'POST_RESTORE_CHECKS_PARTIAL');
 }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(bin,{recursive:true,force:true});}
});
