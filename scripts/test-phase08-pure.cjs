'use strict';
// Executes the real TypeScript pure-domain modules, no fake Node/PostgreSQL driver.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const ts=(()=>{try{return require('typescript');}catch{return require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}})();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bookcore08-pure-'));
const sources=[
 'apps/api/src/modules/booking/booking.domain.ts',
 'apps/api/src/modules/booking/booking-error.ts',
 'apps/api/src/modules/reporting/reporting.domain.ts',
 'apps/api/src/modules/outbox/outbox.domain.ts',
 'apps/api/test/unit/booking-domain.test.ts',
 'apps/api/test/unit/phase08-cursor.test.ts',
 'apps/api/test/unit/phase08-db-errors.test.ts',
 'apps/api/test/unit/phase08-outbox.test.ts',
 'apps/api/test/unit/phase08-reporting.test.ts',
 'apps/api/test/unit/phase09-outbox-security.test.ts'];
try{
 for(const file of sources){
  const src=fs.readFileSync(file,'utf8');const result=ts.transpileModule(src,{fileName:file,reportDiagnostics:true,
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
  if(result.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error))throw new Error('TRANSPILE_ERROR:'+file);
  const out=path.join(tmp,file.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,result.outputText);
 }
 const tests=sources.filter(x=>x.includes('/test/')).map(x=>path.join(tmp,x.replace(/\.ts$/,'.js')));
 const r=cp.spawnSync(process.execPath,['--test',...tests],{encoding:'utf8',timeout:30000});
 process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');
 if(r.status!==0||!/# pass [1-9]\d*/.test(r.stdout||'')||!/# fail 0/.test(r.stdout||''))process.exitCode=1;
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
