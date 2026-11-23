'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const ts=(()=>{try{return require('typescript');}catch{return require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}})();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bookcore10-pure-'));
const sources=[
 'apps/api/src/modules/operations/operations.domain.ts',
 'apps/api/src/modules/governance/governance.domain.ts',
 'apps/api/test/unit/phase10-operations.test.ts'];
try{
 for(const name of sources){
  const result=ts.transpileModule(fs.readFileSync(name,'utf8'),{fileName:name,reportDiagnostics:true,
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
  if(result.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error))throw Error('TRANSPILE_FAILED:'+name);
  const to=path.join(dir,name.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,result.outputText);
 }
 const runner=cp.spawnSync(process.execPath,['--test',path.join(dir,sources[2].replace(/\.ts$/,'.js'))],
  {encoding:'utf8',timeout:20000});
 process.stdout.write(runner.stdout||'');process.stderr.write(runner.stderr||'');
 const values=Object.fromEntries([...(runner.stdout||'').matchAll(/^# (tests|pass|fail|skipped|cancelled|todo) (\d+)$/gm)]
  .map(m=>[m[1],Number(m[2])]));
 if(runner.error||runner.status!==0||!values.tests||values.pass!==values.tests||
    values.fail!==0||values.cancelled!==0||values.skipped!==0||values.todo!==0)process.exitCode=1;
}finally{fs.rmSync(dir,{recursive:true,force:true});}
