import {CanActivate,ExecutionContext,Injectable} from '@nestjs/common';
import {createHash} from 'node:crypto';
import {DatabaseService} from '../../infrastructure/database/database.service';
import type {PrincipalRequest} from '../../common/security/authorization';
import {ProblemException} from '../../common/errors/problem';
/** Database-backed per-actor limits across API replicas; edge-level IP limits also required. */
@Injectable()
export class GovernanceRateLimitGuard implements CanActivate {
 constructor(private readonly db:DatabaseService){}
 async canActivate(ctx:ExecutionContext):Promise<boolean>{
  const p=ctx.switchToHttp().getRequest<PrincipalRequest>().principal;
  if(!p)throw new ProblemException(401,'AUTHENTICATION_REQUIRED');
  const name=ctx.getHandler().name;
  const quota=['invite','accept','revoke','revokeConsent','grant'].includes(name)?10:60;
  const key=createHash('sha256').update(`governance-v1:${p.userId}:${name}`).digest('hex');
  const c=await this.db.connect().catch(()=>{throw new ProblemException(503,'DEPENDENCY_UNAVAILABLE');});
  try{
   const r=await c.query<{count:number}>(`INSERT INTO auth_rate_limits(key_hash,bucket_start,count)
     VALUES($1,date_trunc('minute',clock_timestamp()),1)
     ON CONFLICT (key_hash) DO UPDATE SET
       count=CASE WHEN auth_rate_limits.bucket_start<date_trunc('minute',clock_timestamp()) THEN 1
          ELSE auth_rate_limits.count+1 END,
       bucket_start=date_trunc('minute',clock_timestamp()) RETURNING count`,[key]);
   if(Number(r.rows[0]?.count)>quota)throw new ProblemException(429,'GOVERNANCE_RATE_LIMITED');
   return true;
  }catch(err){if(err instanceof ProblemException)throw err;throw new ProblemException(503,'DEPENDENCY_UNAVAILABLE');}
  finally{c.release();}
 }
}
