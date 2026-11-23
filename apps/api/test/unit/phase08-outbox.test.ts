import test from 'node:test';import assert from 'node:assert/strict';
import {EVENT_AGGREGATES,validateEvent,retryDelayMs,failureCode,PermanentOutboxError} from '../../src/modules/outbox/outbox.domain';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const event={id,tenant_id:id,aggregate_type:'BOOKING',aggregate_id:id,
 event_type:'BookingConfirmed',payload:{bookingId:id,status:'CONFIRMED'},schema_version:1,attempts:1};
test('all documented outbox types map to a source aggregate',()=>{
 assert.equal(EVENT_AGGREGATES.BookingConfirmed,'BOOKING');
 assert.equal(EVENT_AGGREGATES.SessionCancelled,'SESSION');
 assert.equal(Object.keys(EVENT_AGGREGATES).length>=16,true);
});
test('well-formed versioned Booking event validates',()=>assert.doesNotThrow(()=>validateEvent(event)));
test('unsupported event type, tenant mismatch, bad schema and credentials are rejected',()=>{
 for(const invalid of [
  {...event,event_type:'UnknownEvent'}, {...event,aggregate_type:'SESSION'},
  {...event,schema_version:2},{...event,payload:{jwtToken:'do-not-record'}},
  {...event,payload:[]},{...event,id:'bad'}
 ])assert.throws(()=>validateEvent(invalid),PermanentOutboxError);
});
test('retry schedule is bounded and exponential',()=>{
 assert.equal(retryDelayMs(1),1000);assert.equal(retryDelayMs(2),2000);
 assert.equal(retryDelayMs(40),300000);assert.throws(()=>retryDelayMs(0));
});
test('sanitized failure classification',()=>{
 assert.equal(failureCode({code:'40P01'}),'RETRYABLE_DATABASE_CONFLICT');
 assert.equal(failureCode(new Error('secret PII')),'HANDLER_TRANSIENT_FAILURE');
});
