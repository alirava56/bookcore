'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bookcore-runner-'));
try {
 const compiled=path.join(dir,'dist/apps/api/test/unit');
 const source=path.join(dir,'apps/api/test/unit');
 fs.mkdirSync(compiled,{recursive:true});fs.mkdirSync(source,{recursive:true});
 const runner=path.resolve(__dirname,'run-tests.cjs');
 const run=()=>cp.spawnSync(process.execPath,[runner,'unit'],{cwd:dir,encoding:'utf8',timeout:5000});
 assert.notEqual(run().status,0,'missing tests must fail');
 fs.writeFileSync(path.join(compiled,'fixture.test.js'),'// intentionally empty\n');
 fs.writeFileSync(path.join(source,'fixture.test.ts'),'// no tests here\n');
 assert.notEqual(run().status,0,'zero discovered tests must fail');
 fs.writeFileSync(path.join(source,'fixture.test.ts'),"test('a',()=>{});\n");
 fs.writeFileSync(path.join(compiled,'fixture.test.js'),"const test=require('node:test'); test('a',()=>{});\n");
 // Source declarations without executable compiled test calls must fail too.
 fs.writeFileSync(path.join(compiled,'fixture.test.js'),'// no runtime calls\n');
 assert.notEqual(run().status,0,'source-only phantom test must fail');
 fs.writeFileSync(path.join(compiled,'fixture.test.js'),"const test=require('node:test'); test('a',()=>{});\n");
 const ok=run();assert.equal(ok.status,0,ok.stdout+ok.stderr);
 // TypeScript ESModuleInterop commonly emits (0, node_test_1.default)(...), not test(...).
 fs.writeFileSync(path.join(compiled,'fixture.test.js'),"const node_test_1 = require('node:test'); (0, node_test_1.default)('a',()=>{});\n");
 // Use actual default import interop wrapper to make a runnable transpilation-shaped fixture.
 fs.writeFileSync(path.join(compiled,'fixture.test.js'),"const node_test_1={default:require('node:test')}; (0, node_test_1.default)('a',()=>{});\n");
 const transpiled=run();assert.equal(transpiled.status,0,transpiled.stdout+transpiled.stderr);
 fs.writeFileSync(path.join(compiled,'fixture.test.js'),"const test=require('node:test'); test('a',()=>{throw new Error('fail')});\n");
 assert.notEqual(run().status,0,'failed test must fail');
 console.log('PASS runner regression: missing, zero, successful, failed cases');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
