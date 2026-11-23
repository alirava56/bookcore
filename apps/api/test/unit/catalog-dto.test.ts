import test from 'node:test';
import assert from 'node:assert/strict';
import {plainToInstance} from 'class-transformer';
import {validateSync} from 'class-validator';
import {CreateBranchDto,CreateResourceDto,CreateBusinessHourDto,CreateScheduleExceptionDto} from '../../src/modules/catalog/catalog.dto';
test('Phase05 optional ids do not silently allow explicit null (contract forbids null)',()=>{
 const room=plainToInstance(CreateResourceDto,{type:'ROOM',displayName:'Room One',branchId:null});
 assert.ok(validateSync(room).length>0);
 const trainer=plainToInstance(CreateResourceDto,{type:'TRAINER',displayName:'Coach One',trainerUserId:'6d3cad00-2510-47de-8b74-bdf06c90b741',branchId:null});
 assert.ok(validateSync(trainer).length>0);
 const hours=plainToInstance(CreateBusinessHourDto,{resourceId:null,isoWeekday:1,startLocal:'09:00',endLocal:'17:00',endDayOffset:0});
 assert.ok(validateSync(hours).length>0);
 const exception=plainToInstance(CreateScheduleExceptionDto,{branchId:null,kind:'CLOSED',startAt:'2026-11-23T09:00:00+03:30',
 endAt:'2026-11-23T10:00:00+03:30',reason:'Holiday'});
 assert.ok(validateSync(exception).length>0);
});
test('Phase05 branch address null is rejected instead of causing server error',()=>{
 assert.ok(validateSync(plainToInstance(CreateBranchDto,{name:'Central',address:null})).length>0);
});
