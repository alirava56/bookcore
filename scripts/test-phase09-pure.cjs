'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const ts=(()=>{try{return require('typescript');}catch{return require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}})();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bookcore09-pure-'));
const sources=['apps/api/src/modules/governance/governance.domain.ts','apps/api/test/unit/phase09-governance.test.ts'];
try{
 for(const file of sources){const source=fs.readFileSync(file,'utf8');
  const r=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
  if(r.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error))throw new Error('PARSE_ERROR:'+file);
  const out=path.join(tmp,file.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,r.outputText);
 }
 const result=cp.spawnSync(process.execPath,['--test',path.join(tmp,sources[1].replace(/\.ts$/,'.js'))],{encoding:'utf8',timeout:15000});
 process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
 const counts=Object.fromEntries([...(result.stdout||'').matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/gm)].map(m=>[m[1],Number(m[2])]));
 if(result.error||result.status!==0||!counts.tests||counts.tests!==counts.pass||counts.fail!==0||counts.cancelled!==0||counts.skipped!==0||counts.todo!==0)process.exitCode=1;
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
