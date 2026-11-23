const fs=require('node:fs'),assert=require('node:assert/strict');
const needed=['apps/api/src/common/observability/metrics.domain.ts','apps/api/src/common/observability/metrics.controller.ts',
 'apps/api/src/common/observability/observability.module.ts','apps/api/test/unit/phase13-recovery.test.cjs',
 'scripts/test-phase13-pure.cjs','scripts/recovery/backup.cjs','scripts/recovery/restore.cjs'];
for(const file of needed)assert.ok(fs.statSync(file).size>100,file);
const sql=fs.readdirSync('db/migrations').filter(n=>n.endsWith('.sql'));
assert.deepEqual(sql.sort().slice(0,12).map(name=>Number(name.slice(0,3))),
 Array.from({length:12},(_,index)=>index+1),'Historical migrations 001–012 must be present');
assert.match(fs.readFileSync('scripts/recovery/restore.cjs','utf8'),/session_user/);
assert.match(fs.readFileSync('scripts/recovery/backup.cjs','utf8'),/ENCRYPTED_BACKUP_CREATED_DECRYPTION_UNVERIFIED/);
assert.match(fs.readFileSync('apps/api/src/app.module.ts','utf8'),/ObservabilityModule/);
assert.match(fs.readFileSync('apps/api/src/common/observability/metrics.controller.ts','utf8'),/MonitorGuard/);
console.log('PASS Phase13 static contracts; not Runtime/PG evidence');
