import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationPipe } from '@nestjs/common';
import { IsString,MaxLength } from 'class-validator';

class ProbeDto {
 @IsString() @MaxLength(8) name!:string;
}
const pipe=new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:false,forbidUnknownValues:true});
test('DTO validation rejects unknown properties',async()=>{
 await assert.rejects(pipe.transform({name:'valid',unexpected:'x'}, {type:'body',metatype:ProbeDto}),/Bad Request/);
});
test('DTO validation rejects invalid and oversized values',async()=>{
 await assert.rejects(pipe.transform({name:123}, {type:'body',metatype:ProbeDto}),/Bad Request/);
 await assert.rejects(pipe.transform({name:'too-long-a-name'}, {type:'body',metatype:ProbeDto}),/Bad Request/);
});
