import {requireValue} from '../../src/common/require-value';
import test from 'node:test';import assert from 'node:assert/strict';
import {classifyCapacity,validateScope,validateMaintenance,requireReason,IDEMPOTENCY_PURGE_ALLOWED}
 from '../../src/modules/operations/operations.domain';
import {invitationUniqueError,invitationCanResolve,consentIsCurrent}
 from '../../src/modules/governance/governance.domain';
const UUID='12345678-1234-4234-8234-123456789abc';
test('inspection requires tenant UUID and bounded page',()=>{
 assert.doesNotThrow(()=>validateScope(UUID,100));
 for(const limit of [0,101,NaN,1.2])assert.throws(()=>validateScope(UUID,limit));
 assert.throws(()=>validateScope('not-a-tenant',10));
});
test('counter drift classified as manual repair only',()=>{
 const x=classifyCapacity(UUID,3,4,2);
 assert.equal(x.length,1);assert.equal(x[0]?.code,'COUNTER_DRIFT');
 assert.equal(x[0]?.repair,'MANUAL_ONLY');
 assert.equal(classifyCapacity(UUID,2,4,2).length,0);
});
test('out-of-bound count is separately detected',()=>{
 const x=classifyCapacity(UUID,9,4,8);
 assert.deepEqual(x.map(y=>y.code),['CAPACITY_BOUNDS','COUNTER_DRIFT']);
});
test('minimum retention and bounded maintenance are required',()=>{
 assert.doesNotThrow(()=>validateMaintenance(100,48));
 for(const tuple of [[0,48],[101,48],[2,47],[2,9000],[2.2,48]])
  assert.throws(()=>validateMaintenance(requireValue(tuple[0]),requireValue(tuple[1])));
});
test('idempotency history deletion is disabled',()=>{
 assert.equal(IDEMPOTENCY_PURGE_ALLOWED,false);
});
test('maintenance reason is trimmed and validated',()=>{
 assert.equal(requireReason('   valid operational reason  '),'valid operational reason');
 assert.throws(()=>requireReason('short'));assert.throws(()=>requireReason(undefined));
});
test('only invitation pending uniqueness is translated to business conflict',()=>{
 assert.equal(invitationUniqueError({code:'23505',constraint:'staff_invite_one_pending'}),'INVITATION_ALREADY_PENDING');
 assert.equal(invitationUniqueError({code:'23505',constraint:'staff_invitations_token_hash_key'}),'DATABASE_UNIQUE_CONFLICT');
 assert.equal(invitationUniqueError({code:'23505'}),'DATABASE_UNIQUE_CONFLICT');
 assert.equal(invitationUniqueError({code:'23503'}),null);
});
test('consent/invitation expiry is fail closed on exact boundary',()=>{
 assert.equal(invitationCanResolve('PENDING',100,100),false);
 assert.equal(consentIsCurrent(100,null,100),false);
 assert.equal(consentIsCurrent(101,60,100),false);
});
