'use strict';
const fs=require('node:fs');const path=require('node:path');
const {checkPgEnvironment,privateDirectory,newId,retentionDays,sha256File,parseArgs,validateManifest,postgresMajor,tool,fail}=require('./policy.cjs');
const {run,pipeCommands}=require('./exec.cjs');
async function backup({directory,retention='30'},env=process.env){
 checkPgEnvironment(env);const dir=privateDirectory(directory);const days=retentionDays(retention);
 const id=newId();const recipient=env.BOOKCORE_BACKUP_AGE_RECIPIENT;
 if(recipient && !/^age1[0-9a-z]{20,120}$/.test(recipient))fail('AGE_RECIPIENT_INVALID');
 if(!recipient&&!['development','test'].includes(env.BOOKCORE_ENVIRONMENT))fail('BACKUP_ENCRYPTION_REQUIRED');
 const encrypted=!!recipient;
 const filename=`bookcore-${id}.dump${encrypted?'.age':''}`;
 const target=path.join(dir,filename),temporary=path.join(dir,`.${filename}.pending-${process.pid}`);
 let finalized=false;
 try{
  // Create a private file first: pg_dump's own open will not disclose its contents through an exposed directory.
  if(!encrypted){const fd=fs.openSync(temporary,'wx',0o600);fs.closeSync(fd);}
  const version=await run(tool('pg_dump',env,{privileged:true}),['--version'],env,{timeoutMs:10000});
  postgresMajor(version,'pg_dump');
  const serverVersion=await run(tool('psql',env,{privileged:true}),['--no-psqlrc','--tuples-only','--no-align',
   '--set','ON_ERROR_STOP=1','--command','SHOW server_version_num'],env,{timeoutMs:10000});
  if(!/^\d+$/.test(serverVersion)||Math.floor(Number(serverVersion)/10000)!==17)
   fail('POSTGRES_SOURCE_SERVER_VERSION_UNSUPPORTED');
  const actualDatabase=await run(tool('psql',env,{privileged:true}),['--no-psqlrc','--tuples-only','--no-align',
   '--set','ON_ERROR_STOP=1','--command','SELECT current_database()'],env,{timeoutMs:10000});
  if(actualDatabase!==env.PGDATABASE)fail('BACKUP_SOURCE_DATABASE_IDENTITY_MISMATCH');
  if(encrypted){
   await pipeCommands(tool('pg_dump',env,{privileged:true}),['--format=custom','--no-owner'],
    tool('age',env,{privileged:true}),['--encrypt','--recipient',recipient,'--output',temporary],env,300000);
  }else{
   await run(tool('pg_dump',env,{privileged:true}),['--format=custom','--no-owner','--file',temporary],env,{timeoutMs:300000});
  }
  const stat=fs.statSync(temporary);if(stat.size<1)fail('EMPTY_BACKUP');
  fs.chmodSync(temporary,0o600);
  const archiveFd=fs.openSync(temporary,'r');try{fs.fsyncSync(archiveFd);}finally{fs.closeSync(archiveFd);}
  // The producer MUST NOT hold an age private recovery identity.
  // Plain custom archives can be listed here; encrypted archives are independently
  // decrypted/listed/restored by a separate verifier with its own credential boundary.
  if(!encrypted)await run(tool('pg_restore',env,{privileged:true}),['--list',temporary],env,{timeoutMs:120000});
  const meta=validateManifest({schemaVersion:1,backupId:id,format:'pg_dump_custom',
   sourceDatabase:actualDatabase,createdAt:new Date().toISOString(),postgresClientVersion:version,
   encryption:encrypted?'age':'plain',filename,bytes:stat.size,sha256:await sha256File(temporary),retentionDays:days});
  // Do not overwrite a completed backup. Atomic rename operates inside the same private filesystem.
  if(fs.existsSync(target))fail('BACKUP_ID_COLLISION');
  fs.renameSync(temporary,target);finalized=true;
  const manifestPath=target+'.manifest.json',manifestTemp=manifestPath+'.pending';
  try{
   const fd=fs.openSync(manifestTemp,'wx',0o600);
   try{fs.writeFileSync(fd,JSON.stringify(meta,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
   fs.renameSync(manifestTemp,manifestPath);
   const dirFd=fs.openSync(dir,'r');try{fs.fsyncSync(dirFd);}finally{fs.closeSync(dirFd);}
  }catch{try{fs.unlinkSync(manifestTemp);}catch{}try{fs.unlinkSync(target);}catch{}
   throw new Error('BACKUP_MANIFEST_FINALIZATION_FAILED');}
  return {backupId:id,archive:target,manifest:manifestPath,encrypted,bytes:stat.size,sha256:meta.sha256,
   status:encrypted?'ENCRYPTED_BACKUP_CREATED_DECRYPTION_UNVERIFIED':'BACKUP_CREATED_AND_ARCHIVE_LIST_VERIFIED',
   restoreVerified:false,decryptionVerified:false,manifestProvenanceVerified:false};
 }finally{if(!finalized){try{fs.unlinkSync(temporary);}catch{}}}
}
if(require.main===module){(async()=>{
 try{const a=parseArgs(process.argv.slice(2),['--dir','--retention']);const result=await backup({directory:a.dir,retention:a.retention});
  process.stdout.write(JSON.stringify(result)+'\n');}
 catch(err){process.stderr.write(`Backup failed: ${err.code||'BACKUP_OPERATION_FAILED'}\n`);process.exitCode=1;}
})();}
module.exports={backup};
