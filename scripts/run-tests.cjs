"use strict";
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const RECOVERY='phase12-backup-restore.test.js';
const CONCURRENCY=new Set(['booking-postgres.test.js','phase08-postgres.test.js','phase09-postgres.test.js']);
const mode=process.argv[2];
if(!['unit','integration','database','concurrency','recovery'].includes(mode)||process.argv.length!==3){
 console.error('Usage: run-tests.cjs unit|integration|database|concurrency|recovery');process.exit(2);
}
if(mode==='recovery'&&(process.env.BOOKCORE_PHASE12_RUN_RESTORE!=='yes'||
 process.env.BOOKCORE_TEST_DATABASE_DISPOSABLE!=='yes'||
 process.env.BOOKCORE_PHASE12_DISPOSABLE_SOURCE!=='yes'||
 !process.env.BOOKCORE_DISPOSABLE_RESTORE_TARGET||
 process.env.BOOKCORE_RESTORE_ISOLATED_INSTANCE!=='yes'||
 !process.env.BOOKCORE_RECOVERY_MANIFEST_FILE||
 !/^[a-f0-9]{64}$/.test(process.env.BOOKCORE_TRUSTED_MANIFEST_SHA256||''))){
 console.error('BLOCKED: dedicated authorized disposable RESTORE environment and trusted provenance required');process.exit(2);
}
const group=mode==='unit'?'unit':'integration';
const dir=path.join(process.cwd(),'dist','apps','api','test',group);
if(!fs.existsSync(dir)){console.error('BLOCKED: compiled test directory absent; build first:',dir);process.exit(2);}
const all=fs.readdirSync(dir).filter(f=>f.endsWith('.test.js')).sort();
const sourceDir=path.join(process.cwd(),'apps','api','test',group);
const expected=fs.readdirSync(sourceDir).filter(f=>f.endsWith('.test.ts')).sort().map(f=>f.replace(/\.ts$/,'.js'));
if(all.join('\n')!==expected.join('\n')){console.error('FAIL: compiled test files do not match the source inventory');process.exit(2);}
const chosen=all.filter(f=>mode==='recovery'?f===RECOVERY:f!==RECOVERY).filter(f=>{
 if(mode==='concurrency')return CONCURRENCY.has(f);
 if(mode==='database')return !CONCURRENCY.has(f);
 return true;
});
if(!chosen.length || mode==='concurrency'&&chosen.length!==CONCURRENCY.size){
 console.error('FAIL: zero required compiled tests or missing concurrency suite');process.exit(2);
}
if(mode==='integration'&&all.includes(RECOVERY))console.log('RECOVERY ISOLATED: separate authorized test:recovery suite; status NOT RUN by this command');
let declarations=0;
const countDeclarations=source=>(source.match(/(?<![\w.])test\s*\(/g)||[]).length;
for(const name of chosen){
 const source=path.join(sourceDir,name.replace(/\.js$/,'.ts'));
 declarations+=countDeclarations(fs.readFileSync(source,'utf8'));
}
if(!declarations){console.error('FAIL: zero explicit tests');process.exit(2);}
const compiledCalls=chosen.reduce((n,f)=>n+(fs.readFileSync(path.join(dir,f),'utf8').match(/\b(?:test|node_test_\d+\.default)\s*\(|\(\s*0\s*,\s*node_test_\d+\.default\s*\)\s*\(/g)||[]).length,0);
if(compiledCalls<declarations){console.error('FAIL: compiled test calls fewer than source declarations');process.exit(2);}

const nativeDir=path.join(process.cwd(),'apps','api','test','unit');
const native=mode==='unit'?fs.readdirSync(nativeDir).filter(f=>f.endsWith('.test.cjs')).sort().map(f=>path.join(nativeDir,f)):[];
for(const file of native)declarations+=countDeclarations(fs.readFileSync(file,'utf8'));
const flags=mode==='unit'?[]:['--test-concurrency=1'];
const result=cp.spawnSync(process.execPath,['--test','--test-reporter=tap',...flags,...chosen.map(f=>path.join(dir,f)),...native],
 {encoding:'utf8',timeout:900000,maxBuffer:25*1024*1024,env:process.env});
const output=(result.stdout||'')+(result.stderr||'');process.stdout.write(output);
const last=(label)=>{const found=[...output.matchAll(new RegExp('^# '+label+' (\\d+)\\s*$','gm'))];return found.length?Number(found.at(-1)[1]):-1;};
const counts={discovered:last('tests'),passed:last('pass'),failed:last('fail'),skipped:last('skipped'),cancelled:last('cancelled')};
const ok=result.status===0&&!result.error&&counts.discovered>=declarations&&counts.passed>=declarations&&
 counts.failed===0&&counts.skipped===0&&counts.cancelled===0;
console.log(JSON.stringify({suite:mode,files:chosen.length+native.length,declarations,counts,exit:result.status,ok}));
if(!ok)process.exitCode=1;
