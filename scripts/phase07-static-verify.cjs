'use strict';
const fs=require('node:fs');const assert=require('node:assert/strict');
const files=['apps/api/src/modules/booking/booking.domain.ts','apps/api/src/modules/booking/booking.dto.ts',
 'apps/api/src/modules/booking/booking.controller.ts','apps/api/src/modules/booking/booking.service.ts',
 'apps/api/src/modules/booking/booking.module.ts','apps/api/src/modules/booking/booking-rate.guard.ts',
 'db/migrations/008_booking_permissions.sql','apps/api/test/integration/booking-postgres.test.ts',
 'apps/api/test/integration/phase07-api-worker.cjs','apps/api/test/unit/booking-domain.test.ts'];
files.forEach(x=>assert.ok(fs.existsSync(x),'MISSING_PHASE07:'+x));
const app=fs.readFileSync('apps/api/src/app.module.ts','utf8');
assert.match(app,/BookingModule/);assert.match(app,/APP_GUARD/);
const service=fs.readFileSync('apps/api/src/modules/booking/booking.service.ts','utf8');
for(const required of ['FOR UPDATE','FOR SHARE','BookingConfirmed','BookingCancelled',
 'CANCELLATION_WINDOW_CLOSED','BOOKING_CONSENT_REQUIRED','Idempotency-Key','seats_committed=seats_committed+1',
 'seats_committed=seats_committed-1']){
 if(required==='Idempotency-Key')assert.match(fs.readFileSync('apps/api/src/modules/booking/booking.controller.ts','utf8'),/Idempotency-Key/);
 else assert.ok(service.includes(required),'MISSING_CRITICAL_SOURCE_PATTERN:'+required);
}
const ddl=fs.readFileSync('db/migrations/008_booking_permissions.sql','utf8');
assert.match(ddl,/GRANT SELECT,INSERT ON bookings/);assert.match(ddl,/GRANT USAGE ON SEQUENCE/);
console.log('PASS Phase07 source presence and safety-oriented static invariants; NOT a DB verification');
