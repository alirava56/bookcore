import {requireValue} from '../../common/require-value';
import {Optional} from '@nestjs/common';
import {MetricsService} from '../../common/observability/metrics.registry';
import {mayActOnBehalf} from '../governance/governance.domain';
import {Injectable,Inject} from '@nestjs/common';
import {APP_CONFIG,type AppConfig} from '../../config/app-config';
import {bookingPgError} from './booking-error';
import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {DatabaseService} from '../../infrastructure/database/database.service';
import {UnitOfWork} from '../../infrastructure/transactions/unit-of-work';
import {TenantAuthorizationService} from '../organizations/authorization.service';
import type {AuthenticatedPrincipal,MembershipRole} from '../../common/security/authorization';
import {ProblemException} from '../../common/errors/problem';
import {UnknownCommitOutcome} from '../../infrastructure/transactions/sqlstate';
import {canBook,canCancelBooking,bookingRejection,encodeBookingCursor,parseBookingPage,canonicalRequest,type BookingStatus} from './booking.domain';
import type {CreateBookingDto,CancelBookingDto,AttendanceBookingDto,BookingReceiptDto} from './booking.dto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN=new Set<MembershipRole>(['OWNER','MANAGER','RECEPTIONIST']);
interface BookingRow {
 id:string;tenant_id:string;session_id:string;customer_id:string;created_by_actor_id:string;
 status:BookingStatus;created_at:Date|string;created_at_cursor?:string;cancelled_at:Date|string|null;
}
interface SessionRow {
 id:string;tenant_id:string;status:string;start_at:Date|string;end_at:Date|string;
 capacity_total:number;seats_committed:number;trainer_resource_id:string;
}
const ms=(v:Date|string)=>new Date(v).getTime();
function receipt(row:BookingRow):BookingReceiptDto {
 return {id:row.id,tenantId:row.tenant_id,sessionId:row.session_id,
  customerId:row.customer_id,status:row.status,createdAt:new Date(row.created_at).toISOString(),
  cancelledAt:row.cancelled_at?new Date(row.cancelled_at).toISOString():null};
}
function mapDb(err:unknown):never {
 if(err instanceof ProblemException || err instanceof UnknownCommitOutcome)throw err;
 const mapped=bookingPgError(err);
 if(mapped)throw new ProblemException(mapped.status,mapped.code);
 throw err;
}
interface Result {status:number;body:unknown}
/** Every write holds Organization => AuthSession => optional Membership => Idempotency => Session => Booking.
 * Lookup of immutable session_id before Session lock is non-locking and never grants authorization.
 * PostgreSQL is the final arbiter of capacity and effective-booking uniqueness.
 */
