import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAvailability,localBoundaryToInstant,validateSchedulingInstant,type AvailabilityRequest} from '../../src/modules/catalog/availability';
const monday={branchId:'b',resourceId:null,isoWeekday:1,startLocal:'09:00',endLocal:'18:00',endDayOffset:0 as const,active:true};
const base:AvailabilityRequest={timezone:'Asia/Tehran',startAt:'2026-11-23T06:30:00Z',endAt:'2026-11-23T07:30:00Z',
 branchId:'b',organizationActive:true,hours:[monday],exceptions:[]};
test('Monday business hours permit a covered half-open interval but not outside hours',()=>{
 assert.equal(evaluateAvailability(base).code,'AVAILABLE');
 assert.equal(evaluateAvailability({...base,startAt:'2026-11-23T04:30:00Z'}).code,'OUTSIDE_BUSINESS_HOURS');
 assert.equal(evaluateAvailability({...base,startAt:base.endAt}).code,'INVALID_TIME_INTERVAL');
 assert.equal(evaluateAvailability(base).capacityChecked,false);
});
test('Closed restrictions override an OPEN_OVERRIDE at a different scope',()=>{
 const req:AvailabilityRequest={...base,hours:[],exceptions:[
  {branchId:'b',resourceId:null,kind:'OPEN_OVERRIDE',startAt:'2026-11-23T06:00:00Z',endAt:'2026-11-23T08:00:00Z',active:true},
  {branchId:'b',resourceId:null,kind:'CLOSED',startAt:'2026-11-23T07:00:00Z',endAt:'2026-11-23T08:00:00Z',active:true}]};
 assert.equal(evaluateAvailability(req).code,'BRANCH_CLOSED');
});
test('resource requires its own hours and checks buffers, no accidental availability',()=>{
 const r={...monday,branchId:null,resourceId:'r'};
 assert.equal(evaluateAvailability({...base,resourceId:'r',resourceActive:true}).code,'RESOURCE_UNAVAILABLE');
 assert.equal(evaluateAvailability({...base,resourceId:'r',resourceActive:true,hours:[monday,r]}).code,'AVAILABLE');
 assert.equal(evaluateAvailability({...base,resourceId:'r',resourceActive:true,hours:[monday,r],
   bufferBeforeMin:120}).code,'RESOURCE_UNAVAILABLE');
});
test('overnight rules correctly cross midnight, including Sunday to Monday',()=>{
 const friday={...monday,isoWeekday:5,startLocal:'22:00',endLocal:'02:00',endDayOffset:1 as const};
 const req={...base,startAt:'2026-11-27T19:00:00Z',endAt:'2026-11-27T20:00:00Z',hours:[friday]};
 assert.equal(evaluateAvailability(req).code,'AVAILABLE');
 const sunday={...friday,isoWeekday:7};
 assert.equal(evaluateAvailability({...req,startAt:'2026-11-29T19:00:00Z',endAt:'2026-11-29T20:00:00Z',hours:[sunday]}).code,'AVAILABLE');
});
test('strict scheduling offset in Tehran and Berlin, reject nonexistent DST time',()=>{
 assert.equal(validateSchedulingInstant('2026-11-23T10:00:00+03:30','Asia/Tehran'),'2026-11-23T06:30:00.000Z');
 assert.throws(()=>validateSchedulingInstant('2026-11-23T10:00:00Z','Asia/Tehran'));
 assert.throws(()=>validateSchedulingInstant('2027-03-28T02:30:00+01:00','Europe/Berlin'));
 assert.equal(localBoundaryToInstant({year:2027,month:3,day:28},'02:30','Europe/Berlin'),null);
 assert.equal(localBoundaryToInstant({year:2027,month:10,day:31},'02:30','Europe/Berlin'),null);
 assert.notEqual(validateSchedulingInstant('2027-10-31T02:30:00+02:00','Europe/Berlin'),
   validateSchedulingInstant('2027-10-31T02:30:00+01:00','Europe/Berlin'));
});
test('DST ambiguity at weekly boundary is fail closed',()=>{
 const sunday={...monday,isoWeekday:7,startLocal:'02:30',endLocal:'04:00',endDayOffset:0 as const};
 const r={...base,timezone:'Europe/Berlin',hours:[sunday],startAt:'2027-10-31T00:40:00Z',endAt:'2027-10-31T00:50:00Z'};
 assert.equal(evaluateAvailability(r).code,'INVALID_TIME_INTERVAL');
});
