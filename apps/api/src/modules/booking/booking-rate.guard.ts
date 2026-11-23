import {CanActivate,ExecutionContext,Injectable} from '@nestjs/common';
import {createHash} from 'node:crypto';
import {DatabaseService} from '../../infrastructure/database/database.service';
import type {PrincipalRequest} from '../../common/security/authorization';
import {ProblemException} from '../../common/errors/problem';
/** Shared PostgreSQL per-principal throttling. Global JWT guard must precede this route guard.
 * Unlike IP-only login throttle, many genuine users behind one NAT are independent.
 * Edge must additionally enforce per-IP / distributed traffic budgets.
 */
@Injectable()
export class BookingRateLimitGuard implements CanActivate {
 constructor(private readonly db:DatabaseService){}
 async canActivate(ctx:ExecutionContext):Promise<boolean>{
  const principal=ctx.switchToHttp().getRequest<PrincipalRequest>().principal;
  if(!principal)throw new ProblemException(401,'AUTHENTICATION_REQUIRED');
  const handler=ctx.getHandler().name;
  const quota=handler==='mine'?120:30;
  const key=createHash('sha256').update(`booking-v1:${principal.userId}:${handler}`).digest('hex');
  const c=await this.db.connect().catch(()=>{throw new ProblemException(503,'DEPENDENCY_UNAVAILABLE');});
  try{
   const result=await c.query<{count:number}>(`INSERT INTO auth_rate_limits(key_hash,bucket_start,count)
      VALUES($1,date_trunc('minute',clock_timestamp()),1)
      ON CONFLICT (key_hash) DO UPDATE SET
       count=CASE WHEN auth_rate_limits.bucket_start<date_trunc('minute',clock_timestamp()) THEN 1
             ELSE auth_rate_limits.count+1 END,
       bucket_start=date_trunc('minute',clock_timestamp()) RETURNING count`,[key]);
   if(Number(result.rows[0]?.count)>quota)throw new ProblemException(429,'BOOKING_RATE_LIMITED');
   return true;
  }catch(err){if(err instanceof ProblemException)throw err;throw new ProblemException(503,'DEPENDENCY_UNAVAILABLE');}
  finally{c.release();}
 }
}
