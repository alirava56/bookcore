'use strict';
// Executes the *actual* pure domain TypeScript and its node:test suite without NestJS/pg.
// transpileModule is NOT typechecking. Runtime PostgreSQL checks are separate.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
let ts;
try{ts=require('typescript');}catch{
 const npmRoot=cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
 ts=require(path.join(npmRoot,'typescript'));
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bookcore-p06-domain-'));
try{
 const files=['apps/api/src/modules/scheduling/session.domain.ts','apps/api/test/unit/session-domain.test.ts'];
 for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true);
  if(parsed.parseDiagnostics.length)throw new Error(`Syntax error: ${file}`);
  const out=ts.transpileModule(source,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
  const target=path.join(temp,file.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,out.outputText);
 }
 const result=cp.spawnSync(process.execPath,['--test',path.join(temp,'apps/api/test/unit/session-domain.test.js')],
  {encoding:'utf8',timeout:15000});
 process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
 if(result.status!==0||result.error)process.exitCode=1;
}finally{fs.rmSync(temp,{recursive:true,force:true});}
