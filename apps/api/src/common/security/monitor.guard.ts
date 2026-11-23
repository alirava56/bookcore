import { timingSafeEqual,createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { CanActivate,ExecutionContext,Inject,Injectable } from '@nestjs/common';
import { APP_CONFIG,type AppConfig } from '../../config/app-config';
import { ProblemException } from '../errors/problem';
import type { CorrelatedRequest } from '../observability/request-context';

export function normalizeRemoteIp(ip: string | undefined):string {
  if(!ip) return '';
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return isIP(normalized) ? normalized.toLowerCase() : '';
}
export function equalSecret(provided:string,expected:string):boolean {
  // Compare fixed-size digests to avoid unequal-buffer-length short circuit.
  const a=createHash('sha256').update(provided).digest();
  const b=createHash('sha256').update(expected).digest();
  return timingSafeEqual(a,b);
}
@Injectable()
export class MonitorGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly cfg:AppConfig){}
  canActivate(ctx:ExecutionContext):boolean {
    const req=ctx.switchToHttp().getRequest<CorrelatedRequest>();
    const ip=normalizeRemoteIp(req.socket?.remoteAddress);
    if(!ip || !this.cfg.monitorAllowedIps.map(normalizeRemoteIp).includes(ip))
      throw new ProblemException(403,'MONITOR_NETWORK_DENIED');
    const supplied=req.headers['x-bookcore-monitor-key'];
    if(typeof supplied !== 'string' || !equalSecret(supplied,this.cfg.monitorApiKey))
      throw new ProblemException(401,'MONITOR_AUTH_REQUIRED');
    return true;
  }
}
