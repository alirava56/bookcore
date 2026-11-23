'use strict';
const fs=require('node:fs');const path=require('node:path');
const {parseArgs,restorePolicy,databaseName,checkPgEnvironment,postgresMajor,tool,fail}=require('./policy.cjs');
const {verify}=require('./verify-backup.cjs');const {run,pipeCommands}=require('./exec.cjs');
const {recoveryIdentityFile}=require('./policy.cjs');
async function restore({manifestFile,targetDatabase,execute=false},env=process.env){
 databaseName(targetDatabase);checkPgEnvironment(env);restorePolicy(env,targetDatabase,execute);
 if(execute && !env.BOOKCORE_TRUSTED_MANIFEST_SHA256)fail('TRUSTED_MANIFEST_DIGEST_REQUIRED');
 const checked=await verify(manifestFile,env,{privileged:execute,includeManifest:true});
 const {manifest,archive}=checked;
 postgresMajor(manifest.postgresClientVersion,'pg_dump');
 if(execute && (!env.BOOKCORE_EXPECTED_SOURCE_DATABASE ||
    env.BOOKCORE_EXPECTED_SOURCE_DATABASE!==manifest.sourceDatabase))fail('RESTORE_SOURCE_IDENTITY_MISMATCH');
 if(!execute)return {status:'DRY_RUN_VERIFIED_NO_MUTATION',targetDatabase,backupId:checked.backupId,
   archiveIntegrityVerified:true,restoreVerified:false};
 // Require a truly isolated disposable target marked independently by a DBA, not just a CLI --force switch.
 const targetEnv={...env,PGDATABASE:targetDatabase};
 const toolVersion=await run(tool('pg_restore',env,{privileged:true}),['--version'],targetEnv,{timeoutMs:10000});
 postgresMajor(toolVersion,'pg_restore');
 // Verify the actual server-side LOGIN and destination, not supplied PGUSER alone.
 const identity=await run(tool('psql',env,{privileged:true}),['--no-psqlrc','--tuples-only','--no-align','--set','ON_ERROR_STOP=1',
  '--command',"SELECT session_user || E'\\t' || current_database() || E'\\t' || current_setting('server_version_num')"],targetEnv);
 const [authenticated,database,version]=identity.split('\t');
 if(authenticated!==env.BOOKCORE_RESTORE_ALLOWED_LOGIN)fail('RESTORE_AUTHENTICATED_LOGIN_MISMATCH');
 if(database!==targetDatabase)fail('RESTORE_DATABASE_IDENTITY_MISMATCH');
 if(!/^\d+$/.test(version||'')||Math.floor(Number(version)/10000)!==17)fail('POSTGRES_SERVER_VERSION_UNSUPPORTED');
 // Dedicated isolated recovery instance is mandatory. Check for *current* competing
 // sessions, but do not mistake this point-in-time query for a lock against future writers.
 const competing=await run(tool('psql',env,{privileged:true}),['--no-psqlrc','--tuples-only','--no-align','--set','ON_ERROR_STOP=1',
  '--command',"SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()"],targetEnv);
 if(competing!=='0')fail('RESTORE_COMPETING_SESSIONS');
 const comment=await run(tool('psql',env,{privileged:true}),['--no-psqlrc','--tuples-only','--no-align','--set','ON_ERROR_STOP=1',
  '--command',"SELECT COALESCE(shobj_description(oid,'pg_database'),'') FROM pg_database WHERE datname=current_database()"],targetEnv);
 if(comment!=='bookcore-disposable-restore-v1')fail('TARGET_NOT_MARKED_DISPOSABLE');
 const count=await run(tool('psql',env,{privileged:true}),['--no-psqlrc','--tuples-only','--no-align','--set','ON_ERROR_STOP=1',
  '--command',"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')"],targetEnv);
 if(count!=='0')fail('TARGET_NOT_EMPTY');
 if(manifest.encryption==='age'){
  await pipeCommands(tool('age',env,{privileged:true}),['--decrypt','--identity',recoveryIdentityFile(env.BOOKCORE_AGE_IDENTITY_FILE),archive],
   tool('pg_restore',env,{privileged:true}),['--exit-on-error','--single-transaction','--no-owner','--dbname',targetDatabase],targetEnv,900000);
 }else await run(tool('pg_restore',env,{privileged:true}),['--exit-on-error','--single-transaction','--no-owner',
  '--dbname',targetDatabase,archive],targetEnv,{timeoutMs:900000});
 // Mandatory post-restore verification against the repository's historical migration checksums.
 const raw=await run(tool('psql',env,{privileged:true}),['--no-psqlrc','--tuples-only','--no-align','--set','ON_ERROR_STOP=1',
  '--command','SELECT name || E\'\\t\' || checksum_sha256 FROM public.bookcore_migrations ORDER BY name'],targetEnv);
 const source=path.resolve(__dirname,'../../db/migrations');
 const crypto=require('node:crypto');let matches=0;
 const expectedFiles=new Set(fs.readdirSync(source).filter(name=>/^\d{3}_[\w-]+\.sql$/.test(name)));
 for(const line of raw.split('\n').filter(Boolean)){
  const [name,checksum]=line.split('\t');
  if(!/^\d{3}_[\w-]+\.sql$/.test(name||''))fail('RESTORED_MIGRATION_LEDGER_INVALID');
  if(!expectedFiles.delete(name))fail('RESTORED_MIGRATION_UNKNOWN');
  const filepath=path.join(source,name);if(!fs.existsSync(filepath))fail('RESTORED_MIGRATION_UNKNOWN');
  const expected=crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex');
  if(checksum!==expected)fail('RESTORED_MIGRATION_DRIFT');matches++;
 }
 if(matches<12||expectedFiles.size)fail('RESTORED_MIGRATION_LEDGER_INCOMPLETE');
 // Preserve and test runtime ACLs; the backup retains GRANTs and target roles must be pre-provisioned.
 const privilege=await run(tool('psql',env,{privileged:true}),['--no-psqlrc','--tuples-only','--no-align','--set','ON_ERROR_STOP=1',
  '--command',`SELECT CASE WHEN
   has_table_privilege('bookcore_app','public.bookings','SELECT') AND
   has_table_privilege('bookcore_app','public.bookings','INSERT') AND
   has_table_privilege('bookcore_worker','public.outbox_events','SELECT') AND
   (SELECT pg_get_userbyid(relowner) <> 'bookcore_app' FROM pg_class WHERE oid='public.bookings'::regclass)
  THEN 'yes' ELSE 'no' END`],targetEnv);
 if(privilege!=='yes')fail('RESTORED_RUNTIME_PRIVILEGES_INVALID');

 return {status:'RESTORE_EXECUTED_MIGRATION_LEDGER_MATCHED',targetDatabase,backupId:checked.backupId,
  restoredMigrationCount:matches,deepIntegrityVerified:false,restoreState:'POST_RESTORE_CHECKS_PARTIAL',
  consistentSnapshotVerified:false};
}
if(require.main===module){(async()=>{
 try{const a=parseArgs(process.argv.slice(2),['--manifest','--target-db','--execute']);
  const result=await restore({manifestFile:a.manifest,targetDatabase:a['target-db'],execute:!!a.execute});
  process.stdout.write(JSON.stringify(result)+'\n');}
 catch(err){process.stderr.write(`Restore denied or failed: ${err.code||'RESTORE_OPERATION_FAILED'}\n`);process.exitCode=1;}
})();}
module.exports={restore};
