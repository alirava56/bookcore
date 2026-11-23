import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const migrations=readdirSync(resolve(root,'spike/migrations')).filter(f=>f.endsWith('.sql')).sort();
assert.deepEqual(migrations,['001_core.sql','002_resource_guard.sql','003_hardening.sql','004_history_consistency.sql']);
const sql=migrations.map(m=>read(`spike/migrations/${m}`)).join('\n');
const required=[
 'CREATE EXTENSION IF NOT EXISTS btree_gist', 'EXCLUDE USING gist',
 "tstzrange(start_at,end_at,'[)')",'CREATE UNIQUE INDEX unique_effective_booking',
 'FOREIGN KEY(tenant_id,session_id)','DEFERRABLE INITIALLY DEFERRED',
 'CREATE CONSTRAINT TRIGGER idempotency_must_finish',
 'CREATE CONSTRAINT TRIGGER session_integrity_deferred',
 'CREATE CONSTRAINT TRIGGER booking_integrity_deferred',
 'CREATE CONSTRAINT TRIGGER allocation_integrity_deferred',
 'booking_history_immutable','assigned_resource_immutable',
 'CREATE TRIGGER booking_identity_guard','CREATE TRIGGER allocation_identity_guard',
 'CREATE TRIGGER session_identity_guard','CREATE TRIGGER resource_identity_guard',
 'CREATE TRIGGER allocation_resource_lock_guard',
 'CREATE FUNCTION verify_booking_history','OLD.tenant_id, OLD.session_id',
 'new booking must be confirmed',
 'CREATE CONSTRAINT TRIGGER booking_event_integrity_deferred',
 'CREATE FUNCTION enforce_booking_event_insert',
 'CREATE UNIQUE INDEX booking_event_logical_order',
 'terminal booking is immutable',
 'terminal session is immutable',
 'cancellation event reason differs from booking'
];
for(const token of required)assert.ok(sql.includes(token),`missing SQL source element: ${token}`);
assert.equal((sql.match(/\$\$/g)||[]).length%2,0,'odd count of dollar-quote delimiters');
const src=read('spike/src/operations.ts'),db=read('spike/src/db.ts'),worker=read('spike/src/worker.ts');
for(const token of ['sessionLock(c,','claim(c,','await event(c,', 'SESSION_FULL','CAPACITY_BELOW_COMMITTED'])
 assert.ok(src.includes(token),`missing operations token: ${token}`);
for(const token of ['UnknownCommitOutcome','serverRejectedTransaction','COMMIT','ROLLBACK','client.release('])
 assert.ok(db.includes(token),`missing transaction token: ${token}`);
for(const token of ['await closeDb()','process.disconnect()','type:\'fatal\''])
 assert.ok(worker.includes(token),`missing worker lifecycle token: ${token}`);
const tests=read('spike/tests/spike.test.ts');
const testCount=(tests.match(/\btest\(\s*['"`]/g)||[]).length;
assert.ok(testCount>=40,`only ${testCount} tests declared; expected 40+ adversarial test cases`);
assert.ok(read('tools/run_tests.mjs').includes('shouldFailRunner'));
assert.ok(read('spike/src/migrate.ts').includes('MIGRATION_DRIFT'));
assert.ok(read('.github/workflows/postgres-spike.yml').includes('npm ci'));
const reference=resolve(root,'reference/Phase_01/BookCore_Phase_01');
assert.ok(statSync(resolve(reference,'MANIFEST.md')).isFile());
const lines=read('reference/Phase_01/BookCore_Phase_01/MANIFEST.md');
const entries=[...lines.matchAll(/^\| `([^`]+)` \| `([a-f0-9]{64})` \|/gm)];
assert.equal(entries.length,23,'Phase01 manifest must list 23 original non-manifest files');
for(const [,name,hash] of entries){
 const f=resolve(reference,name);assert.ok(existsSync(f),`missing original ${name}`);
 assert.equal(createHash('sha256').update(readFileSync(f)).digest('hex'),hash,`Phase01 hash mismatch ${name}`);
}
const originalFiles=[];
function walk(dir,base=''){
 for(const entry of readdirSync(dir,{withFileTypes:true})){
  const relative=base?`${base}/${entry.name}`:entry.name;
  if(entry.isDirectory())walk(resolve(dir,entry.name),relative);
  else if(entry.isFile())originalFiles.push(relative);
 }
}
walk(reference);
assert.deepEqual(originalFiles.filter(x=>x!=='MANIFEST.md').sort(),entries.map(x=>x[1]).sort());
console.log(JSON.stringify({status:'STATIC_SOURCE_INSPECTION_PASS',
  migrations:migrations.length,declaredTestCalls:testCount,phase01Sha256Verified:entries.length,
  limitations:['Not a PostgreSQL parser','Not SQL execution','Not a TypeScript typecheck','Not runtime test counts']},null,2));
