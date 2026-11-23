import test from 'node:test';
import assert from 'node:assert/strict';
import {isEffective,canTransitionBooking,canBook,canCancelBooking,
  encodeBookingCursor,parseBookingPage,canonicalRequest,bookingRejection} from '../../src/modules/booking/booking.domain';
test('effective statuses and terminal transitions',()=>{
 assert.equal(isEffective('CONFIRMED'),true);assert.equal(isEffective('ATTENDED'),true);
 assert.equal(isEffective('NO_SHOW'),true);assert.equal(isEffective('CANCELLED'),false);
 for(const to of ['CANCELLED','ATTENDED','NO_SHOW'] as const){
  assert.equal(canTransitionBooking('CONFIRMED',to),true);
  assert.equal(canTransitionBooking(to,to),false);
 }
 assert.equal(canTransitionBooking('CANCELLED','ATTENDED'),false);
});
test('capacity and published-time cutoff',()=>{
 const start=Date.UTC(2027,0,1,12),now=start-3600000;
 assert.equal(canBook('PUBLISHED',start,now,0,1,30),null);
 assert.equal(canBook('PUBLISHED',start,now,1,1,30),'SESSION_FULL');
 assert.equal(canBook('DRAFT',start,now,0,1,30),'SESSION_NOT_BOOKABLE');
 assert.equal(canBook('PUBLISHED',start,now,0,1,61),'SESSION_NOT_BOOKABLE');
 assert.equal(canBook('PUBLISHED',start,start,0,1,0),'SESSION_NOT_BOOKABLE');
 assert.equal(canBook('PUBLISHED',start,now,4,3,30),'DATABASE_INVARIANT_VIOLATION');
});
test('customer deadline, administrative override and terminal status',()=>{
 const start=Date.UTC(2027,0,1,12);
 assert.equal(canCancelBooking('CONFIRMED','PUBLISHED',start,start-30*60000,120,false),false);
 assert.equal(canCancelBooking('CONFIRMED','PUBLISHED',start,start-30*60000,120,true),true);
 assert.equal(canCancelBooking('ATTENDED','FINISHED',start,start+60000,120,true),false);
 assert.equal(canCancelBooking('CANCELLED','PUBLISHED',start,start-86400000,120,true),false);
});
test('descending stable cursor with bounded filters',()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const from='2026-11-01T00:00:00Z',to='2026-12-01T00:00:00Z';
 const at='2026-11-11T11:30:00.000123Z';
 const parsed=parseBookingPage({from,to,limit:'5',cursor:encodeBookingCursor(at,id,'secret','tenant:user')},'secret','tenant:user');
 assert.equal(parsed.at,'2026-11-11T11:30:00.000123Z');assert.equal(parsed.id,id);assert.equal(parsed.limit,5);
 assert.throws(()=>parseBookingPage({from,to,limit:'101'},'secret','tenant:user'),/INVALID_PAGE_LIMIT/);
 assert.throws(()=>parseBookingPage({from,to,cursor:'invalid!'},'secret','tenant:user'),/INVALID_CURSOR/);
 assert.throws(()=>parseBookingPage({from:to,to:from},'secret','tenant:user'),/INVALID_TIME_WINDOW/);
});

test('canonical idempotency payload ignores key order while retaining semantic differences',()=>{
 assert.equal(canonicalRequest({bookingId:'x',reason:'abc',data:{status:'CONFIRMED',x:1}}),
   canonicalRequest({data:{x:1,status:'CONFIRMED'},reason:'abc',bookingId:'x'}));
 assert.notEqual(canonicalRequest({reason:'abc'}),canonicalRequest({reason:'xyz'}));
});

test('duplicate customer takes precedence over full capacity after locked session read',()=>{
 assert.equal(bookingRejection('SESSION_FULL',true),'BOOKING_ALREADY_EXISTS');
 assert.equal(bookingRejection('SESSION_FULL',false),'SESSION_FULL');
});
