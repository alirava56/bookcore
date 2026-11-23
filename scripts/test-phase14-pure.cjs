#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const ts=(()=>{try{return require('typescript');}catch{return require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}})();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bookcore14-pure-'));
try{
 const names=['apps/api/src/modules/booking/contention-result.ts','apps/api/test/unit/phase14-contention.test.ts'];
 for(const name of names){const t=ts.transpileModule(fs.readFileSync(name,'utf8'),{fileName:name,reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
  if(t.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error))throw Error('TS_SYNTAX_ERROR:'+name);
  const dest=path.join(dir,name.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,t.outputText);
 }
 const cases=[path.join(dir,names.at(-1).replace(/\.ts$/,'.js')),'apps/api/test/unit/phase14-recovery.test.cjs'];
 const result=cp.spawnSync(process.execPath,['--test','--test-reporter=tap',...cases],{encoding:'utf8',timeout:60000});
 process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
 const counts=Object.fromEntries([...(result.stdout||'').matchAll(/^# (tests|pass|fail|skipped|cancelled|todo) (\d+)$/gm)].map(m=>[m[1],Number(m[2])]));
 if(result.error||result.status!==0||!counts.tests||counts.pass!==counts.tests||counts.fail!==0||counts.skipped!==0||counts.cancelled!==0||counts.todo!==0)process.exitCode=1;
}finally{fs.rmSync(dir,{recursive:true,force:true});}
