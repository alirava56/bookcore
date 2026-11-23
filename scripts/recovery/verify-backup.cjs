'use strict';
const fs=require('node:fs');const path=require('node:path');const {createHash}=require('node:crypto');
const {safeFile,privateDirectory,validateManifest,backupPath,checkHash,parseArgs,tool,recoveryIdentityFile}=require('./policy.cjs');
const {run,pipeCommands}=require('./exec.cjs');
async function verify(manifestFile,env=process.env,options={privileged:true}){
 if(safeFile(manifestFile).size>16384)throw new Error('BACKUP_MANIFEST_TOO_LARGE');
 privateDirectory(path.dirname(manifestFile));
 const manifestBytes=fs.readFileSync(manifestFile);
 if(manifestBytes.length>16384)throw new Error('BACKUP_MANIFEST_TOO_LARGE');
 const trusted=env.BOOKCORE_TRUSTED_MANIFEST_SHA256;
 if(env.BOOKCORE_ENVIRONMENT==='production' && !trusted)throw new Error('TRUSTED_MANIFEST_DIGEST_REQUIRED');
 if(trusted && (!/^[a-f0-9]{64}$/.test(trusted)||createHash('sha256').update(manifestBytes).digest('hex')!==trusted))
  throw new Error('BACKUP_MANIFEST_PROVENANCE_MISMATCH');
 const manifest=validateManifest(JSON.parse(manifestBytes.toString('utf8')));
 const archive=backupPath(manifestFile,manifest);const st=safeFile(archive);
 if(st.size!==manifest.bytes)throw new Error('BACKUP_SIZE_MISMATCH');await checkHash(archive,manifest.sha256);
 if(manifest.encryption==='age'){
  if(!env.BOOKCORE_AGE_IDENTITY_FILE)throw new Error('AGE_IDENTITY_REQUIRED');
  await pipeCommands(tool('age',env,options),['--decrypt','--identity',recoveryIdentityFile(env.BOOKCORE_AGE_IDENTITY_FILE),archive],
   tool('pg_restore',env,options),['--list'],env,300000);
 }else await run(tool('pg_restore',env,options),['--list',archive],env,{timeoutMs:120000});
 return {backupId:manifest.backupId,sha256:manifest.sha256,archiveFormatValid:true,
  archiveIntegrityVerified:true,restoreVerified:false,manifestProvenanceVerified:!!trusted,
  decryptionVerified:manifest.encryption==='age',...(options.includeManifest?{manifest,archive}:{})};
}
if(require.main===module){(async()=>{
 try{const a=parseArgs(process.argv.slice(2),['--manifest']);const result=await verify(a.manifest);
  process.stdout.write(JSON.stringify(result)+'\n');}
 catch(err){process.stderr.write(`Backup verification failed: ${err.code||'BACKUP_VERIFICATION_FAILED'}\n`);process.exitCode=1;}
})();}
module.exports={verify};
