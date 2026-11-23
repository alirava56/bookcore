/** Pure policy functions shared by service and independent unit tests; DB state still authoritative. */
export type StaffRole='OWNER'|'MANAGER'|'RECEPTIONIST'|'TRAINER';
export function mayInvite(actorRole:StaffRole,targetRole:StaffRole):boolean {
 return actorRole==='OWNER' || (actorRole==='MANAGER'&&['TRAINER','RECEPTIONIST'].includes(targetRole));
}
export function mayActOnBehalf(role:StaffRole|null):boolean {
 return role!==null&&['OWNER','MANAGER','RECEPTIONIST'].includes(role);
}
export function consentIsCurrent(expiresAtMs:number,revokedAtMs:number|null,nowMs:number):boolean {
 return Number.isFinite(expiresAtMs)&&Number.isFinite(nowMs)&&
  revokedAtMs===null&&expiresAtMs>nowMs;
}
export function invitationCanResolve(status:string,expiresAtMs:number,nowMs:number):boolean {
 return status==='PENDING'&&Number.isFinite(expiresAtMs)&&expiresAtMs>nowMs;
}
export type RefreshRecovery='REAUTHENTICATE'|'ACCEPT_ROTATED_RESULT';
/** No sender-bound proof in v1: never replay a possibly consumed bearer token after an unknown commit. */
export function refreshRecovery(confirmedCommit:boolean):RefreshRecovery {
 return confirmedCommit?'ACCEPT_ROTATED_RESULT':'REAUTHENTICATE';
}

/** Never translate an unrelated PostgreSQL UNIQUE constraint to a pending invitation. */
export function invitationUniqueError(err:unknown):string|null {
 if (!err || typeof err!=='object' || !('code' in err) || err.code!=='23505') return null;
 return 'constraint' in err && err.constraint==='staff_invite_one_pending'
  ? 'INVITATION_ALREADY_PENDING' : 'DATABASE_UNIQUE_CONFLICT';
}
