import test from 'node:test';import assert from 'node:assert/strict';
import {mayInvite,mayActOnBehalf,invitationCanResolve,consentIsCurrent,refreshRecovery} from '../../src/modules/governance/governance.domain';
test('OWNER may invite supported roles; MANAGER only junior roles',()=>{
 for(const role of ['OWNER','MANAGER','RECEPTIONIST','TRAINER'] as const)assert.equal(mayInvite('OWNER',role),true);
 assert.equal(mayInvite('MANAGER','OWNER'),false);assert.equal(mayInvite('MANAGER','MANAGER'),false);
 assert.equal(mayInvite('MANAGER','TRAINER'),true);assert.equal(mayInvite('MANAGER','RECEPTIONIST'),true);
});
test('RECEPTIONIST, TRAINER and global customer cannot add staff',()=>{
 assert.equal(mayInvite('RECEPTIONIST','TRAINER'),false);assert.equal(mayInvite('TRAINER','TRAINER'),false);
});
test('on-behalf booking policy excludes TRAINER and customer',()=>{
 for(const role of ['OWNER','MANAGER','RECEPTIONIST'] as const)assert.equal(mayActOnBehalf(role),true);
 assert.equal(mayActOnBehalf('TRAINER'),false);assert.equal(mayActOnBehalf(null),false);
});
test('consent expires at exact deadline; revocation always wins',()=>{
 assert.equal(consentIsCurrent(101,null,100),true);assert.equal(consentIsCurrent(100,null,100),false);
 assert.equal(consentIsCurrent(101,50,100),false);
});
test('invitation cannot be accepted after decline, revoke, acceptance or expiry',()=>{
 assert.equal(invitationCanResolve('PENDING',101,100),true);
 for(const status of ['ACCEPTED','DECLINED','REVOKED'])assert.equal(invitationCanResolve(status,101,100),false);
 assert.equal(invitationCanResolve('PENDING',100,100),false);
});
test('unknown refresh COMMIT requires authentication, never bearer-token replay',()=>{
 assert.equal(refreshRecovery(false),'REAUTHENTICATE');assert.equal(refreshRecovery(true),'ACCEPT_ROTATED_RESULT');
});
