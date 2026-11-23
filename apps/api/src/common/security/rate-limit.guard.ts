import {CanActivate,ExecutionContext,Inject,Injectable} from '@nestjs/common';
import {createHash} from 'node:crypto';
import {DatabaseService} from '../../infrastructure/database/database.service';
import {ProblemException} from '../errors/problem';
import {normalizeRemoteIp} from './monitor.guard';
import {APP_CONFIG,type AppConfig} from '../../config/app-config';
import type {CorrelatedRequest} from '../observability/request-context';
function canonicalIp(value:string|undefined):string {
 const ip=normalizeRemoteIp(value);
 if(ip.includes('%'))return '';
 return ip.includes(':')?new URL('http://['+ip+']').hostname.slice(1,-1):ip;
}
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
 constructor(private readonly db:DatabaseService,@Inject(APP_CONFIG) private readonly config:AppConfig){}
 async canActivate(ctx:ExecutionContext):Promise<boolean> {
  const request=ctx.switchToHttp().getRequest<CorrelatedRequest>();
  const direct=canonicalIp(request.socket.remoteAddress);
  const trusted=direct&&(this.config.authRateLimitProxyIps??[]).some(ip=>canonicalIp(ip)===direct);
  const forwarded=trusted?request.headers['x-forwarded-for']:undefined;
  // The explicitly trusted ingress must replace the header with the observed client address.
  const peer=trusted?canonicalIp(typeof forwarded==='string'?forwarded.trim():undefined):direct;
  if(!peer)throw new ProblemException(403,'NETWORK_IDENTITY_REQUIRED');
  // Use a stable server-owned handler identity, not the raw URL containing attacker-supplied UUIDs.
  // This bounds database rate-limit keys even when unauthenticated callers vary route parameters.
  const route=`${ctx.getClass().name}:${ctx.getHandler().name}`;
  const quota=ctx.getHandler().name==='register'?20:ctx.getHandler().name==='login'?10:15;
  const key=createHash('sha256').update(`${route}:${peer}`).digest('hex');
  const c=await this.db.connect().catch(()=>{throw new ProblemException(503,'DEPENDENCY_UNAVAILABLE');});
  try {
   const res=await c.query<{count:number}>(`INSERT INTO auth_rate_limits(key_hash,bucket_start,count)
       VALUES ($1,date_trunc('minute',clock_timestamp()),1)
       ON CONFLICT (key_hash) DO UPDATE SET
        count=CASE WHEN auth_rate_limits.bucket_start < date_trunc('minute',clock_timestamp()) THEN 1
               ELSE auth_rate_limits.count+1 END,
        bucket_start=date_trunc('minute',clock_timestamp())
       RETURNING count`,[key]);
   if(Number(res.rows[0]?.count)>quota)throw new ProblemException(429,'AUTH_RATE_LIMITED');
   return true;
  } catch(err){if(err instanceof ProblemException)throw err;throw new ProblemException(503,'DEPENDENCY_UNAVAILABLE');}
  finally {c.release();}
 }
}
