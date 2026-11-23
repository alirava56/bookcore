import {CanActivate,ExecutionContext,Injectable,SetMetadata} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {ProblemException} from '../errors/problem';
import {AccessTokenService} from '../../modules/identity/token.service';
import {DatabaseService} from '../../infrastructure/database/database.service';
import type {CorrelatedRequest} from '../observability/request-context';

export type MembershipRole='OWNER'|'MANAGER'|'RECEPTIONIST'|'TRAINER';
export interface AuthenticatedPrincipal {userId:string;sessionId:string;active:true}
export interface AuthorizedTenantContext {principal:AuthenticatedPrincipal;organizationId:string;role:MembershipRole}
export type Decision={allow:true;scope:AuthorizedTenantContext}|{allow:false;reason:string};
export interface AuthorizationPort {
 authorize(principal:AuthenticatedPrincipal,tenantId:string,operation:string,resourceId?:string):Promise<Decision>;
}
export const PUBLIC_ROUTE='bookcore_public';
export const MONITOR_ROUTE='bookcore_monitor';
export const Public=()=>SetMetadata(PUBLIC_ROUTE,true);
export const MonitoringRoute=()=>SetMetadata(MONITOR_ROUTE,true);
export interface PrincipalRequest extends CorrelatedRequest {principal?:AuthenticatedPrincipal}

@Injectable()
export class GlobalAuthGuard implements CanActivate {
 constructor(private readonly reflector:Reflector,private readonly tokens:AccessTokenService,private readonly db:DatabaseService){}
 async canActivate(ctx:ExecutionContext):Promise<boolean> {
  if(this.reflector.get<boolean>(PUBLIC_ROUTE,ctx.getHandler()))return true;
  if(this.reflector.get<boolean>(MONITOR_ROUTE,ctx.getHandler()))return true;
  const req=ctx.switchToHttp().getRequest<PrincipalRequest>();
  const header=req.headers.authorization;
  const bearer=typeof header==='string'?/^Bearer ([A-Za-z0-9_.-]+)$/i.exec(header):null;
  if(!bearer?.[1])throw new ProblemException(401,'AUTHENTICATION_REQUIRED');
  const claims=this.tokens.verify(bearer[1]);
  let rows;
  try {const client=await this.db.connect();
   try {rows=await client.query<{user_id:string}>(
    `SELECT s.user_id FROM auth_sessions s JOIN users u ON u.id=s.user_id
     WHERE s.id=$1 AND s.user_id=$2 AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
       AND u.status='ACTIVE'`,[claims.sid,claims.sub]);}
   finally {client.release();}
  } catch {throw new ProblemException(503,'DEPENDENCY_UNAVAILABLE');}
  if(!rows.rows[0])throw new ProblemException(401,'AUTH_SESSION_REVOKED');
  req.principal={userId:claims.sub,sessionId:claims.sid,active:true};
  return true;
 }
}
