#!/usr/bin/env node
'use strict';
// Read-only preflight. Never connects to a database, never mutates filesystem.
const fs=require('node:fs'),cp=require('node:child_process');
const {existsSync}=fs;
function run(bin,args){
 const x=cp.spawnSync(bin,args,{encoding:'utf8',timeout:5000});
 return x.status===0 ? String(x.stdout||'').trim().split('\n')[0] : null;
}
const checks={
 node:process.version,
 npm:run('npm',['--version']),
 packageLock:existsSync('package-lock.json'),
 docker:run('docker',['--version']),
 psql:run('psql',['--version']),
 pgDump:run('pg_dump',['--version']),
 pgRestore:run('pg_restore',['--version']),
 age:run('age',['--version']),
 disposableDbAcknowledged:process.env.BOOKCORE_TEST_DATABASE_DISPOSABLE==='yes',
};
const blocked=[];
if(!checks.packageLock)blocked.push('AUTHENTIC_NPM_LOCKFILE_MISSING');
if(!checks.psql)blocked.push('POSTGRESQL_CLIENT_NOT_INSTALLED');
if(!checks.docker)blocked.push('DOCKER_UNAVAILABLE');
if(!checks.pgDump||!checks.pgRestore)blocked.push('POSTGRESQL_BACKUP_TOOLS_NOT_INSTALLED');
console.log(JSON.stringify({phase:'14',verification:'ENVIRONMENT_PREFLIGHT_ONLY',checks,blocked},null,2));
if(blocked.length)process.exitCode=2;
