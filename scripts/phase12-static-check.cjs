'use strict';
const fs=require('node:fs');const assert=require('node:assert/strict');
const needed=['scripts/recovery/policy.cjs','scripts/recovery/exec.cjs','scripts/recovery/backup.cjs',
 'scripts/recovery/restore.cjs','scripts/recovery/verify-backup.cjs','scripts/recovery/retention-preview.cjs',
 'scripts/recovery/storage-growth.cjs','scripts/test-phase12-pure.cjs',
 'apps/api/test/integration/phase12-backup-restore.test.ts'];
for(const f of needed)assert.ok(fs.statSync(f).size>100,'missing source: '+f);
const sql=fs.readdirSync('db/migrations').filter(x=>/^\d{3}_.*\.sql$/.test(x));
assert.deepEqual(sql.sort().slice(0,12).map(name=>Number(name.slice(0,3))),
 Array.from({length:12},(_,index)=>index+1),'Historical migrations 001–012 must be present');
const p=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.ok(p.scripts['test:phase12:isolated']);
const compose=fs.readFileSync('infra/docker/compose.yml','utf8');
assert.match(compose,/read_only: true/);
assert.match(fs.readFileSync('scripts/recovery/restore.cjs','utf8'),/TARGET_NOT_MARKED_DISPOSABLE/);
assert.match(fs.readFileSync('scripts/operational-inspection-v2.ts','utf8'),/selectedScopeComplete/);
console.log('PASS phase12 static controls; migration count:',sql.length);
