'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
let ts;try{ts=require('typescript');}catch{ts=require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}
// Independent parser regression: counts must follow TAP, never a hard-coded test total.
function validTap(output,exitStatus){
 const counts=Object.fromEntries([...output.matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/gm)]
  .map(match=>[match[1],Number(match[2])]));
 return exitStatus===0&&Number.isInteger(counts.tests)&&counts.tests>0&&
  counts.tests===counts.pass&&counts.fail===0&&counts.cancelled===0&&
  counts.skipped===0&&counts.todo===0;
}
function sample(tests,passed=tests,failed=0,skipped=0){return `# tests ${tests}\n# pass ${passed}\n# fail ${failed}\n# cancelled 0\n# skipped ${skipped}\n# todo 0\n`;}
if(!validTap(sample(1),0)||!validTap(sample(7),0)||!validTap(sample(19),0)||
   validTap(sample(0),0)||validTap(sample(7,6,1),0)||validTap(sample(7,6,0,1),0)||
   validTap(sample(7),1)||validTap('# tests 7\n# pass 7\n',0))
 throw new Error('TAP_PARSER_REGRESSION_FAILURE');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bookcore-p07-pure-'));
try{
 for(const f of ['apps/api/src/modules/booking/booking.domain.ts','apps/api/test/unit/booking-domain.test.ts']){
  const src=fs.readFileSync(f,'utf8');const ast=ts.createSourceFile(f,src,ts.ScriptTarget.ES2022,true);
  if(ast.parseDiagnostics.length)throw new Error('TS_PARSE_FAILURE:'+f);
  const js=ts.transpileModule(src,{fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
  const dest=path.join(tmp,f.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,js.outputText);
 }
 const p=cp.spawnSync(process.execPath,['--test',path.join(tmp,'apps/api/test/unit/booking-domain.test.js')],{encoding:'utf8',timeout:15000});
 process.stdout.write(p.stdout??'');process.stderr.write(p.stderr??'');
 if(p.error||!validTap(p.stdout||'',p.status))process.exitCode=1;
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
