import test from 'node:test';import assert from 'node:assert/strict';
import {encodeBookingCursor,parseBookingPage} from '../../src/modules/booking/booking.domain';
const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',s='page-secret',scope='org:user';
const base={from:'2026-11-01T00:00:00Z',to:'2026-12-01T00:00:00Z',limit:'5'};
test('microseconds are not rounded during cursor encode/decode',()=>{
 const time='2026-11-11T00:00:00.000001Z';
 assert.equal(parseBookingPage({...base,cursor:encodeBookingCursor(time,id,s,scope)},s,scope).at,time);
});
test('same millisecond distinct microseconds are ordered deterministically',()=>{
 const times=['2026-11-11T00:00:00.000102Z','2026-11-11T00:00:00.000101Z',
  '2026-11-11T00:00:00.000100Z'];
 const cursors=times.map(t=>encodeBookingCursor(t,id,s,scope));
 assert.deepEqual(cursors.map(c=>parseBookingPage({...base,cursor:c},s,scope).at),times);
});
test('cursor cannot be tampered with or replayed under another user',()=>{
 const token=encodeBookingCursor('2026-11-11T00:00:00.000001Z',id,s,scope);
 assert.throws(()=>parseBookingPage({...base,cursor:token},s,'another-org:user'),/INVALID_CURSOR/);
 const tampered='A'+token.slice(1);
 assert.throws(()=>parseBookingPage({...base,cursor:tampered},s,scope),/INVALID_CURSOR/);
 assert.throws(()=>encodeBookingCursor('2026-02-30T00:00:00.999999Z',id,s,scope),/INVALID_CURSOR/);
});