@Injectable()
export class BookingService {
 constructor(private readonly db:DatabaseService,private readonly uow:UnitOfWork,
  private readonly authorization:TenantAuthorizationService,@Inject(APP_CONFIG) private readonly config:AppConfig,
  @Optional() private readonly metrics?:MetricsService){}
 private async lockOrganization(c:PoolClient,orgId:string):Promise<void> {
  const result=await c.query<{active:boolean}>(
    `SELECT public.bookcore_share_active_organization($1) AS active`,[orgId]);
  if(!result.rows[0]?.active)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
 }
 private async staff(c:PoolClient,p:AuthenticatedPrincipal,orgId:string):Promise<MembershipRole>{
  const role=await this.authorization.forWrite(c,p,orgId,false);
  if(!ADMIN.has(role)&&role!=='TRAINER')throw new ProblemException(403,'TENANT_ACCESS_DENIED');
  return role;
 }
 private async claim(c:PoolClient,p:AuthenticatedPrincipal,orgId:string,operation:string,key:string,payload:unknown):Promise<Result|null>{
  if(!key||!UUID.test(key))throw new ProblemException(400,'INVALID_IDEMPOTENCY_KEY');
  const fingerprint=createHash('sha256').update(canonicalRequest(payload)).digest('hex');
  await c.query(`INSERT INTO idempotency_records(tenant_id,actor_id,operation,key,request_hash,state)
    VALUES ($1,$2,$3,$4,$5,'PROCESSING') ON CONFLICT DO NOTHING`,[orgId,p.userId,operation,key,fingerprint]);
  const found=await c.query<{state:string;request_hash:string;expired:boolean;response_status:number|null;response_body:unknown}>(
   `SELECT state,request_hash,(expires_at<=clock_timestamp()) AS expired,response_status,response_body FROM idempotency_records
    WHERE tenant_id=$1 AND actor_id=$2 AND operation=$3 AND key=$4 FOR UPDATE`,[orgId,p.userId,operation,key]);
  const value=found.rows[0];
  if(!value)throw new ProblemException(503,'IDEMPOTENCY_UNAVAILABLE');
  if(value.request_hash!==fingerprint)throw new ProblemException(409,'IDEMPOTENCY_KEY_REUSED');
  if(value.expired)throw new ProblemException(409,'IDEMPOTENCY_KEY_EXPIRED');
  if(value.state==='FINAL')return {status:requireValue(value.response_status),body:value.response_body};
  return null;
 }
 private async finalize(c:PoolClient,p:AuthenticatedPrincipal,orgId:string,operation:string,key:string,result:Result){
  await c.query(`UPDATE idempotency_records SET state='FINAL',response_status=$5,response_body=$6::jsonb
    WHERE tenant_id=$1 AND actor_id=$2 AND operation=$3 AND key=$4`,
   [orgId,p.userId,operation,key,result.status,JSON.stringify(result.body)]);
 }
 private async runIdempotent(p:AuthenticatedPrincipal,orgId:string,operation:string,key:string,payload:unknown,
   work:(c:PoolClient)=>Promise<Result>,preflight?:(c:PoolClient)=>Promise<void>):Promise<Result>{
  try {
   return await this.uow.run(async c=>{
    await this.lockOrganization(c,orgId);
    await this.authorization.liveSession(c,p);
    if(preflight)await preflight(c);
    const previous=await this.claim(c,p,orgId,operation,key,payload);
    if(previous){this.metrics?.event('idempotent_replay');return previous;}
    // Expected domain failures are committed as stable JSON; never finalize a rolled-back SQL error.
    let result:Result;
    try {result=await work(c);}catch(err){
     if(err instanceof ProblemException && [404,409,422].includes(err.getStatus())){
      result={status:err.getStatus(),body:{code:err.problemCode}};
     }else throw err;
    }
    await this.finalize(c,p,orgId,operation,key,result);
    return result;
   },1);
  }catch(err){return mapDb(err);}
 }
 private unwrap<T>(result:Result):T {
  if(result.status>=400){const body=result.body as {code?:string};
   throw new ProblemException(result.status,body.code??'BOOKING_OPERATION_REJECTED');}
  return result.body as T;
 }
 private async lockSession(c:PoolClient,orgId:string,id:string):Promise<SessionRow>{
  const row=await c.query<SessionRow>('SELECT * FROM sessions WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[orgId,id]);
  if(!row.rows[0])throw new ProblemException(404,'RESOURCE_NOT_FOUND');
  return row.rows[0];
 }
 private async clock(c:PoolClient):Promise<number>{
  const result=await c.query<{now:Date}>('SELECT clock_timestamp() AS now');
  return ms(requireValue(result.rows[0]).now);
 }
 private async cutoff(c:PoolClient,orgId:string):Promise<number>{
  const r=await c.query<{cancellation_cutoff_min:number}>('SELECT cancellation_cutoff_min FROM organizations WHERE id=$1',[orgId]);
  if(!r.rows[0])throw new ProblemException(404,'RESOURCE_NOT_FOUND');return r.rows[0].cancellation_cutoff_min;
 }
 private async event(c:PoolClient,p:AuthenticatedPrincipal,orgId:string,bookingId:string,
  previous:BookingStatus|null,next:BookingStatus,reason:string|null,attestation?:string){
  await c.query(`INSERT INTO booking_events(tenant_id,booking_id,from_status,to_status,actor_id,reason)
     VALUES($1,$2,$3,$4,$5,$6)`,[orgId,bookingId,previous,next,p.userId,reason]);
  await c.query(`INSERT INTO outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'BOOKING',$2,$3,$4::jsonb)`,
    [orgId,bookingId,next==='CONFIRMED'?'BookingConfirmed':next==='CANCELLED'?'BookingCancelled':'BookingAttendanceRecorded',
     JSON.stringify({bookingId,status:next})]);
  await c.query(`INSERT INTO audit_events(tenant_id,actor_id,action,aggregate_type,aggregate_id,reason,metadata)
     VALUES($1,$2,$3,'BOOKING',$4,$5,$6::jsonb)`,[orgId,p.userId,`Booking${next}`,bookingId,reason,JSON.stringify({status:next,...(attestation?{note:attestation}:{})})]);
 }
 async create(p:AuthenticatedPrincipal,orgId:string,sessionId:string,key:string,dto:CreateBookingDto):Promise<BookingReceiptDto>{
  const customerId=dto.customerId??p.userId;
  const onBehalf=customerId!==p.userId;
  const preflight=async (c:PoolClient)=>{
   // Membership must be current even when replaying a previous staff operation.
   if(onBehalf){
    const role=await this.authorization.forWrite(c,p,orgId,false);
    if(!mayActOnBehalf(role))throw new ProblemException(403,'TENANT_ACCESS_DENIED');
   }
  };
  const result=await this.runIdempotent(p,orgId,'BookingCreate',key,{sessionId,customerId},async c=>{
   // Checked AFTER a committed same-key replay, but BEFORE any new booking operation.
   // A revoked consent cannot authorize new work; old committed response remains idempotently recoverable.
   const user=await c.query<{active:boolean}>('SELECT public.bookcore_share_active_user($1) AS active',[customerId]);
   if(!user.rows[0]?.active)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   if(onBehalf){
    const consent=await c.query(`SELECT 1 FROM booking_consents
      WHERE tenant_id=$1 AND customer_id=$2 AND revoked_at IS NULL
        AND expires_at>clock_timestamp() FOR SHARE`,[orgId,customerId]);
    if(!consent.rows.length)throw new ProblemException(403,'BOOKING_CONSENT_REQUIRED');
   }
   const s=await this.lockSession(c,orgId,sessionId);
   // Phase01 only defines a customer CANCELLATION cutoff; booking creation is allowed until start.
   const code=canBook(s.status,ms(s.start_at),await this.clock(c),s.seats_committed,s.capacity_total,0);
   if(code && code!=='SESSION_FULL')throw new ProblemException(409,code);
   const existing=await c.query(`SELECT 1 FROM bookings WHERE tenant_id=$1 AND session_id=$2
       AND customer_id=$3 AND status IN ('CONFIRMED','ATTENDED','NO_SHOW') LIMIT 1`,[orgId,sessionId,customerId]);
   const rejection=bookingRejection(code,existing.rows.length>0);
   if(rejection){if(rejection==='SESSION_FULL')this.metrics?.event('booking_capacity_conflict');
    throw new ProblemException(409,rejection);}
   const inserted=await c.query<BookingRow>(`INSERT INTO bookings(tenant_id,session_id,customer_id,created_by_actor_id)
       VALUES($1,$2,$3,$4) RETURNING *`,[orgId,sessionId,customerId,p.userId]);
   const booking=requireValue(inserted.rows[0]);
   await c.query(`UPDATE sessions SET seats_committed=seats_committed+1,version=version+1,updated_at=clock_timestamp()
      WHERE tenant_id=$1 AND id=$2`,[orgId,sessionId]);
   await this.event(c,p,orgId,booking.id,null,'CONFIRMED',null);
   return {status:201,body:receipt(booking)};
  },preflight);
  return this.unwrap<BookingReceiptDto>(result);
 }
 async mine(p:AuthenticatedPrincipal,orgId:string,filters:{from?:string;to?:string;limit?:string;cursor?:string}){
  let page:ReturnType<typeof parseBookingPage>;
  const pagingSecret=this.config.jwtKeys[this.config.jwtActiveKid];
  if(!pagingSecret)throw new ProblemException(503,'DEPENDENCY_UNAVAILABLE');
  const pagingScope=orgId+':'+p.userId;
  try{page=parseBookingPage(filters,pagingSecret,pagingScope);}catch(err){throw new ProblemException(400,err instanceof Error?err.message:'INVALID_PAGE');}
  const c=await this.db.connect();
  try {
   // Authenticated global customer needs no staff membership; keep user+tenant in the same SQL predicate.
   const rows=await c.query<BookingRow>(`SELECT b.*,to_char(b.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at_cursor FROM bookings b
      JOIN organizations o ON o.id=b.tenant_id
      JOIN users u ON u.id=b.customer_id AND u.status='ACTIVE'
      JOIN auth_sessions a ON a.id=$3 AND a.user_id=u.id AND a.revoked_at IS NULL
       AND a.expires_at>clock_timestamp()
      WHERE b.tenant_id=$1 AND b.customer_id=$2
       AND b.created_at >= $4::timestamptz AND b.created_at < $5::timestamptz
       AND ($6::timestamptz IS NULL OR (b.created_at,b.id)<($6::timestamptz,$7::uuid))
      ORDER BY b.created_at DESC,b.id DESC LIMIT $8`,
    [orgId,p.userId,p.sessionId,page.from,page.to,page.at,page.id,page.limit+1]);
   const selected=rows.rows.slice(0,page.limit),more=rows.rows.length>page.limit,last=selected.at(-1);
   return {items:selected.map(receipt),page:{hasMore:more,
      nextCursor:more&&last?encodeBookingCursor(requireValue(last.created_at_cursor),last.id,pagingSecret,pagingScope):null}};
  }finally{c.release();}
 }
 private async mutate(p:AuthenticatedPrincipal,orgId:string,bookingId:string,key:string,
  action:'cancel'|'attendance',dto:CancelBookingDto|AttendanceBookingDto):Promise<BookingReceiptDto>{
  const operation=action==='cancel'?'BookingCancel':'BookingAttendance';
  let authorizedRole:MembershipRole|null=null;
  const preflight=async(c:PoolClient)=>{
   const row=await c.query<{customer_id:string}>(
     'SELECT customer_id FROM bookings WHERE tenant_id=$1 AND id=$2',[orgId,bookingId]);
   if(!row.rows[0])throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   if(action==='attendance'||row.rows[0].customer_id!==p.userId){
    authorizedRole=await this.staff(c,p,orgId);
    if(action==='cancel'&&!ADMIN.has(authorizedRole))throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   }
  };
  const result=await this.runIdempotent(p,orgId,operation,key,{bookingId,action,...dto},async c=>{
   // This first lookup never authorizes the caller and takes no lock. Identity/session relation is immutable.
   const relation=await c.query<{session_id:string}>(
      'SELECT session_id FROM bookings WHERE tenant_id=$1 AND id=$2',[orgId,bookingId]);
   if(!relation.rows[0])throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   const s=await this.lockSession(c,orgId,relation.rows[0].session_id);
   const found=await c.query<BookingRow>('SELECT * FROM bookings WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[orgId,bookingId]);
   const b=found.rows[0];if(!b||b.session_id!==s.id)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   const self=b.customer_id===p.userId;
   if(action==='attendance'||!self){
    // The organization and membership locks were acquired in preflight, before idempotency/Session.
    if(!authorizedRole)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
    if(action==='attendance'&&authorizedRole==='TRAINER'){
     const assigned=await c.query(`SELECT 1 FROM resources r WHERE r.tenant_id=$1
       AND r.id=$2 AND r.type='TRAINER' AND r.trainer_user_id=$3`,[orgId,s.trainer_resource_id,p.userId]);
     if(!assigned.rows.length)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
    }
   }
   const now=await this.clock(c);
   if(action==='cancel'){
    const data=dto as CancelBookingDto;
    const cutoff=await this.cutoff(c,orgId);
    if(!self && !data.reason?.trim())throw new ProblemException(422,'CANCELLATION_REASON_REQUIRED');
    if(b.status==='CONFIRMED' && s.status==='PUBLISHED' && now<ms(s.start_at) && self &&
      ms(s.start_at)-now<cutoff*60000)throw new ProblemException(422,'CANCELLATION_WINDOW_CLOSED');
    if(!canCancelBooking(b.status,s.status,ms(s.start_at),now,cutoff,!self))
      throw new ProblemException(409,'BOOKING_NOT_CANCELLABLE');
    const reason=data.reason?.trim()||'CUSTOMER_REQUEST';
    const changed=await c.query<BookingRow>(`UPDATE bookings SET status='CANCELLED',cancelled_at=clock_timestamp(),
      cancel_reason=$3,updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2 RETURNING *`,
     [orgId,bookingId,reason]);
    await c.query(`UPDATE sessions SET seats_committed=seats_committed-1,version=version+1,
      updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2`,[orgId,s.id]);
    await this.event(c,p,orgId,bookingId,'CONFIRMED','CANCELLED',reason);
    return {status:200,body:receipt(requireValue(changed.rows[0]))};
   }
   const attendance=dto as AttendanceBookingDto;
   if(b.status!=='CONFIRMED'||s.status!=='FINISHED'||now<ms(s.end_at))
     throw new ProblemException(409,'INVALID_STATE_TRANSITION');
   const changed=await c.query<BookingRow>(`UPDATE bookings SET status=$3,updated_at=clock_timestamp()
     WHERE tenant_id=$1 AND id=$2 RETURNING *`,[orgId,bookingId,attendance.status]);
   await this.event(c,p,orgId,bookingId,'CONFIRMED',attendance.status,null,attendance.reason?.trim());
   return {status:200,body:receipt(requireValue(changed.rows[0]))};
  },preflight);
  return this.unwrap<BookingReceiptDto>(result);
 }
 cancel(p:AuthenticatedPrincipal,orgId:string,id:string,key:string,dto:CancelBookingDto){
  return this.mutate(p,orgId,id,key,'cancel',dto);
 }
 attendance(p:AuthenticatedPrincipal,orgId:string,id:string,key:string,dto:AttendanceBookingDto){
  return this.mutate(p,orgId,id,key,'attendance',dto);
 }
}
