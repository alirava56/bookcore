'use strict';
const {spawnSync}=require('node:child_process');
const files=['apps/api/test/unit/phase12-recovery.test.cjs'];
const r=spawnSync(process.execPath,['--test',...files],{encoding:'utf8',timeout:45000});
process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
const entries=Object.fromEntries([...(r.stdout||'').matchAll(/^# (tests|pass|fail|skipped|cancelled|todo) (\d+)$/gm)].map(m=>[m[1],Number(m[2])]));
if(r.error||r.status!==0||!entries.tests||entries.pass!==entries.tests||entries.fail!==0||
 entries.skipped!==0||entries.cancelled!==0||entries.todo!==0)process.exitCode=1;
