import test from 'node:test';import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {sealInspectionCursor,openInspectionCursor,validateInspectionOptions,validateInspectionPage,
 INSPECTION_KINDS} from '../../src/modules/operations/inspection.domain';
const secret=randomBytes(32).toString('base64url');const tenant=randomUUID();
test('inspection signed cursor roundtrip preserves six digit timestamp',()=>{
 const c={v:1 as const,tenant,kind:'BOOKING' as const,after:randomUUID(),asOf:'2026-11-23T01:02:03.123456+00:00'};
 assert.deepEqual(openInspectionCursor(sealInspectionCursor(c,secret),secret,tenant,'BOOKING'),c);
});
test('cursor tampering, different tenant and different kind are rejected',()=>{
 const c={v:1 as const,tenant,kind:'BOOKING' as const,after:randomUUID(),asOf:'2026-11-23T01:02:03.123456+00:00'};
 const x=sealInspectionCursor(c,secret);
 assert.throws(()=>openInspectionCursor(x.slice(0,-2)+'xx',secret,tenant,'BOOKING'));
 assert.throws(()=>openInspectionCursor(x,secret,randomUUID(),'BOOKING'));
 assert.throws(()=>openInspectionCursor(x,secret,tenant,'SESSION'));
});
test('cursor key must have >= 256 bits entropy',()=>{
 const c={v:1 as const,tenant,kind:'BOOKING' as const,after:randomUUID(),asOf:'2026-11-23T01:02:03Z'};
 assert.throws(()=>sealInspectionCursor(c,'small-key'));
});
test('bounded inspection rejects oversized batch, pages, and total work',()=>{
 assert.throws(()=>validateInspectionOptions('SESSION',101,1,false));
 assert.throws(()=>validateInspectionOptions('SESSION',100,201,false));
 assert.throws(()=>validateInspectionOptions('SESSION',100,100,true));
 validateInspectionOptions('SESSION',100,20,true);
});
test('inspection response cannot claim completed scan with pending cursor',()=>{
 const id=randomUUID();
 assert.throws(()=>validateInspectionPage({tenantId:tenant,kind:'SESSION',asOf:'2026-11-23T01:02:03+00:00',
 inspected:1,findings:[],hasMore:true,nextAfter:null,kindCoverageComplete:true,
 consistentSnapshot:false,readOnly:true,repairPerformed:false},tenant,'SESSION',1));
 const page={tenantId:tenant,kind:'SESSION',asOf:'2026-11-23T01:02:03+00:00',
 inspected:1,findings:[],hasMore:true,nextAfter:id,kindCoverageComplete:false,
 consistentSnapshot:false,readOnly:true,repairPerformed:false};
 assert.equal(validateInspectionPage(page,tenant,'SESSION',1).nextAfter,id);
});
test('inspection kinds cover session booking outbox and governance',()=>{
 assert.deepEqual(INSPECTION_KINDS,['SESSION','BOOKING','OUTBOX','COUNTER','INVITATION','CONSENT']);
});
import {inspectBookingHistory,type HistoryEvent} from '../../src/modules/operations/inspection.domain';
const base=(eventOrder:number,id:string,fromStatus:HistoryEvent['fromStatus'],toStatus:HistoryEvent['toStatus'],reason:string|null=null):HistoryEvent=>
 ({eventOrder,id,fromStatus,toStatus,reason,at:'2026-11-23T02:03:04.123456Z'});
test('event-order beats equal wall clock timestamps and reverse UUID sort order',()=>{
 const events=[base(2,'00000000-0000-4000-8000-000000000001','CONFIRMED','CANCELLED','cancelled'),
  base(1,'ffffffff-ffff-4fff-8fff-ffffffffffff',null,'CONFIRMED')];
 assert.deepEqual(inspectBookingHistory('CANCELLED','cancelled',events),[]);
});
test('attendance and no-show are both valid terminal states',()=>{
 for(const terminal of ['ATTENDED','NO_SHOW'] as const){
  const events=[base(1,randomUUID(),null,'CONFIRMED'),base(2,randomUUID(),'CONFIRMED',terminal)];
  assert.deepEqual(inspectBookingHistory(terminal,null,events),[]);
 }
});
test('missing or duplicate initial event is detected',()=>{
 assert.ok(inspectBookingHistory('CONFIRMED',null,[]).includes('MISSING_INITIAL_EVENT'));
 assert.ok(inspectBookingHistory('CONFIRMED',null,[base(1,randomUUID(),null,'CONFIRMED'),
 base(2,randomUUID(),null,'CONFIRMED')]).includes('DUPLICATE_INITIAL_EVENT'));
});
test('terminal transition cannot be reversed or chained',()=>{
 const events=[base(1,randomUUID(),null,'CONFIRMED'),base(2,randomUUID(),'CONFIRMED','NO_SHOW'),
  base(3,randomUUID(),'NO_SHOW','ATTENDED')];
 assert.ok(inspectBookingHistory('ATTENDED',null,events).includes('INVALID_EVENT_TRANSITION'));
});
test('booking status must match last logical event not last UUID',()=>{
 const events=[base(2,'ffffffff-ffff-4fff-8fff-ffffffffffff','CONFIRMED','ATTENDED'),
  base(1,'00000000-0000-4000-8000-000000000001',null,'CONFIRMED')];
 assert.ok(inspectBookingHistory('NO_SHOW',null,events).includes('BOOKING_FINAL_STATE_MISMATCH'));
});

import {inspectionCompletion} from '../../src/modules/operations/inspection.domain';
test('Phase12 CLI: one-kind completed/partial, six-kind completed/partial and findings',()=>{
 assert.deepEqual(inspectionCompletion(false,0,0),{selectedScopeComplete:true,allSupportedKindsCovered:false,consistentSnapshot:false,certifiedIntegrity:false,exitCode:0});
 assert.equal(inspectionCompletion(false,1,0).exitCode,3);
 assert.equal(inspectionCompletion(true,0,0).allSupportedKindsCovered,true);
 assert.equal(inspectionCompletion(true,1,0).exitCode,3);
 assert.equal(inspectionCompletion(false,0,2).exitCode,2);
});
