import test from 'node:test';
import assert from 'node:assert/strict';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {CreateSessionDto} from '../../src/modules/scheduling/session.dto';
import {CreateBookingDto} from '../../src/modules/booking/booking.dto';
test('Phase07 inherited null optional room UUID is rejected, omitted is allowed',async()=>{
 const valid={branchId:'11111111-1111-4111-8111-111111111111',serviceId:'11111111-1111-4111-8111-111111111111',
 trainerResourceId:'11111111-1111-4111-8111-111111111111',startAt:'2027-01-01T10:00:00Z',endAt:'2027-01-01T11:00:00Z',capacityTotal:1};
 const noRoom=plainToInstance(CreateSessionDto,valid);
 const explicitNull=plainToInstance(CreateSessionDto,{...valid,roomResourceId:null});
 assert.equal((await validate(noRoom)).length,0);
 assert.ok((await validate(explicitNull)).length>0);
});
test('Phase07 customerId must be a UUID if supplied; explicit null not treated as omission',async()=>{
 assert.equal((await validate(plainToInstance(CreateBookingDto,{}))).length,0);
 assert.ok((await validate(plainToInstance(CreateBookingDto,{customerId:null}))).length>0);
 assert.ok((await validate(plainToInstance(CreateBookingDto,{customerId:'not-a-uuid'}))).length>0);
});
