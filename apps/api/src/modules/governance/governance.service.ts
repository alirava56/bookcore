import {requireValue} from '../../common/require-value';
import {mayInvite,invitationUniqueError} from './governance.domain';
import {Injectable} from '@nestjs/common';
import {randomBytes,createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {DatabaseService} from '../../infrastructure/database/database.service';
import {UnitOfWork} from '../../infrastructure/transactions/unit-of-work';
import {TenantAuthorizationService} from '../organizations/authorization.service';
import {ProblemException} from '../../common/errors/problem';
import type {AuthenticatedPrincipal,MembershipRole} from '../../common/security/authorization';
import type {CreateStaffInvitationDto,GrantConsentDto} from './governance.dto';

const tokenHash=(t:string)=>createHash('sha256').update(t).digest('hex');
const rawToken=()=>randomBytes(32).toString('base64url');
type Invitation={id:string;tenant_id:string;invitee_id:string;invited_by:string;role:MembershipRole;
 status:'PENDING'|'ACCEPTED'|'REVOKED'|'DECLINED';expires_at:Date;expired?:boolean};
type Consent={id:string;tenant_id:string;customer_id:string;expires_at:Date;revoked_at:Date|null};
const invitationView=(x:Invitation)=>({id:x.id,tenantId:x.tenant_id,inviteeId:x.invitee_id,
 role:x.role,status:x.status,expiresAt:new Date(x.expires_at).toISOString()});
const consentView=(x:Consent)=>({id:x.id,tenantId:x.tenant_id,customerId:x.customer_id,
 expiresAt:new Date(x.expires_at).toISOString(),revokedAt:x.revoked_at?new Date(x.revoked_at).toISOString():null});
@Injectable()
export class GovernanceService {
 constructor(private readonly db:DatabaseService,private readonly uow:UnitOfWork,
  private readonly auth:TenantAuthorizationService){}
 private async lockOrganization(c:PoolClient,tenantId:string){
  const r=await c.query<{ok:boolean}>('SELECT public.lock_bookcore_organization($1) AS ok',[tenantId]);
  if(!r.rows[0]?.ok)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
 }
 private async audit(c:PoolClient,tenantId:string,actor:string,action:string,aggregate:string,id:string,payload:object){
  await c.query(`INSERT INTO audit_events(tenant_id,actor_id,action,aggregate_type,aggregate_id,metadata)
   VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[tenantId,actor,action,aggregate,id,JSON.stringify(payload)]);
  await c.query(`INSERT INTO outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload)
   VALUES($1,$2,$3,$4,$5::jsonb)`,[tenantId,aggregate,id,action,JSON.stringify(payload)]);
 }
 async invite(p:AuthenticatedPrincipal,tenantId:string,dto:CreateStaffInvitationDto){
  const token=rawToken();
  try {return await this.uow.run(async c=>{
   await this.lockOrganization(c,tenantId);
   const role=await this.auth.forWrite(c,p,tenantId);
   if(!mayInvite(role,dto.role))
    throw new ProblemException(403,'ROLE_ESCALATION_DENIED');
   const user=await c.query<{active:boolean}>('SELECT public.bookcore_share_active_user($1) AS active',[dto.userId]);
   if(!user.rows[0]?.active)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   const member=await c.query(`SELECT status FROM memberships WHERE tenant_id=$1 AND user_id=$2`,[tenantId,dto.userId]);
   if(member.rows[0]?.status==='ACTIVE')throw new ProblemException(409,'MEMBERSHIP_ALREADY_EXISTS');
   // Close expired invitations and invitations issued before the latest revocation.
   await c.query(`UPDATE staff_invitations SET status='REVOKED',acted_at=clock_timestamp()
    WHERE tenant_id=$1 AND invitee_id=$2 AND status='PENDING' AND (expires_at<=clock_timestamp()
      OR EXISTS (SELECT 1 FROM memberships m WHERE m.tenant_id=$1 AND m.user_id=$2
        AND m.status='REVOKED' AND m.revoked_at>=staff_invitations.created_at))`,[tenantId,dto.userId]);
   const r=await c.query<Invitation>(`INSERT INTO staff_invitations
     (tenant_id,invitee_id,invited_by,role,token_hash,expires_at)
     VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '72 hours') RETURNING *`,
    [tenantId,dto.userId,p.userId,dto.role,tokenHash(token)]);
   const invitation=requireValue(r.rows[0]);
   await this.audit(c,tenantId,p.userId,'StaffInvitationCreated','STAFF_INVITATION',invitation.id,
    {inviteeId:dto.userId,role:dto.role});
   return {...invitationView(invitation),token};
  },1);}catch(err){const code=invitationUniqueError(err);if(code)throw new ProblemException(409,code);throw err;}
 }
 private async apply(p:AuthenticatedPrincipal,token:string,action:'ACCEPTED'|'DECLINED'){
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new ProblemException(400,'INVALID_INVITATION_TOKEN');
  const hash=tokenHash(token),c=await this.db.connect();let tenantId:string;
  try {const r=await c.query<{tenant_id:string}>(`SELECT tenant_id FROM staff_invitations WHERE token_hash=$1`,[hash]);
   if(!r.rows[0])throw new ProblemException(404,'INVITATION_NOT_FOUND');tenantId=r.rows[0].tenant_id;
  }finally{c.release();}
  return this.uow.run(async tx=>{
   await this.lockOrganization(tx,tenantId);
   await this.auth.liveSession(tx,p);
   const r=await tx.query<Invitation>(`SELECT *,expires_at<=clock_timestamp() AS expired FROM staff_invitations WHERE tenant_id=$1 AND token_hash=$2 FOR UPDATE`,[tenantId,hash]);
   const invitation=r.rows[0];
   if(!invitation||invitation.invitee_id!==p.userId)throw new ProblemException(404,'INVITATION_NOT_FOUND');
   if(invitation.status!=='PENDING')throw new ProblemException(409,'INVITATION_ALREADY_RESOLVED');
   if(invitation.expired)throw new ProblemException(409,'INVITATION_EXPIRED');
   const inviter=await tx.query<{role:MembershipRole}>(`SELECT m.role FROM memberships m JOIN users u ON u.id=m.user_id
     WHERE m.tenant_id=$1 AND m.user_id=$2 AND m.status='ACTIVE' AND u.status='ACTIVE'`,
     [tenantId,invitation.invited_by]);
   if(!inviter.rows[0]||!mayInvite(inviter.rows[0].role,invitation.role))
     throw new ProblemException(409,'INVITER_AUTHORITY_REVOKED');
   if(action==='ACCEPTED'){
    const existing=await tx.query<{status:string;stale_invitation:boolean;stale_session:boolean}>(`
     SELECT m.status, coalesce(i.created_at<=m.revoked_at,true) AS stale_invitation,
       coalesce(s.created_at<=m.revoked_at,true) AS stale_session
     FROM memberships m JOIN staff_invitations i ON i.tenant_id=m.tenant_id AND i.id=$3
     JOIN auth_sessions s ON s.user_id=m.user_id AND s.id=$4
     WHERE m.tenant_id=$1 AND m.user_id=$2 FOR UPDATE OF m`,[tenantId,p.userId,invitation.id,p.sessionId]);
    if(existing.rows[0]?.status==='ACTIVE')throw new ProblemException(409,'MEMBERSHIP_ALREADY_EXISTS');
    if(existing.rows[0]){
     if(existing.rows[0].stale_invitation)throw new ProblemException(409,'INVITATION_STALE');
     if(existing.rows[0].stale_session)throw new ProblemException(401,'FRESH_SESSION_REQUIRED');
     await tx.query(`UPDATE auth_sessions s SET revoked_at=clock_timestamp()
      FROM memberships m WHERE m.tenant_id=$1 AND m.user_id=$2 AND s.user_id=m.user_id
       AND s.revoked_at IS NULL AND s.created_at<=m.revoked_at`,[tenantId,p.userId]);
     await tx.query(`UPDATE memberships SET role=$3,status='ACTIVE',revoked_at=NULL
      WHERE tenant_id=$1 AND user_id=$2`,[tenantId,p.userId,invitation.role]);
    }else await tx.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,$3)`,
      [tenantId,p.userId,invitation.role]);
   }
   await tx.query(`UPDATE staff_invitations SET status=$3,acted_at=clock_timestamp()
    WHERE tenant_id=$1 AND id=$2`,[tenantId,invitation.id,action]);
   await this.audit(tx,tenantId,p.userId,
     action==='ACCEPTED'?'StaffInvitationAccepted':'StaffInvitationDeclined',
     'STAFF_INVITATION',invitation.id,{inviteeId:p.userId,...(action==='ACCEPTED'?{role:invitation.role}:{})});
   return {...invitationView(invitation),status:action};
  },1);
 }
 accept(p:AuthenticatedPrincipal,token:string){return this.apply(p,token,'ACCEPTED');}
 decline(p:AuthenticatedPrincipal,token:string){return this.apply(p,token,'DECLINED');}
 async revokeInvitation(p:AuthenticatedPrincipal,tenantId:string,invitationId:string,reason:string){
  if(reason.trim().length<10)throw new ProblemException(422,'INVITATION_REASON_REQUIRED');
  return this.uow.run(async c=>{
   await this.lockOrganization(c,tenantId);const role=await this.auth.forWrite(c,p,tenantId);
   const r=await c.query<Invitation>(`SELECT * FROM staff_invitations WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[tenantId,invitationId]);
   const v=r.rows[0];if(!v)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   if(!mayInvite(role,v.role))throw new ProblemException(403,'ROLE_ESCALATION_DENIED');
   if(v.status!=='PENDING')throw new ProblemException(409,'INVITATION_ALREADY_RESOLVED');
   await c.query(`UPDATE staff_invitations SET status='REVOKED',acted_at=clock_timestamp()
    WHERE tenant_id=$1 AND id=$2`,[tenantId,invitationId]);
   await this.audit(c,tenantId,p.userId,'StaffInvitationRevoked','STAFF_INVITATION',v.id,{inviteeId:v.invitee_id});
   await c.query(`INSERT INTO audit_events(tenant_id,actor_id,action,aggregate_type,aggregate_id,reason)
    VALUES($1,$2,'INVITATION_REVOCATION_REASON','STAFF_INVITATION',$3,$4)`,[tenantId,p.userId,v.id,reason.trim()]);
   return {...invitationView(v),status:'REVOKED'};
  },1);
 }
 async listInvitations(p:AuthenticatedPrincipal,tenantId:string){
  await this.auth.forRead(p,tenantId,true);
  const c=await this.db.connect();try{
   const r=await c.query<Invitation>(`SELECT v.* FROM staff_invitations v WHERE v.tenant_id=$1
     AND EXISTS(SELECT 1 FROM memberships m JOIN organizations o ON o.id=m.tenant_id
      WHERE m.tenant_id=v.tenant_id AND m.user_id=$2 AND m.status='ACTIVE'
       AND m.role IN('OWNER','MANAGER') AND o.status='ACTIVE')
     ORDER BY v.created_at DESC,v.id DESC LIMIT 100`,[tenantId,p.userId]);
   return {items:r.rows.map(invitationView)};
  }finally{c.release();}
 }
 async grantConsent(p:AuthenticatedPrincipal,tenantId:string,dto:GrantConsentDto){
  return this.uow.run(async c=>{
   await this.lockOrganization(c,tenantId);await this.auth.liveSession(c,p);
   await c.query(`UPDATE booking_consents SET revoked_at=clock_timestamp()
    WHERE tenant_id=$1 AND customer_id=$2 AND revoked_at IS NULL AND expires_at<=clock_timestamp()`,[tenantId,p.userId]);
   const existing=await c.query(`SELECT 1 FROM booking_consents WHERE tenant_id=$1 AND customer_id=$2
    AND revoked_at IS NULL`,[tenantId,p.userId]);
   if(existing.rows.length)throw new ProblemException(409,'CONSENT_ALREADY_ACTIVE');
   const r=await c.query<Consent>(`INSERT INTO booking_consents(tenant_id,customer_id,expires_at)
    VALUES($1,$2,clock_timestamp()+($3::int * interval '1 day')) RETURNING *`,
    [tenantId,p.userId,dto.durationDays]);
   await this.audit(c,tenantId,p.userId,'BookingConsentGranted','BOOKING_CONSENT',requireValue(r.rows[0]).id,{customerId:p.userId});
   return consentView(requireValue(r.rows[0]));
  },1);
 }
 async revokeConsent(p:AuthenticatedPrincipal,tenantId:string,consentId:string){
  return this.uow.run(async c=>{
   await this.lockOrganization(c,tenantId);await this.auth.liveSession(c,p);
   const r=await c.query<Consent>(`SELECT * FROM booking_consents
    WHERE tenant_id=$1 AND id=$2 AND customer_id=$3 FOR UPDATE`,[tenantId,consentId,p.userId]);
   if(!r.rows[0])throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   if(r.rows[0].revoked_at)throw new ProblemException(409,'CONSENT_ALREADY_REVOKED');
   const updated=await c.query<Consent>(`UPDATE booking_consents SET revoked_at=clock_timestamp()
    WHERE tenant_id=$1 AND id=$2 RETURNING *`,[tenantId,consentId]);
   await this.audit(c,tenantId,p.userId,'BookingConsentRevoked','BOOKING_CONSENT',consentId,{customerId:p.userId});
   return consentView(requireValue(updated.rows[0]));
  },1);
 }
 async myConsents(p:AuthenticatedPrincipal,tenantId:string){
  const c=await this.db.connect();try{
   const r=await c.query<Consent>(`SELECT v.* FROM booking_consents v JOIN organizations o ON o.id=v.tenant_id
    WHERE v.tenant_id=$1 AND v.customer_id=$2 AND o.status='ACTIVE'
     AND EXISTS (SELECT 1 FROM auth_sessions s WHERE s.id=$3 AND s.user_id=$2
       AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp())
    ORDER BY v.created_at DESC,v.id DESC LIMIT 100`,[tenantId,p.userId,p.sessionId]);
   return {items:r.rows.map(consentView)};
  }finally{c.release();}
 }
}
