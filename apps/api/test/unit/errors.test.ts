import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { exceptionCode,exceptionStatus,safeProblem,ProblemException } from '../../src/common/errors/problem';
test('unexpected errors map to generic HTTP 500 with no SQL or secret',()=>{
 const err=new Error('DATABASE_URL=postgres://root:password@host/db');
 const p=safeProblem(exceptionStatus(err),exceptionCode(err,500),'/api/v1/health/ready','some-id');
 assert.equal(p.status,500);assert.equal(p.code,'INTERNAL_ERROR');
 assert.equal(JSON.stringify(p).includes('password'),false);
 assert.equal(p.type,'about:blank');
});
test('validation exception never exposes provided request body',()=>{
 const err=new BadRequestException('confidential request value');
 const p=safeProblem(exceptionStatus(err),exceptionCode(err,400),'/api/v1/health/live');
 assert.equal(p.detail,'Bad Request');assert.ok(!JSON.stringify(p).includes('confidential'));
});
test('ProblemException preserves stable domain error code',()=>{
 const ex=new ProblemException(503,'DEPENDENCY_UNAVAILABLE');
 assert.equal(exceptionCode(ex,exceptionStatus(ex)),'DEPENDENCY_UNAVAILABLE');
});
