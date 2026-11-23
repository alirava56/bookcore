import test from 'node:test';import assert from 'node:assert/strict';
import {bookingPgError} from '../../src/modules/booking/booking-error';
test('only the correct partial unique index means effective duplicate booking',()=>{
 assert.deepEqual(bookingPgError({code:'23505',constraint:'unique_effective_booking'}),
  {status:409,code:'BOOKING_ALREADY_EXISTS'});
 assert.deepEqual(bookingPgError({code:'23505',constraint:'booking_event_logical_order'}),
  {status:409,code:'DATABASE_CONSTRAINT_CONFLICT'});
});
test('SQLSTATE constraints and concurrency never disclose SQL',()=>{
 for(const state of ['23503','23P01','23514','40P01','40001','55P03','57014']){
  const x=bookingPgError({code:state,message:'SECRET_DB_CREDENTIAL'});
  assert.ok(x);assert.equal(JSON.stringify(x).includes('SECRET_DB_CREDENTIAL'),false);
 }
 assert.equal(bookingPgError({code:'08006'}),null);
});
