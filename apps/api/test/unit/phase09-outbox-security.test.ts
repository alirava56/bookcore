import test from 'node:test';import assert from 'node:assert/strict';
import {validateEvent,EVENT_AGGREGATES,PermanentOutboxError} from '../../src/modules/outbox/outbox.domain';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const event=(name:string,payload:unknown,aggregateType=EVENT_AGGREGATES[name]??'UNKNOWN')=>({
 id,tenant_id:id,aggregate_id:id,aggregate_type:aggregateType,event_type:name,payload,schema_version:1,attempts:1
});
test('authentic v1 empty source payloads remain supported',()=>{
 for(const name of ['OrganizationCreated','BranchCreated','SessionDraftCreated','SessionPublished',
  'SessionFinished','BusinessHourCreated','BusinessHourDeactivated'])
  assert.doesNotThrow(()=>validateEvent(event(name,{})));
});
test('BookingConfirmed requires real booking ID and correct status',()=>{
 assert.doesNotThrow(()=>validateEvent(event('BookingConfirmed',{bookingId:id,status:'CONFIRMED'})));
 for(const payload of [{},{bookingId:id},{bookingId:id,status:'CANCELLED'},
  {bookingId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',status:'CONFIRMED'},
  {bookingId:id,status:'CONFIRMED',unexpected:true}])
  assert.throws(()=>validateEvent(event('BookingConfirmed',payload)),PermanentOutboxError);
});
test('BookingCancelled supports both authentic source producer shapes',()=>{
 assert.doesNotThrow(()=>validateEvent(event('BookingCancelled',{bookingId:id,status:'CANCELLED'})));
 assert.deepEqual(validateEvent(event('BookingCancelled',{sessionId:id,reason:'CANCELLED_BY_MANAGER'})),{sessionId:id});
 assert.throws(()=>validateEvent(event('BookingCancelled',{})));
});
test('new governance events validate v1 and aggregate identity',()=>{
 assert.doesNotThrow(()=>validateEvent(event('StaffInvitationCreated',{inviteeId:id,role:'TRAINER'},'STAFF_INVITATION')));
 assert.doesNotThrow(()=>validateEvent(event('BookingConsentGranted',{customerId:id},'BOOKING_CONSENT')));
 assert.throws(()=>validateEvent(event('BookingConsentGranted',{customerId:id},'BOOKING')));
});
test('reject excessive nesting, secret-bearing values, unknown schema/version/type',()=>{
 for(const bad of [
  event('StaffInvitationCreated',{inviteeId:id,role:'OWNER',refreshToken:'very-secret'},'STAFF_INVITATION'),
  {...event('OrganizationCreated',{}),schema_version:20},
  event('NotEmitted',{}),
  event('ResourceCreated',{resourceType:'UNKNOWN'}),
  event('BookingConfirmed',{bookingId:id,status:'CONFIRMED',password:'x'})])
  assert.throws(()=>validateEvent(bad),PermanentOutboxError);
});
