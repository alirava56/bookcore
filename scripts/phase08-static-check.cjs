'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
for(const p of [
 'db/migrations/009_outbox_delivery.sql',
 'apps/api/src/modules/reporting/reporting.service.ts',
 'apps/api/src/modules/outbox/outbox.worker.ts',
 'apps/api/test/integration/phase08-postgres.test.ts',
 'scripts/outbox-worker.ts','docs/engineering/PHASE_08_FINAL_REPORT_FA.md'])
 assert.ok(fs.existsSync(p),`missing ${p}`);
const app=fs.readFileSync('apps/api/src/app.module.ts','utf8');
assert.match(app,/ReportingModule/);assert.match(app,/APP_GUARD/);
const reports=fs.readFileSync('apps/api/src/modules/reporting/reporting.service.ts','utf8');
assert.match(reports,/FROM memberships/);assert.match(reports,/JOIN auth_sessions/);
const worker=fs.readFileSync('apps/api/src/modules/outbox/outbox.worker.ts','utf8');
assert.match(worker,/FOR UPDATE OF e SKIP LOCKED/);assert.match(worker,/ON CONFLICT \(event_id\) DO NOTHING/);
const booking=fs.readFileSync('apps/api/src/modules/booking/booking.service.ts','utf8');
assert.match(booking,/created_at_cursor/);assert.match(booking,/bookingPgError/);
console.log('PASS Phase08 structural requirements (source-only)');
