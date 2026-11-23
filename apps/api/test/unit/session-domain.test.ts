import test from 'node:test';
import assert from 'node:assert/strict';
import {canTransition,validCapacity,boundedInterval,bufferedInterval,parseSessionPage,encodeSessionCursor} from '../../src/modules/scheduling/session.domain';
test('DRAFT may publish or cancel, not finish',()=>{
 assert.equal(canTransition('DRAFT','PUBLISHED'),true);
 assert.equal(canTransition('DRAFT','CANCELLED'),true);
 assert.equal(canTransition('DRAFT','FINISHED'),false);
});
test('PUBLISHED may finish or cancel, not republish',()=>{
 assert.equal(canTransition('PUBLISHED','FINISHED'),true);
 assert.equal(canTransition('PUBLISHED','CANCELLED'),true);
 assert.equal(canTransition('PUBLISHED','PUBLISHED'),false);
});
test('terminal Session states forbid every transition',()=>{
 for(const s of ['CANCELLED','FINISHED'] as const)for(const t of ['PUBLISHED','CANCELLED','FINISHED'] as const)
  assert.equal(canTransition(s,t),false);
});
test('capacity validation rejects below committed, negative and overflow',()=>{
 assert.equal(validCapacity(1,1),true);assert.equal(validCapacity(20,21),false);
 assert.equal(validCapacity(0,0),false);assert.equal(validCapacity(1001,0),false);
 assert.equal(validCapacity(2,-1),false);assert.equal(validCapacity(1.2,0),false);
});
test('future half-open intervals require an ordered duration <= 24h',()=>{
 const now=Date.now();assert.ok(boundedInterval(now+1000,now+60000,now));
 assert.equal(boundedInterval(now,now+1000,now),false);
 assert.equal(boundedInterval(now+1000,now+1000,now),false);
 assert.equal(boundedInterval(now+1000,now+90000000,now),false);
});
test('buffer extension applies to both sides without modifying occurrence',()=>{
 const r=bufferedInterval('2027-01-01T10:00:00Z','2027-01-01T11:00:00Z',30,15);
 assert.equal(r.startAt,'2027-01-01T09:30:00.000Z');assert.equal(r.endAt,'2027-01-01T11:15:00.000Z');
 assert.throws(()=>bufferedInterval('2027-01-01T10:00:00Z','2027-01-01T11:00:00Z',-1,0));
});
test('cursor is strict, stable and roundtrips same-start tie break',()=>{
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const start='2027-01-01T10:00:00.000Z';const cursor=encodeSessionCursor(start,id);
 const result=parseSessionPage('2027-01-01T00:00:00Z','2027-01-02T00:00:00Z','2',cursor);
 assert.equal(result.cursorStart,start);assert.equal(result.cursorId,id);assert.equal(result.limit,2);
 assert.throws(()=>parseSessionPage(undefined,undefined,'101'));
 assert.throws(()=>parseSessionPage(undefined,undefined,'1','%%%'));
});
test('pages enforce strict 31-day windows',()=>{
 assert.throws(()=>parseSessionPage('2027-01-01T00:00:00Z','2027-03-01T00:00:00Z'));
 assert.throws(()=>parseSessionPage('2027-01-01T00:00:00Z','2027-01-01T00:00:00Z'));
});
