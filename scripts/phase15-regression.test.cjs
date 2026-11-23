"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {render,verify}=require('./manifest-core.cjs');
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'bookcore-m15-'));
 fs.writeFileSync(path.join(root,'a.txt'),'base');
 for(let n=0;n<25;n++)fs.writeFileSync(path.join(root,'file'+n+'.txt'),''+n);
 fs.writeFileSync(path.join(root,'MANIFEST.md'),render(root));return root;}
function withFixture(run){const root=fixture();try{return run(root);}finally{fs.rmSync(root,{recursive:true,force:true});}}
test('release manifest matches exact package inventory',()=>withFixture(root=>assert.equal(verify(root).releaseCertified,true)));
test('release rejects a new lockfile until re-frozen',()=>withFixture(root=>{
 fs.writeFileSync(path.join(root,'package-lock.json'),'Genuine resolution only elsewhere');
 assert.throws(()=>verify(root),/MANIFEST_UNTRACKED/);
 const r=verify(root,'workspace');assert.equal(r.releaseCertified,false);
 assert.deepEqual(r.untracked,['package-lock.json']);
 fs.writeFileSync(path.join(root,'MANIFEST.md'),render(root));assert.equal(verify(root).releaseCertified,true);
}));
test('release detects file deletion',()=>withFixture(root=>{
 fs.unlinkSync(path.join(root,'a.txt'));assert.throws(()=>verify(root),/MANIFEST_MISSING/);
}));
test('workspace detects modification of tracked files',()=>withFixture(root=>{
 fs.writeFileSync(path.join(root,'a.txt'),'corruption');assert.throws(()=>verify(root,'workspace'),/MANIFEST_CONTENT_MISMATCH/);
}));
test('release detects unexpected file addition',()=>withFixture(root=>{
 fs.writeFileSync(path.join(root,'extra.txt'),'x');assert.throws(()=>verify(root),/MANIFEST_UNTRACKED/);
}));
test('normal integration discovery excludes destructive recovery; recovery has explicit prereqs',()=>{
 const source=fs.readFileSync(path.join(__dirname,'run-tests.cjs'),'utf8');
 assert.match(source,/mode==='recovery'\?f===RECOVERY:f!==RECOVERY/);
 assert.match(source,/BOOKCORE_PHASE12_RUN_RESTORE/);assert.match(source,/counts\.cancelled===0/);
});
test('dedicated recovery source is retained without mutation',()=>{
 assert.ok(fs.existsSync(path.join(__dirname,'../apps/api/test/integration/phase12-backup-restore.test.ts')));
});

test('runner actually excludes recovery from normal integration and rejects zero tests',()=>{
 const cp=require('node:child_process');
 withFixture(root=>{
  const childEnv={...process.env};delete childEnv.NODE_TEST_CONTEXT;
  const dir=path.join(root,'dist/apps/api/test/integration');
  const source=path.join(root,'apps/api/test/integration');
  fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(source,{recursive:true});
  fs.writeFileSync(path.join(dir,'regular.test.js'),"const test=require('node:test');test('real',()=>{});\n");
  fs.writeFileSync(path.join(source,'regular.test.ts'),"test('real',()=>{});");
  fs.writeFileSync(path.join(dir,'phase12-backup-restore.test.js'),"throw Error('UNAUTHORIZED_RECOVERY_EXECUTED');");
  fs.writeFileSync(path.join(source,'phase12-backup-restore.test.ts'),"test('recovery',()=>{});");
  const result=cp.spawnSync(process.execPath,[path.join(__dirname,'run-tests.cjs'),'integration'],{cwd:root,encoding:'utf8',timeout:30000,env:childEnv});
  assert.equal(result.status,0,(result.stdout||'')+(result.stderr||''));
  assert.match(result.stdout,/RECOVERY ISOLATED/);assert.match(result.stdout,/\"ok\":true/);
  const denied=cp.spawnSync(process.execPath,[path.join(__dirname,'run-tests.cjs'),'recovery'],{cwd:root,encoding:'utf8',env:childEnv});
  assert.equal(denied.status,2);assert.match(denied.stderr,/BLOCKED/);
  fs.unlinkSync(path.join(dir,'regular.test.js'));
  const zero=cp.spawnSync(process.execPath,[path.join(__dirname,'run-tests.cjs'),'integration'],{cwd:root,encoding:'utf8',env:childEnv});
  assert.equal(zero.status,2);assert.match(zero.stderr,/compiled test files do not match the source inventory/);
 });
});
