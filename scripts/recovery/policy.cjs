'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const VERSION=1;
const DB_NAME=/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;
function fail(code){throw Object.assign(new Error(code),{code});}
function databaseName(value){if(typeof value!=='string'||!DB_NAME.test(value))fail('DATABASE_NAME_INVALID');return value;}
function checkPgEnvironment(env){
 for(const field of ['PGHOST','PGUSER','PGDATABASE'])if(typeof env[field]!=='string'||!env[field].trim())fail('PG_CONNECTION_EXPLICIT_REQUIRED');
 databaseName(env.PGDATABASE);
 if([env.PGHOST,env.PGUSER,env.PGHOSTADDR||''].some(x=>/[\r\n]/.test(x)))fail('PG_CONNECTION_INVALID');
 const host=env.PGHOST;
 const local=host.startsWith('/')||['localhost','127.0.0.1','::1'].includes(host);
 // PGHOSTADDR overrides DNS resolution; never let it silently bypass local/remote classification.
 const address=env.PGHOSTADDR;
 if(address && !['127.0.0.1','::1'].includes(address) && local)fail('PG_HOSTADDR_OVERRIDE_DENIED');
 if(!local || (address && !['127.0.0.1','::1'].includes(address))){
  if(env.PGSSLMODE!=='verify-full'||!env.PGSSLROOTCERT)fail('REMOTE_POSTGRES_TLS_VERIFY_FULL_REQUIRED');
  trustedPublicFile(env.PGSSLROOTCERT);
 }
}
function postgresMajor(banner,kind){
 const escaped=kind.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const match=new RegExp('^'+escaped+' \\(PostgreSQL\\) (\\d+)\\.(\\d+)').exec(String(banner).trim());
 if(!match||Number(match[1])!==17)fail('POSTGRES_CLIENT_VERSION_UNSUPPORTED');
 return Number(match[1]);
}
// Restore and independent recovery verification are privileged operations, even in
// development/test. Never resolve their executables from PATH.
function trustedOwnership(info){
 return info.uid===process.getuid?.() || info.uid===0;
}
function trustedAncestors(filename){
 let current=path.dirname(filename);
 while(true){
  const st=fs.lstatSync(current,{throwIfNoEntry:false});
  if(!st||!st.isDirectory()||st.isSymbolicLink()||!trustedOwnership(st))fail('TOOL_DIRECTORY_UNTRUSTED');
  // /tmp is safe for test-owned private directories only if it is root-owned
  // and sticky; a normal world-writable ancestor is never acceptable.
  if((st.mode&0o022)!==0 && !(st.uid===0&&(st.mode&0o1000)!==0))fail('TOOL_DIRECTORY_WRITABLE');
  const parent=path.dirname(current);if(parent===current)break;current=parent;
 }
}
function tool(name,env,options={}){
 const key={psql:'BOOKCORE_PSQL_BIN',pg_dump:'BOOKCORE_PGDUMP_BIN',pg_restore:'BOOKCORE_PGRESTORE_BIN',age:'BOOKCORE_AGE_BIN'}[name];
 if(!key)fail('TOOL_NOT_ALLOWED');
 const filename=env[key];
 const privileged=options.privileged===true || env.BOOKCORE_ENVIRONMENT==='production';
 if(!filename){if(privileged)fail('TRUSTED_TOOL_PATH_REQUIRED');return name;}
 if(!path.isAbsolute(filename))fail('TOOL_PATH_NOT_ABSOLUTE');
 const st=fs.lstatSync(filename,{throwIfNoEntry:false});
 if(!st||!st.isFile()||st.isSymbolicLink()||!trustedOwnership(st)||
    (st.mode&0o022)!==0||(st.mode&0o111)===0)fail('UNTRUSTED_TOOL_PATH');
 trustedAncestors(filename);
 return fs.realpathSync(filename);
}
// Public CA certificates may be readable by other users; they must not be
// replaceable by untrusted users. Trust is further verified by libpq's TLS.
function trustedPublicFile(filename){
 if(typeof filename!=='string'||!path.isAbsolute(filename))fail('ABSOLUTE_FILE_REQUIRED');
 const st=fs.lstatSync(filename,{throwIfNoEntry:false});
 if(!st||!st.isFile()||st.isSymbolicLink()||st.size<=0||!trustedOwnership(st)||
     (st.mode&0o022)!==0)fail('PUBLIC_CA_FILE_UNTRUSTED');
 trustedAncestors(filename);return st;
}
function recoveryIdentityFile(filename){
 if(typeof filename!=='string'||!filename)fail('AGE_IDENTITY_REQUIRED');
 const st=safeFile(filename);
 if(!trustedOwnership(st))fail('AGE_IDENTITY_OWNER_UNTRUSTED');
 trustedAncestors(filename);return filename;
}
function privateDirectory(value){
 if(typeof value!=='string'||!path.isAbsolute(value))fail('ABSOLUTE_DIRECTORY_REQUIRED');
 const info=fs.lstatSync(value,{throwIfNoEntry:false});
 if(!info||!info.isDirectory()||info.isSymbolicLink())fail('PRIVATE_DIRECTORY_REQUIRED');
 if((info.mode&0o077)!==0)fail('PRIVATE_DIRECTORY_PERMISSIONS_REQUIRED');
 if(!trustedOwnership(info))fail('PRIVATE_DIRECTORY_OWNER_UNTRUSTED');
 trustedAncestors(value);
 return fs.realpathSync(value);
}
function safeFile(value){
 if(!path.isAbsolute(value))fail('ABSOLUTE_FILE_REQUIRED');
 const info=fs.lstatSync(value,{throwIfNoEntry:false});
 if(!info||!info.isFile()||info.isSymbolicLink()||info.size<=0)fail('REGULAR_FILE_REQUIRED');
 if((info.mode&0o077)!==0)fail('PRIVATE_FILE_PERMISSIONS_REQUIRED');
 if(!trustedOwnership(info))fail('PRIVATE_FILE_OWNER_UNTRUSTED');
 return info;
}
function newId(){return new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z')+'-'+crypto.randomUUID();}
function validateManifest(m){
 if(!m||typeof m!=='object'||Array.isArray(m)||m.schemaVersion!==VERSION||m.format!=='pg_dump_custom'||
 typeof m.backupId!=='string'||!/^\d{8}T\d{6}Z-[0-9a-f-]{36}$/.test(m.backupId)||
 !['plain','age'].includes(m.encryption)||typeof m.filename!=='string'||
 !/^bookcore-[\w-]+\.dump(\.age)?$/.test(m.filename)||m.filename.includes('..')||
 !/^[a-f0-9]{64}$/.test(m.sha256)||!Number.isSafeInteger(m.bytes)||m.bytes<=0||
 typeof m.createdAt!=='string'||!Number.isFinite(Date.parse(m.createdAt))||
 typeof m.postgresClientVersion!=='string'||m.postgresClientVersion.length>200||
 typeof m.sourceDatabase!=='string'||!DB_NAME.test(m.sourceDatabase)||
 !Number.isInteger(m.retentionDays)||m.retentionDays<1||m.retentionDays>3650||
 (m.encryption==='age')!==m.filename.endsWith('.age'))fail('BACKUP_MANIFEST_INVALID');
 return m;
}
function retentionDays(value){const n=Number(value);if(!Number.isInteger(n)||n<1||n>3650)fail('RETENTION_INVALID');return n;}
function backupPath(manifestPath,manifest){
 safeFile(manifestPath);const dir=privateDirectory(path.dirname(manifestPath));
 const filename='bookcore-'+manifest.backupId+'.dump'+(manifest.encryption==='age'?'.age':'');
 if(manifest.filename!==filename)fail('BACKUP_FILENAME_MISMATCH');
 const archive=path.join(dir,filename);safeFile(archive);return archive;
}
function restorePolicy(env,target,execute){
 databaseName(target);
 if(!['development','test'].includes(env.BOOKCORE_ENVIRONMENT))fail('RESTORE_ENVIRONMENT_DENIED');
 if(env.BOOKCORE_DISPOSABLE_RESTORE_TARGET!==target)fail('RESTORE_TARGET_NOT_ALLOWLISTED');
 if(env.PGDATABASE===target)fail('RESTORE_SOURCE_TARGET_COLLISION');
 if(!['127.0.0.1','localhost','::1'].includes(env.PGHOST)&&!String(env.PGHOST||'').startsWith('/'))
  fail('RESTORE_LOCAL_TARGET_REQUIRED');
 if(!env.PGUSER||!env.BOOKCORE_RESTORE_ALLOWED_LOGIN)fail('RESTORE_CREDENTIAL_REQUIRED');
 if(env.PGUSER!==env.BOOKCORE_RESTORE_ALLOWED_LOGIN)fail('RESTORE_LOGIN_MISMATCH');
 if(execute && env.BOOKCORE_RESTORE_ISOLATED_INSTANCE!=='yes')fail('RESTORE_ISOLATION_REQUIRED');
 if(execute&&env.BOOKCORE_RESTORE_ACK!==`RESTORE_DISPOSABLE:${target}`)fail('RESTORE_EXPLICIT_ACK_REQUIRED');
 return true;
}
async function sha256File(file){
 const hash=crypto.createHash('sha256');
 for await(const chunk of fs.createReadStream(file,{highWaterMark:1024*1024}))hash.update(chunk);
 return hash.digest('hex');
}
async function checkHash(file,expected){if(await sha256File(file)!==expected)fail('BACKUP_SHA256_MISMATCH');}
function parseArgs(args,fields){
 const out={};for(let i=0;i<args.length;i++){
  const key=args[i];if(key==='--execute'&&fields.includes('--execute')){if(out.execute)fail('DUPLICATE_ARGUMENT');out.execute=true;continue;}
  if(!fields.includes(key)||key==='--execute'||!args[i+1]||args[i+1].startsWith('--')||Object.hasOwn(out,key.slice(2)))fail('INVALID_ARGUMENTS');
  out[key.slice(2)]=args[++i];
 }return out;
}
module.exports={fail,databaseName,checkPgEnvironment,postgresMajor,tool,privateDirectory,safeFile,newId,validateManifest,
 retentionDays,backupPath,restorePolicy,trustedPublicFile,recoveryIdentityFile,sha256File,checkHash,parseArgs};
