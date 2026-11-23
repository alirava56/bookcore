#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const ts=(()=>{try{return require('typescript');}catch{return require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}})();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bookcore13-pure-'));
try {
 const names=['apps/api/src/common/observability/metrics.domain.ts',
  'apps/api/test/unit/phase13-observability.test.ts'];
 for(const name of names){
  const r=ts.transpileModule(fs.readFileSync(name,'utf8'),{fileName:name,reportDiagnostics:true,
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
  if(r.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error))throw Error('TYPESCRIPT_SYNTAX_ERROR:'+name);
  const target=path.join(dir,name.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,r.outputText);
 }
 const r=cp.spawnSync(process.execPath,['--test',path.join(dir,names.at(-1).replace(/\.ts$/,'.js')),
  'apps/api/test/unit/phase13-recovery.test.cjs'],{encoding:'utf8',timeout:60000});
 process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
 const parts=Object.fromEntries([...(r.stdout||'').matchAll(/^# (tests|pass|fail|skipped|cancelled|todo) (\d+)$/gm)].map(m=>[m[1],Number(m[2])]));
 if(r.error||r.status!==0||!parts.tests||parts.pass!==parts.tests||parts.fail!==0||parts.skipped!==0||
   parts.cancelled!==0||parts.todo!==0)process.exitCode=1;
}finally{fs.rmSync(dir,{recursive:true,force:true});}
