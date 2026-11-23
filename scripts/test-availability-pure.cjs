'use strict';
// Real dependency-free execution of the SAME TypeScript source shipped with the API.
// This is not a NestJS, migration or PostgreSQL test.
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const cp=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bookcore-availability-'));
try{
 const source=path.resolve('apps/api/src/modules/catalog/availability.ts');
 const tsc=cp.spawnSync('tsc',[source,'--strict','--target','ES2022','--module','commonjs',
  '--skipLibCheck','--outDir',dir,'--pretty','false'],{encoding:'utf8',timeout:15000});
 if(tsc.status!==0){process.stderr.write(tsc.stdout+tsc.stderr);process.exit(1);}
 const {evaluateAvailability:ev,validateSchedulingInstant:valid,localBoundaryToInstant:resolve}=require(path.join(dir,'availability.js'));
 let count=0;const test=(name,run)=>{run();console.log('PASS',name);count++;};
 const rule={branchId:'b',resourceId:null,isoWeekday:1,startLocal:'09:00',endLocal:'18:00',endDayOffset:0,active:true};
 const base={timezone:'Asia/Tehran',startAt:'2026-11-23T06:30:00Z',endAt:'2026-11-23T07:30:00Z',branchId:'b',organizationActive:true,hours:[rule],exceptions:[]};
 test('business hours permit interval',()=>assert.equal(ev(base).code,'AVAILABLE'));
 test('not a capacity guarantee',()=>assert.equal(ev(base).capacityChecked,false));
 test('outside denied',()=>assert.equal(ev({...base,startAt:'2026-11-23T04:30:00Z'}).code,'OUTSIDE_BUSINESS_HOURS'));
 test('resource needs its own hours',()=>assert.equal(ev({...base,resourceId:'r'}).code,'RESOURCE_UNAVAILABLE'));
 test('resource hours and 120min buffer',()=>{const r={...rule,branchId:null,resourceId:'r'};
  assert.equal(ev({...base,resourceId:'r',hours:[rule,r]}).code,'AVAILABLE');
  assert.equal(ev({...base,resourceId:'r',hours:[rule,r],bufferBeforeMin:120}).code,'RESOURCE_UNAVAILABLE');});
 test('closed wins over override',()=>assert.equal(ev({...base,hours:[],exceptions:[
   {branchId:'b',resourceId:null,kind:'OPEN_OVERRIDE',startAt:'2026-11-23T06:00:00Z',endAt:'2026-11-23T08:00:00Z',active:true},
   {branchId:'b',resourceId:null,kind:'CLOSED',startAt:'2026-11-23T07:00:00Z',endAt:'2026-11-23T08:00:00Z',active:true}
 ]}).code,'BRANCH_CLOSED'));
 test('overnight Sunday Monday',()=>assert.equal(ev({...base,startAt:'2026-11-29T19:00:00Z',endAt:'2026-11-29T20:00:00Z',
  hours:[{...rule,isoWeekday:7,startLocal:'22:00',endLocal:'02:00',endDayOffset:1}]}).code,'AVAILABLE'));
 test('Tehran offset valid',()=>assert.equal(valid('2026-11-23T10:00:00+03:30','Asia/Tehran'),'2026-11-23T06:30:00.000Z'));
 test('Tehran mismatched offset rejected',()=>assert.throws(()=>valid('2026-11-23T10:00:00Z','Asia/Tehran')));
 test('Berlin DST gap rejected',()=>assert.equal(resolve({year:2027,month:3,day:28},'02:30','Europe/Berlin'),null));
 test('Berlin DST fold ambiguous rejected',()=>assert.equal(resolve({year:2027,month:10,day:31},'02:30','Europe/Berlin'),null));
 test('Berlin fold explicit offsets differ',()=>assert.notEqual(valid('2027-10-31T02:30:00+01:00','Europe/Berlin'),valid('2027-10-31T02:30:00+02:00','Europe/Berlin')));
 test('invalid duration rejected',()=>assert.equal(ev({...base,startAt:base.endAt}).code,'INVALID_TIME_INTERVAL'));
 console.log(JSON.stringify({executed:count,passed:count,failed:0,scope:'pure TS source only'}));
} finally {fs.rmSync(dir,{recursive:true,force:true});}
