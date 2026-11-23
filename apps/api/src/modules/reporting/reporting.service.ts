import {Injectable} from '@nestjs/common';
import {DatabaseService} from '../../infrastructure/database/database.service';
import {ProblemException} from '../../common/errors/problem';
import type {AuthenticatedPrincipal} from '../../common/security/authorization';
import {occupancyRange} from './reporting.domain';
interface ReportRow {member:boolean;allowed:boolean;sessions:string;confirmed:string;attended:string;no_show:string;cancelled:string}
/** One statement = one PostgreSQL READ COMMITTED snapshot. Counts are current persisted rows, not events. */
@Injectable()
export class ReportingService {
 constructor(private readonly db:DatabaseService){}
 async occupancy(p:AuthenticatedPrincipal,orgId:string,from:unknown,to:unknown){
  let range:ReturnType<typeof occupancyRange>;
  try{range=occupancyRange(from,to);}catch{throw new ProblemException(400,'INVALID_REPORTING_RANGE');}
  const client=await this.db.connect();
  try {
   const result=await client.query<ReportRow>(`WITH memberships_visible AS (
     SELECT m.role FROM memberships m JOIN organizations o ON o.id=m.tenant_id
     JOIN users u ON u.id=m.user_id AND u.status='ACTIVE'
     JOIN auth_sessions a ON a.user_id=u.id AND a.id=$3 AND a.revoked_at IS NULL
       AND a.expires_at>clock_timestamp()
     WHERE m.tenant_id=$1 AND m.user_id=$2 AND m.status='ACTIVE' AND o.status='ACTIVE'
    ), selected_sessions AS (
     SELECT s.id FROM sessions s WHERE s.tenant_id=$1 AND s.status IN ('PUBLISHED','FINISHED','CANCELLED')
      AND EXISTS(SELECT 1 FROM memberships_visible WHERE role IN ('OWNER','MANAGER'))
      AND s.start_at >= $4::timestamptz AND s.start_at < $5::timestamptz
    ), totals AS (
     SELECT count(*)::text AS sessions FROM selected_sessions
    ), bookings_total AS (
     SELECT count(*) FILTER(WHERE b.status='CONFIRMED')::text AS confirmed,
       count(*) FILTER(WHERE b.status='ATTENDED')::text AS attended,
       count(*) FILTER(WHERE b.status='NO_SHOW')::text AS no_show,
       count(*) FILTER(WHERE b.status='CANCELLED')::text AS cancelled
      FROM selected_sessions ss JOIN bookings b ON b.session_id=ss.id AND b.tenant_id=$1
    )
    SELECT EXISTS(SELECT 1 FROM memberships_visible) AS member,
     EXISTS(SELECT 1 FROM memberships_visible WHERE role IN ('OWNER','MANAGER')) AS allowed,
     totals.sessions,bookings_total.confirmed,bookings_total.attended,
     bookings_total.no_show,bookings_total.cancelled FROM totals CROSS JOIN bookings_total`,
    [orgId,p.userId,p.sessionId,range.from,range.to]);
   const r=result.rows[0];
   if(!r?.member)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   if(!r.allowed)throw new ProblemException(403,'TENANT_ACCESS_DENIED');
   return {tenantId:orgId,from:range.from,to:range.to,sessions:Number(r.sessions),
    confirmed:Number(r.confirmed),attended:Number(r.attended),noShow:Number(r.no_show),
    cancelledBookings:Number(r.cancelled)};
  }finally{client.release();}
 }
}
