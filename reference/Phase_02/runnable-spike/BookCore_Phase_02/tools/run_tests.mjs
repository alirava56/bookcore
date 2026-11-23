import {readdirSync,existsSync,readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

export function testCountFromTap(output) {
  const all=[...output.matchAll(/^# tests (\d+)\s*$/gm)];
  return all.length?Number(all.at(-1)[1]):-1;
}
export function shouldFailRunner(exitCode,discovered,runtimeCount,min=1,failed=0,skipped=0) {
  return exitCode!==0 || discovered<min || runtimeCount<min || runtimeCount!==discovered || failed>0 || skipped>0;
}
export function countCompiledTestDeclarations(source) {
  // A compiled entry point with no explicit test(...) must never pass merely
  // because node --test counts the empty file itself as one passing subtest.
  return (source.match(/\btest\s*\(/g)||[]).length;
}
export function tapNumber(output,key) {
  const matches=[...output.matchAll(new RegExp(`^# ${key} (\\d+)\\s*$`,'gm'))];
  return matches.length?Number(matches.at(-1)[1]):-1;
}
if(process.argv.includes('--self-test')) {
 assert.equal(testCountFromTap('# tests 0\n# pass 0\n'),0);
 assert.equal(testCountFromTap('garbage'),-1);
 assert.equal(testCountFromTap('# tests 27\n# pass 27\n'),27);
 assert.ok(shouldFailRunner(0,0,0));
 assert.ok(shouldFailRunner(0,2,0));
 assert.ok(shouldFailRunner(1,2,2));
 assert.equal(shouldFailRunner(0,2,2),false);
 assert.ok(shouldFailRunner(0,2,2,1,1,0));
 assert.ok(shouldFailRunner(0,2,2,1,0,1));
 assert.equal(tapNumber('# fail 0\n','fail'),0);
 assert.equal(countCompiledTestDeclarations('// nothing\n'),0);
 assert.equal(countCompiledTestDeclarations('test("case", () => {})'),1);
 const isolated=mkdtempSync(resolve(tmpdir(),'bookcore-zero-test-'));
 try {
   mkdirSync(resolve(isolated,'dist/tests'),{recursive:true});
   writeFileSync(resolve(isolated,'dist/tests/empty.test.js'),'// intentionally no tests\n');
   const run=spawnSync(process.execPath,[resolve(import.meta.dirname,'run_tests.mjs')],{
     cwd:isolated,encoding:'utf8',timeout:10000
   });
   assert.notEqual(run.status,0,'empty compiled test file must make runner fail');
   assert.match((run.stderr??'')+(run.stdout??''),/zero explicit test declarations/i);
 } finally { rmSync(isolated,{recursive:true,force:true}); }
 console.log('PASS zero-test runner regression: missing, empty, runner-error and mismatch reject');
} else {
 const testsDir=resolve(process.cwd(),'dist/tests');
 if(!existsSync(testsDir)) {
   console.error(`FAIL: compiled test directory missing: ${testsDir}; run npm run build`);
   process.exitCode=2;
 } else {
   const files=readdirSync(testsDir).filter(x=>x.endsWith('.test.js')).sort().map(x=>resolve(testsDir,x));
   const declarations=files.reduce((count,path)=>count+countCompiledTestDeclarations(readFileSync(path,'utf8')),0);
   if(files.length===0 || declarations===0) {
     console.error('FAIL: zero explicit test declarations in compiled entry points');
     process.exitCode=2;
   } else {
     const proc=spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{
       cwd:process.cwd(),env:process.env,encoding:'utf8',timeout:900_000,maxBuffer:15*1024*1024
     });
     const out=(proc.stdout??'')+(proc.stderr??'');
     process.stdout.write(out);
     const discovered=testCountFromTap(out);
     const min=Number(process.env.BOOKCORE_MIN_TESTS||1);
     const effectiveExit=proc.error?1:(proc.status??1);
     const failedCount=tapNumber(out,'fail'),skippedCount=tapNumber(out,'skipped');
     const passedCount=tapNumber(out,'pass');
     const failed=shouldFailRunner(effectiveExit,discovered,discovered,min,failedCount,skippedCount) || passedCount<0 || discovered<declarations;
     console.log(JSON.stringify({type:'bookcore-test-runner',files:files.length,
       tests_declared:declarations,tests_discovered:discovered,tests_passed:passedCount,tests_failed:failedCount,tests_skipped:skippedCount,exit_code:effectiveExit,signal:proc.signal,
       timed_out:proc.error?.code==='ETIMEDOUT',passed:!failed}));
     if(failed){
       console.error('FAIL: test runner exited abnormally, timed out, or discovered too few tests');
       process.exitCode=1;
     }
   }
 }
}
