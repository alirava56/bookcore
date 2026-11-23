const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const P=require('../../../../scripts/recovery/policy.cjs');
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'bookcore14-security-'));fs.chmodSync(root,0o700);
 const bin=path.join(root,'pg_restore');fs.writeFileSync(bin,'#!/bin/sh\nexit 0\n',{mode:0o700});
 const key=path.join(root,'age-secret');fs.writeFileSync(key,'AGE-SECRET-IDENTITY-TEST-ONLY',{mode:0o600});
 const ca=path.join(root,'root.crt');fs.writeFileSync(ca,'TEST-CA-PUBLIC-FIXTURE',{mode:0o644});
 return {root,bin,key,ca,close:()=>fs.rmSync(root,{force:true,recursive:true})};
}
test('privileged restore cannot resolve its binary from PATH regardless of environment',()=>{
 for(const state of ['test','development','production']){
  assert.throws(()=>P.tool('pg_restore',{BOOKCORE_ENVIRONMENT:state,PATH:'/tmp'}, {privileged:true}),/TRUSTED_TOOL_PATH_REQUIRED/);
 }
});
test('trusted explicit executable passes, nonexistent and relative paths fail',()=>{
 const f=fixture();try{
  assert.equal(P.tool('pg_restore',{BOOKCORE_PGRESTORE_BIN:f.bin},{privileged:true}),f.bin);
  assert.throws(()=>P.tool('pg_restore',{BOOKCORE_PGRESTORE_BIN:'pg_restore'},{privileged:true}),/TOOL_PATH_NOT_ABSOLUTE/);
  assert.throws(()=>P.tool('pg_restore',{BOOKCORE_PGRESTORE_BIN:'/missing/pg_restore'},{privileged:true}),/UNTRUSTED_TOOL_PATH/);
 }finally{f.close();}
});
test('privileged binary symlinks and group-writable binaries cannot be selected',()=>{
 const f=fixture();try{
  const link=path.join(f.root,'tool-link');fs.symlinkSync(f.bin,link);
  assert.throws(()=>P.tool('pg_restore',{BOOKCORE_PGRESTORE_BIN:link},{privileged:true}),/UNTRUSTED_TOOL_PATH/);
  fs.chmodSync(f.bin,0o775);
  assert.throws(()=>P.tool('pg_restore',{BOOKCORE_PGRESTORE_BIN:f.bin},{privileged:true}),/UNTRUSTED_TOOL_PATH/);
 }finally{f.close();}
});
test('privileged executable in writable ancestor directory is denied',()=>{
 const f=fixture();try{fs.chmodSync(f.root,0o777);
  assert.throws(()=>P.tool('pg_restore',{BOOKCORE_PGRESTORE_BIN:f.bin},{privileged:true}),/TOOL_DIRECTORY_WRITABLE/);
 }finally{f.close();}
});
test('age private identity must be a private regular non-symlink file',()=>{
 const f=fixture();try{
  assert.equal(P.recoveryIdentityFile(f.key),f.key);
  fs.chmodSync(f.key,0o644);
  assert.throws(()=>P.recoveryIdentityFile(f.key),/PRIVATE_FILE_PERMISSIONS_REQUIRED/);
  fs.chmodSync(f.key,0o600);
  const link=path.join(f.root,'fake-age');fs.symlinkSync(f.key,link);
  assert.throws(()=>P.recoveryIdentityFile(link),/REGULAR_FILE_REQUIRED/);
 }finally{f.close();}
});
test('public CA mode 0644 is accepted but writable or symlinked CA is rejected',()=>{
 const f=fixture();try{
  assert.equal(P.trustedPublicFile(f.ca).isFile(),true);
  fs.chmodSync(f.ca,0o666);
  assert.throws(()=>P.trustedPublicFile(f.ca),/PUBLIC_CA_FILE_UNTRUSTED/);
  fs.chmodSync(f.ca,0o644);const link=path.join(f.root,'ca-link');fs.symlinkSync(f.ca,link);
  assert.throws(()=>P.trustedPublicFile(link),/PUBLIC_CA_FILE_UNTRUSTED/);
 }finally{f.close();}
});
test('remote PostgreSQL verify-full accepts trusted readable CA and rejects writable one',()=>{
 const f=fixture();try{
  const e={PGHOST:'db.example.invalid',PGUSER:'recovery',PGDATABASE:'sandbox',PGSSLMODE:'verify-full',PGSSLROOTCERT:f.ca};
  assert.equal(P.checkPgEnvironment(e),undefined);
  fs.chmodSync(f.ca,0o666);assert.throws(()=>P.checkPgEnvironment(e),/PUBLIC_CA_FILE_UNTRUSTED/);
 }finally{f.close();}
});
