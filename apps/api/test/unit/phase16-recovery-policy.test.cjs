"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {backup}=require('../../../../scripts/recovery/backup.cjs');
const {tool}=require('../../../../scripts/recovery/policy.cjs');
const fixture=()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'bookcore16-'));fs.chmodSync(d,0o700);return d;};
const base={PGHOST:'127.0.0.1',PGUSER:'synthetic',PGDATABASE:'synthetic_db',BOOKCORE_ENVIRONMENT:'test'};
test('backup rejects untrusted PATH even when fake pg_dump is on PATH',async()=>{
 const folder=fixture();try{
  fs.writeFileSync(path.join(folder,'pg_dump'),'#!/bin/sh\necho hostile\n',{mode:0o700});
  await assert.rejects(()=>backup({directory:folder}, {...base,PATH:folder+':'+process.env.PATH}),/TRUSTED_TOOL_PATH_REQUIRED/);
  assert.equal(fs.readdirSync(folder).some(f=>f.endsWith('.dump')),false);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('backup policy requires pinned psql and pg_dump independently',()=>{
 assert.throws(()=>tool('psql',base,{privileged:true}),/TRUSTED_TOOL_PATH_REQUIRED/);
 assert.throws(()=>tool('pg_dump',base,{privileged:true}),/TRUSTED_TOOL_PATH_REQUIRED/);
});
test('pinned producer tool rejects group writable executable and symlink',()=>{
 const folder=fixture();try{
  const f=path.join(folder,'pg_dump');fs.writeFileSync(f,'#!/bin/sh\nexit 0\n',{mode:0o700});
  assert.equal(tool('pg_dump',{BOOKCORE_PGDUMP_BIN:f},{privileged:true}),f);
  fs.chmodSync(f,0o777);assert.throws(()=>tool('pg_dump',{BOOKCORE_PGDUMP_BIN:f},{privileged:true}),/UNTRUSTED_TOOL_PATH/);
  fs.chmodSync(f,0o700);const l=path.join(folder,'link');fs.symlinkSync(f,l);
  assert.throws(()=>tool('pg_dump',{BOOKCORE_PGDUMP_BIN:l},{privileged:true}),/UNTRUSTED_TOOL_PATH/);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
