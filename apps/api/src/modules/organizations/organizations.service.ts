import {requireValue} from '../../common/require-value';
import {Injectable} from '@nestjs/common';
import {DatabaseService} from '../../infrastructure/database/database.service';
import {UnitOfWork} from '../../infrastructure/transactions/unit-of-work';
import {ProblemException} from '../../common/errors/problem';
import type {AuthenticatedPrincipal} from '../../common/security/authorization';
import {TenantAuthorizationService} from './authorization.service';
import {type OrganizationResponse,type MembershipResponse,StaffRole,MembershipStatus,
 type CreateOrganizationDto,type CreateMembershipDto,type PatchMembershipDto} from './organization.dto';

interface OrgRow {id:string;name:string;timezone:string;cancellation_cutoff_min:number;status:string}
interface MemRow {tenant_id:string;user_id:string;role:StaffRole;status:MembershipStatus}
const orgView=(o:OrgRow):OrganizationResponse=>({id:o.id,name:o.name,timezone:o.timezone,
 cancellationCutoffMin:o.cancellation_cutoff_min,status:o.status});
const memberView=(m:MemRow):MembershipResponse=>({tenantId:m.tenant_id,userId:m.user_id,role:m.role,status:m.status});
function validateTimezone(zone:string) {
 if(!/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+)$/.test(zone))throw new ProblemException(422,'INVALID_TIMEZONE');
 try {new Intl.DateTimeFormat('en-US',{timeZone:zone});} catch {throw new ProblemException(422,'INVALID_TIMEZONE');}
}
function validateName(name:string):string {
 const result=name.trim();if(result.length<2||result.length>160)throw new ProblemException(422,'INVALID_ORGANIZATION_NAME');return result;
}
@Injectable()
export class OrganizationsService {
 constructor(private readonly db:DatabaseService,private readonly uow:UnitOfWork,
 private readonly auth:TenantAuthorizationService){}
 async create(p:AuthenticatedPrincipal,dto:CreateOrganizationDto):Promise<OrganizationResponse> {
  validateTimezone(dto.timezone);const name=validateName(dto.name);
  return this.uow.run(async c=>{
    await this.auth.liveSession(c,p);
    const newOrg=await c.query<OrgRow>(`INSERT INTO organizations(name,timezone,cancellation_cutoff_min)
       VALUES ($1,$2,$3) RETURNING id,name,timezone,cancellation_cutoff_min,status`,
       [name,dto.timezone,dto.cancellationCutoffMin??120]);
    const org=requireValue(newOrg.rows[0]);
    await c.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES ($1,$2,'OWNER')`,[org.id,p.userId]);
    await c.query(`INSERT INTO audit_events(tenant_id,actor_id,action,aggregate_type,aggregate_id,metadata)
     VALUES($1,$2,'ORGANIZATION_CREATED','ORGANIZATION',$1,'{}'::jsonb)`,[org.id,p.userId]);
    await c.query(`INSERT INTO outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload)
      VALUES($1,'ORGANIZATION',$1,'OrganizationCreated','{}'::jsonb)`,[org.id]);
    return orgView(org);
  },1);
 }
 async get(p:AuthenticatedPrincipal,orgId:string):Promise<OrganizationResponse> {
  const c=await this.db.connect();
  // Authorization and tenant data are read in ONE statement/snapshot; avoids stale prechecks.
  try {const r=await c.query<OrgRow>(`SELECT o.id,o.name,o.timezone,o.cancellation_cutoff_min,o.status
      FROM organizations o JOIN memberships m ON m.tenant_id=o.id AND m.user_id=$2
      AND m.status='ACTIVE'
      WHERE o.id=$1 AND o.status='ACTIVE'`,[orgId,p.userId]);
   if(!r.rows[0])throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   return orgView(r.rows[0]);}finally{c.release();}
 }
 async list(p:AuthenticatedPrincipal,orgId:string,cursor:string|null,limit:number) {
  await this.auth.forRead(p,orgId,true);
  const c=await this.db.connect();
  try {const r=await c.query<MemRow>(`SELECT m.tenant_id,m.user_id,m.role,m.status FROM memberships m
     WHERE m.tenant_id=$1 AND ($2::uuid IS NULL OR m.user_id>$2::uuid)
     AND EXISTS(SELECT 1 FROM memberships actor JOIN organizations o ON o.id=actor.tenant_id
         WHERE actor.tenant_id=m.tenant_id AND actor.user_id=$4 AND actor.status='ACTIVE'
           AND actor.role IN ('OWNER','MANAGER') AND o.status='ACTIVE')
     ORDER BY m.user_id LIMIT $3`,[orgId,cursor,limit+1,p.userId]);
   const items=r.rows.slice(0,limit).map(memberView);
   const hasMore=r.rows.length>limit;
   return {items,page:{nextCursor:hasMore?items.at(-1)?.userId??null:null,hasMore}};
  }finally{c.release();}
 }
 async add(p:AuthenticatedPrincipal,orgId:string,dto:CreateMembershipDto):Promise<MembershipResponse> {
  // Preserve tenant-scoped denial policy, but never turn a UUID into an active affiliation.
  return this.uow.run(async c=>{
   const r=await c.query<{ok:boolean}>('SELECT public.lock_bookcore_organization($1) AS ok',[orgId]);
   if(!r.rows[0]?.ok)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   const role=await this.auth.forWrite(c,p,orgId);
   if(role==='MANAGER'&&!['RECEPTIONIST','TRAINER'].includes(dto.role))
    throw new ProblemException(403,'ROLE_ESCALATION_DENIED');
   throw new ProblemException(409,'STAFF_INVITATION_REQUIRED');
  },1);
 }
 async patch(p:AuthenticatedPrincipal,orgId:string,userId:string,dto:PatchMembershipDto):Promise<MembershipResponse> {
  if(dto.role===undefined&&dto.status===undefined)throw new ProblemException(400,'EMPTY_MEMBERSHIP_PATCH');
  return this.uow.run(async c=>{
    const locked=await c.query<{ok:boolean}>(`SELECT public.lock_bookcore_organization($1) AS ok`,[orgId]);
    if(!locked.rows[0]?.ok)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
    const actor=await this.auth.forWrite(c,p,orgId);
    const old=await c.query<MemRow>(`SELECT tenant_id,user_id,role,status FROM memberships
      WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE`,[orgId,userId]);
    const target=old.rows[0];if(!target)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
    const role=dto.role??target.role,status=dto.status??target.status;
    if(actor==='MANAGER') {
      if(p.userId===userId || !['TRAINER','RECEPTIONIST'].includes(target.role) ||
        !['TRAINER','RECEPTIONIST'].includes(role))throw new ProblemException(403,'ROLE_ESCALATION_DENIED');
    }
    if(target.status==='REVOKED'&&status==='ACTIVE')throw new ProblemException(409,'STAFF_INVITATION_REQUIRED');
    if(role===target.role&&status===target.status)return memberView(target);
    // Target locked, organization lock makes the last-owner check race-free.
    if(target.role==='OWNER'&&target.status==='ACTIVE'&&
       (role!=='OWNER'||status!=='ACTIVE')) {
      const count=await c.query<{count:string}>(`SELECT count(*)::text AS count FROM memberships
       WHERE tenant_id=$1 AND role='OWNER' AND status='ACTIVE'`,[orgId]);
      if(Number(count.rows[0]?.count)<=1)throw new ProblemException(409,'LAST_OWNER');
    }
    const changed=await c.query<MemRow>(`UPDATE memberships SET role=$3,status=$4,
      revoked_at=CASE WHEN $4='REVOKED' THEN coalesce(revoked_at,clock_timestamp()) ELSE NULL END
      WHERE tenant_id=$1 AND user_id=$2 RETURNING tenant_id,user_id,role,status`,[orgId,userId,role,status]);
    await c.query(`INSERT INTO audit_events(tenant_id,actor_id,action,aggregate_type,aggregate_id,metadata)
      VALUES($1,$2,'MEMBERSHIP_CHANGED','MEMBERSHIP',$3,$4::jsonb)`,
      [orgId,p.userId,userId,JSON.stringify({oldRole:target.role,newRole:role,oldStatus:target.status,newStatus:status})]);
    await c.query(`INSERT INTO outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload)
      VALUES($1,'MEMBERSHIP',$2,'MembershipChanged',$3::jsonb)`,
      [orgId,userId,JSON.stringify({oldStatus:target.status,newStatus:status,oldRole:target.role,newRole:role})]);
    return memberView(requireValue(changed.rows[0]));
  },1);
 }
}
