'use strict';
const fs=require('node:fs'),path=require('node:path');
const {privateDirectory,validateManifest,backupPath,parseArgs}=require('./policy.cjs');
/** Advisory-only planning: never delete backup archives or historical BookCore business records. */
function inspect(directory,{now=new Date(),limit=100}={}){
 const dir=privateDirectory(directory);
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('RETENTION_PREVIEW_LIMIT_INVALID');
 const matches=fs.readdirSync(dir).filter(x=>x.endsWith('.dump.manifest.json')||x.endsWith('.dump.age.manifest.json'));
 if(matches.length>limit)throw new Error('RETENTION_PREVIEW_TOO_MANY_ITEMS');
 const records=[];
 for(const name of matches){
  const file=path.join(dir,name);
  // An invalid manifest is a hard stop: do not act on guessed metadata.
  const manifest=validateManifest(JSON.parse(fs.readFileSync(file,'utf8')));
  backupPath(file,manifest);
  const expired=Date.parse(manifest.createdAt)+manifest.retentionDays*86400000<Date.parse(now);
  records.push({backupId:manifest.backupId,createdAt:manifest.createdAt,retentionDays:manifest.retentionDays,
   expired,action:'MANUAL_REVIEW_ONLY'});
 }
 return {mode:'PREVIEW_ONLY',inspected:records.length,records,noFilesDeleted:true};
}
if(require.main===module){try{const a=parseArgs(process.argv.slice(2),['--dir','--limit']);
 process.stdout.write(JSON.stringify(inspect(a.dir,{limit:Number(a.limit||100)}))+'\n');}
 catch{process.stderr.write('Retention preview denied.\n');process.exitCode=1;}}
module.exports={inspect};
