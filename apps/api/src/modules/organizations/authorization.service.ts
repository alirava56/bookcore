import {Injectable} from '@nestjs/common';
import type {PoolClient} from 'pg';
import {DatabaseService} from '../../infrastructure/database/database.service';
import {ProblemException} from '../../common/errors/problem';
import type {AuthenticatedPrincipal,MembershipRole,AuthorizationPort,Decision} from '../../common/security/authorization';

const ADMIN_ROLES=new Set<MembershipRole>(['OWNER','MANAGER']);
@Injectable()
export class TenantAuthorizationService implements AuthorizationPort {
 constructor(private readonly database:DatabaseService){}
 async authorize(principal:AuthenticatedPrincipal,tenantId:string,operation:string):Promise<Decision> {
  const c=await this.database.connect();
  try {
   const row=await c.query<{role:MembershipRole}>(`SELECT m.role FROM memberships m JOIN organizations o ON o.id=m.tenant_id
     WHERE m.tenant_id=$1 AND m.user_id=$2 AND m.status='ACTIVE' AND o.status='ACTIVE'`,[tenantId,principal.userId]);
   if(!row.rows[0])return {allow:false,reason:'TENANT_HIDDEN'};
   if(operation==='manageMembers'&&!ADMIN_ROLES.has(row.rows[0].role))return {allow:false,reason:'ROLE_DENIED'};
   return {allow:true,scope:{principal,organizationId:tenantId,role:row.rows[0].role}};
  } finally{c.release();}
 }
 async forRead(p:AuthenticatedPrincipal,tenantId:string,manage=false):Promise<MembershipRole> {
  const d=await this.authorize(p,tenantId,manage?'manageMembers':'readOrganization');
  if(!d.allow)throw new ProblemException(d.reason==='ROLE_DENIED'?403:404,
     d.reason==='ROLE_DENIED'?'TENANT_ACCESS_DENIED':'RESOURCE_NOT_FOUND');
  return d.scope.role;
 }
 // Used INSIDE one UoW after tenant lock. Lock authorization session and actor membership
 // to serialize revocation, and recheck the session/user state despite earlier HTTP auth.
 async liveSession(c:PoolClient,p:AuthenticatedPrincipal):Promise<void> {
  const state=await c.query<{active:boolean}>(`WITH locked AS MATERIALIZED (
    SELECT s.user_id FROM auth_sessions s WHERE s.id=$1 AND s.user_id=$2
     AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() FOR SHARE
   ) SELECT public.bookcore_share_active_user(user_id) AS active FROM locked`,[p.sessionId,p.userId]);
  if(!state.rows[0]?.active)throw new ProblemException(401,'AUTH_SESSION_REVOKED');
 }
 async forWrite(c:PoolClient,p:AuthenticatedPrincipal,tenantId:string,manage=true):Promise<MembershipRole> {
  await this.liveSession(c,p);
  const active=await c.query<{role:MembershipRole}>(`SELECT role FROM memberships
     WHERE tenant_id=$1 AND user_id=$2 AND status='ACTIVE' FOR SHARE`,[tenantId,p.userId]);
  if(!active.rows[0])throw new ProblemException(404,'RESOURCE_NOT_FOUND');
  if(manage&&!ADMIN_ROLES.has(active.rows[0].role))throw new ProblemException(403,'TENANT_ACCESS_DENIED');
  return active.rows[0].role;
 }
}
