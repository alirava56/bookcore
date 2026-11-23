import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyBookingContentionResults} from '../../src/modules/booking/contention-result';
const success=(i:number)=>({status:201,body:{id:`booking-${i}`}});
const full=()=>({status:409,body:{code:'SESSION_FULL'}});
const batch=(capacity:number):{status:number;body:Record<string,unknown>}[]=>
 Array.from({length:100},(_,i)=>i<capacity?success(i):full());
test('capacity 1 accepts only one confirmed and 99 documented SESSION_FULL',()=>{
 const r=verifyBookingContentionResults(batch(1),1);assert.equal(r.successful,1);assert.equal(r.businessRejected,99);
});
test('capacity 20 requires 20 successes and 80 documented rejections',()=>{
 const r=verifyBookingContentionResults(batch(20),20);assert.equal(r.successful,20);assert.equal(r.businessRejected,80);
});
test('technical HTTP 503 is rejected even when status counts look successful',()=>{
 const x=batch(1);x[99]={status:503,body:{code:'DEPENDENCY_UNAVAILABLE'}};
 assert.throws(()=>verifyBookingContentionResults(x,1),/CONTENTION_UNEXPECTED_RESPONSE/);
});
test('unknown 409 and 429 are not acceptable business rejection',()=>{
 for(const bad of [{status:409,body:{code:'DATABASE_CONSTRAINT_CONFLICT'}},
  {status:429,body:{code:'RATE_LIMITED'}}]){
  const x=batch(20);x[99]=bad;assert.throws(()=>verifyBookingContentionResults(x,20),/UNEXPECTED_RESPONSE/);
 }
});
test('missing responses, missing success body and count deviations fail closed',()=>{
 assert.throws(()=>verifyBookingContentionResults(batch(1).slice(1),1),/REQUEST_COUNT/);
 const x=batch(1);x[0]={status:201,body:{}};assert.throws(()=>verifyBookingContentionResults(x,1),/SUCCESS_MISSING_BOOKING/);
 assert.throws(()=>verifyBookingContentionResults(batch(20),1),/COUNT_MISMATCH/);
});
