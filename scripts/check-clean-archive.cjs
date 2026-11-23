'use strict';
// Invoke after extracting a ZIP to this directory (before installing dependencies).
const cp=require('node:child_process');
for(const [name,args] of [['reference',['scripts/verify-reference.cjs']],['static',['scripts/static-verify.cjs']]]) {
  const r=cp.spawnSync(process.execPath,args,{stdio:'inherit'});
  if(r.status!==0)process.exit(r.status||1);
}
console.log('PASS clean extraction source checks; runtime tests still require dependencies and PostgreSQL');
