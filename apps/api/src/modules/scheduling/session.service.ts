import {requireValue} from '../../common/require-value';
import {Injectable} from '@nestjs/common';
import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {DatabaseService} from '../../infrastructure/database/database.service';
import {UnitOfWork} from '../../infrastructure/transactions/unit-of-work';
import {TenantAuthorizationService} from '../organizations/authorization.service';
import {CatalogService} from '../catalog/catalog.service';
import {validateSchedulingInstant} from '../catalog/availability';
import type {AuthenticatedPrincipal,MembershipRole} from '../../common/security/authorization';
import {ProblemException} from '../../common/errors/problem';
import {pgCode,UnknownCommitOutcome} from '../../infrastructure/transactions/sqlstate';
import {boundedInterval,canTransition,validCapacity,bufferedInterval,parseSessionPage,encodeSessionCursor,type SessionPage,type SessionStatus} from './session.domain';
import type {CreateSessionDto,CancelSessionDto,CapacitySessionDto,PublicSessionDto,StaffSessionDto} from './session.dto';

interface SessionRow {
 id:string;tenant_id:string;branch_id:string;service_id:string;trainer_resource_id:string;room_resource_id:string|null;
 start_at:Date|string;end_at:Date|string;timezone_snapshot:string;status:SessionStatus;
 capacity_total:number;seats_committed:number;version:string|number;service_title?:string;branch_name?:string;
}
interface ResourceRow {id:string;type:'TRAINER'|'ROOM';branch_id:string|null;trainer_user_id:string|null;
 active:boolean;buffer_before_min:number;buffer_after_min:number}
const ADMINS=new Set<MembershipRole>(['OWNER','MANAGER']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso=(v:Date|string)=>new Date(v).toISOString();
const staffView=(s:SessionRow):StaffSessionDto=>({
 id:s.id,tenantId:s.tenant_id,branchId:s.branch_id,serviceId:s.service_id,
 trainerResourceId:s.trainer_resource_id,roomResourceId:s.room_resource_id,
 startAt:iso(s.start_at),endAt:iso(s.end_at),timezone:s.timezone_snapshot,status:s.status,
 capacityTotal:s.capacity_total,seatsCommitted:s.seats_committed,
 seatsAvailable:Math.max(0,s.capacity_total-s.seats_committed),version:Number(s.version)
});
// Public allowlist is not derived from staffView; new staff fields cannot leak by object spread.
const publicView=(s:SessionRow):PublicSessionDto=>({
 id:s.id,serviceTitle:requireValue(s.service_title),branchName:requireValue(s.branch_name),startAt:iso(s.start_at),
 endAt:iso(s.end_at),timezone:s.timezone_snapshot,status:'PUBLISHED',
 seatsAvailable:Math.max(0,s.capacity_total-s.seats_committed)
});
function knownDbError(err:unknown):never {
 if(err instanceof ProblemException || err instanceof UnknownCommitOutcome)throw err;
 const code=pgCode(err);
 if(code==='23P01')throw new ProblemException(409,'RESOURCE_CONFLICT');
 if(code==='23505')throw new ProblemException(409,'UNIQUE_CONSTRAINT_CONFLICT');
 if(code==='23503')throw new ProblemException(409,'TENANT_REFERENCE_CONFLICT');
 if(code==='23514')throw new ProblemException(409,'DATABASE_INVARIANT_VIOLATION');
 if(code==='40P01'||code==='40001'||code==='55P03'||code==='57014')throw new ProblemException(503,'TRANSACTION_RETRY_REQUIRED');
 throw err;
}
function queryPage(input:{from?:string;to?:string;limit?:string;cursor?:string}):SessionPage {
 try{return parseSessionPage(input.from,input.to,input.limit,input.cursor);}catch(err){
  throw new ProblemException(400,err instanceof Error?err.message:'INVALID_PAGE');
 }
}
@Injectable()
export class SessionService {
 constructor(private readonly db:DatabaseService,private readonly uow:UnitOfWork,
  private readonly authorization:TenantAuthorizationService,private readonly catalog:CatalogService){}
 private async tenantLock(c:PoolClient,orgId:string):Promise<void>{
  const result=await c.query<{ok:boolean}>('SELECT public.lock_bookcore_organization($1) AS ok',[orgId]);
  if(!result.rows[0]?.ok)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
 }
 private async writePermission(c:PoolClient,p:AuthenticatedPrincipal,orgId:string):Promise<void>{
  const role=await this.authorization.forWrite(c,p,orgId,false);
  if(!ADMINS.has(role))throw new ProblemException(403,'TENANT_ACCESS_DENIED');
 }
 private async audit(c:PoolClient,p:AuthenticatedPrincipal,orgId:string,id:string,action:string,metadata:object={}){
  await c.query(`INSERT INTO audit_events(tenant_id,actor_id,action,aggregate_type,aggregate_id,metadata)
    VALUES($1,$2,$3,'SESSION',$4,$5::jsonb)`,[orgId,p.userId,action,id,JSON.stringify(metadata)]);
  await c.query(`INSERT INTO outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload)
    VALUES($1,'SESSION',$2,$3,$4::jsonb)`,[orgId,id,action,JSON.stringify(metadata)]);
 }
 private async lockedSession(c:PoolClient,orgId:string,id:string):Promise<SessionRow>{
  const rows=await c.query<SessionRow>('SELECT * FROM sessions WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[orgId,id]);
  if(!rows.rows[0])throw new ProblemException(404,'RESOURCE_NOT_FOUND');return rows.rows[0];
 }
 private async scheduleAllowed(c:PoolClient,orgId:string,s:{branch_id:string;trainer_resource_id:string;room_resource_id:string|null;start_at:string;end_at:string},trustedUtc:boolean){
  for(const resourceId of [s.trainer_resource_id,s.room_resource_id].filter((x):x is string=>!!x)){
   const result=await this.catalog.evaluateInTransaction(c,orgId,s.branch_id,resourceId,
     s.start_at,s.end_at,trustedUtc);
   if(!result.available)throw new ProblemException(409,result.code);
  }
 }
 private async resource(c:PoolClient,orgId:string,id:string):Promise<ResourceRow>{
  await this.catalog.lockActiveTarget(c,orgId,id,'resource');
  const r=await c.query<ResourceRow>(`SELECT id,type,branch_id,trainer_user_id,active,
     buffer_before_min,buffer_after_min FROM resources WHERE tenant_id=$1 AND id=$2`,[orgId,id]);
  if(!r.rows[0]||!r.rows[0].active)throw new ProblemException(404,'RESOURCE_NOT_FOUND');return r.rows[0];
 }
 async create(p:AuthenticatedPrincipal,orgId:string,dto:CreateSessionDto,key?:string):Promise<StaffSessionDto>{
  try {return await this.uow.run(async c=>{
   // Organization row is the first lock on all scheduler/Catalog administrative writes.
   await this.tenantLock(c,orgId);await this.writePermission(c,p,orgId);
   // Optional backward-compatible Idempotency-Key: recover a committed creation after lost HTTP ACK.
   // Stable positional payload encoding avoids changes in JSON object key insertion order.
   if(key!==undefined){
    const previous=await this.claim(c,p,orgId,'SessionCreate',key,{
     branchId:dto.branchId,serviceId:dto.serviceId,trainerResourceId:dto.trainerResourceId,
     roomResourceId:dto.roomResourceId??null,startAt:dto.startAt,endAt:dto.endAt,capacityTotal:dto.capacityTotal
    });
    if(previous.replay){if(previous.status>=400)throw new ProblemException(previous.status,'SESSION_CREATE_REPLAY_REJECTED');
     return previous.body as StaffSessionDto;}
   }
   const org=await c.query<{timezone:string}>(`SELECT timezone FROM organizations WHERE id=$1`,[orgId]);
   const zone=org.rows[0]?.timezone;if(!zone)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   let start:string,end:string;
   try {start=validateSchedulingInstant(dto.startAt,zone);end=validateSchedulingInstant(dto.endAt,zone);}
   catch{throw new ProblemException(422,'INVALID_TIMEZONE_OFFSET');}
   const dbClock=await c.query<{now:Date}>('SELECT clock_timestamp() AS now');
   if(!boundedInterval(Date.parse(start),Date.parse(end),new Date(requireValue(dbClock.rows[0]).now).getTime()) ||
     Date.parse(end)-Date.parse(start)<5*60000)throw new ProblemException(422,'INVALID_SESSION_INTERVAL');
   if(!validCapacity(dto.capacityTotal,0))throw new ProblemException(422,'INVALID_CAPACITY');
   await this.catalog.lockActiveTarget(c,orgId,dto.branchId,'branch');
   await this.catalog.lockActiveTarget(c,orgId,dto.serviceId,'service');
   // Lock resources in deterministic UUID order for concurrent create paths.
   const resourceIds=[dto.trainerResourceId,...(dto.roomResourceId?[dto.roomResourceId]:[])].sort();
   const byId=new Map<string,ResourceRow>();for(const id of resourceIds)byId.set(id,await this.resource(c,orgId,id));
   const trainer=requireValue(byId.get(dto.trainerResourceId));
   if(trainer.type!=='TRAINER'||trainer.branch_id!==null||!trainer.trainer_user_id)
    throw new ProblemException(422,'INVALID_TRAINER_RESOURCE');
   const member=await c.query(`SELECT m.user_id FROM memberships m JOIN users u ON u.id=m.user_id
     WHERE m.tenant_id=$1 AND m.user_id=$2 AND m.status='ACTIVE' AND m.role='TRAINER'
       AND u.status='ACTIVE' FOR SHARE OF m`,[orgId,trainer.trainer_user_id]);
   if(!member.rows[0])throw new ProblemException(409,'TRAINER_MEMBERSHIP_INACTIVE');
   if(dto.roomResourceId){const room=requireValue(byId.get(dto.roomResourceId));
    if(room.type!=='ROOM'||room.branch_id!==dto.branchId)throw new ProblemException(422,'INVALID_ROOM_RESOURCE');
   }
   await this.scheduleAllowed(c,orgId,{branch_id:dto.branchId,trainer_resource_id:dto.trainerResourceId,
     room_resource_id:dto.roomResourceId??null,start_at:dto.startAt,end_at:dto.endAt},false);
   const inserted=await c.query<SessionRow>(`INSERT INTO sessions
     (tenant_id,branch_id,service_id,trainer_resource_id,room_resource_id,
       start_at,end_at,timezone_snapshot,capacity_total,created_by)
     VALUES($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz,$8,$9,$10) RETURNING *`,
     [orgId,dto.branchId,dto.serviceId,dto.trainerResourceId,dto.roomResourceId??null,
       start,end,zone,dto.capacityTotal,p.userId]);
   const s=requireValue(inserted.rows[0]);
   for(const id of resourceIds){const r=requireValue(byId.get(id));
    const interval=bufferedInterval(start,end,r.buffer_before_min,r.buffer_after_min);
    await c.query(`INSERT INTO resource_allocations(tenant_id,session_id,resource_id,start_at,end_at)
      VALUES($1,$2,$3,$4::timestamptz,$5::timestamptz)`,
      [orgId,s.id,id,interval.startAt,interval.endAt]);
   }
   await this.audit(c,p,orgId,s.id,'SessionDraftCreated');
   const view=staffView(s);
   if(key!==undefined)await this.finalize(c,p,orgId,'SessionCreate',key,201,view);
   return view;
  },1);}catch(err){return knownDbError(err);}
 }
 private async transition(p:AuthenticatedPrincipal,orgId:string,id:string,operation:'publish'|'finish'){
  try{return await this.uow.run(async c=>{
   await this.tenantLock(c,orgId);await this.writePermission(c,p,orgId);
   const s=await this.lockedSession(c,orgId,id);
   const next=operation==='publish'?'PUBLISHED':'FINISHED';
   if(!canTransition(s.status,next))throw new ProblemException(409,'INVALID_STATE_TRANSITION');
   const dbClock=await c.query<{now:Date}>('SELECT clock_timestamp() AS now');
   const now=new Date(requireValue(dbClock.rows[0]).now).getTime();
   if(operation==='publish'){
    if(now>=Date.parse(iso(s.start_at)))throw new ProblemException(409,'SESSION_NOT_BOOKABLE');
    const validMeta=await c.query(`SELECT 1 FROM branches b JOIN services sv ON sv.tenant_id=b.tenant_id
      WHERE b.tenant_id=$1 AND b.id=$2 AND sv.id=$3 AND b.active AND sv.active`,
      [orgId,s.branch_id,s.service_id]);
    if(!validMeta.rows[0])throw new ProblemException(409,'SESSION_DEPENDENCY_INACTIVE');
    const actual=await c.query<{count:string}>(`SELECT count(*)::text AS count FROM resource_allocations
     WHERE tenant_id=$1 AND session_id=$2 AND active`,[orgId,id]);
    if(Number(actual.rows[0]?.count)!==(s.room_resource_id?2:1))throw new ProblemException(409,'RESOURCE_ALLOCATION_MISSING');
    for(const resourceId of [s.trainer_resource_id,s.room_resource_id].filter((x):x is string=>!!x)){
     const r=await this.resource(c,orgId,resourceId);
     if((resourceId===s.trainer_resource_id && r.type!=='TRAINER') ||
        (resourceId===s.room_resource_id && (r.type!=='ROOM'||r.branch_id!==s.branch_id)))
       throw new ProblemException(409,'RESOURCE_UNAVAILABLE');
    }
    const tr=await c.query(`SELECT 1 FROM resources r JOIN memberships m ON m.tenant_id=r.tenant_id
       AND m.user_id=r.trainer_user_id JOIN users u ON u.id=m.user_id
       WHERE r.tenant_id=$1 AND r.id=$2 AND m.status='ACTIVE' AND m.role='TRAINER' AND u.status='ACTIVE'`,
       [orgId,s.trainer_resource_id]);
    if(!tr.rows[0])throw new ProblemException(409,'TRAINER_MEMBERSHIP_INACTIVE');
    await this.scheduleAllowed(c,orgId,{branch_id:s.branch_id,trainer_resource_id:s.trainer_resource_id,
      room_resource_id:s.room_resource_id,start_at:iso(s.start_at),end_at:iso(s.end_at)},true);
   } else if(now<Date.parse(iso(s.end_at)))throw new ProblemException(409,'SESSION_NOT_FINISHABLE');
   const row=await c.query<SessionRow>(`UPDATE sessions SET status=$3,version=version+1,updated_at=clock_timestamp()
     WHERE tenant_id=$1 AND id=$2 RETURNING *`,[orgId,id,next]);
   await this.audit(c,p,orgId,id,operation==='publish'?'SessionPublished':'SessionFinished');
   return staffView(requireValue(row.rows[0]));
  },1);}catch(err){return knownDbError(err);}
 }
 publish(p:AuthenticatedPrincipal,orgId:string,id:string){return this.transition(p,orgId,id,'publish');}
 finish(p:AuthenticatedPrincipal,orgId:string,id:string){return this.transition(p,orgId,id,'finish');}
 private async claim(c:PoolClient,p:AuthenticatedPrincipal,orgId:string,operation:string,key:string,payload:object){
  if(!UUID.test(key))throw new ProblemException(400,'INVALID_IDEMPOTENCY_KEY');
  const fingerprint=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  await c.query(`INSERT INTO idempotency_records(tenant_id,actor_id,operation,key,request_hash,state)
    VALUES($1,$2,$3,$4,$5,'PROCESSING') ON CONFLICT DO NOTHING`,
    [orgId,p.userId,operation,key,fingerprint]);
  const found=await c.query<{request_hash:string;state:string;response_status:number|null;response_body:unknown}>(
   `SELECT request_hash,state,response_status,response_body FROM idempotency_records
      WHERE tenant_id=$1 AND actor_id=$2 AND operation=$3 AND key=$4 FOR UPDATE`,
   [orgId,p.userId,operation,key]);
  const record=found.rows[0];if(!record)throw new ProblemException(503,'IDEMPOTENCY_UNAVAILABLE');
  if(record.request_hash!==fingerprint)throw new ProblemException(409,'IDEMPOTENCY_KEY_REUSED');
  if(record.state==='FINAL')return {replay:true,status:requireValue(record.response_status),body:record.response_body};
  return {replay:false,status:0,body:null};
 }
 private async finalize(c:PoolClient,p:AuthenticatedPrincipal,orgId:string,operation:string,key:string,status:number,body:unknown){
  await c.query(`UPDATE idempotency_records SET state='FINAL',response_status=$5,response_body=$6::jsonb
    WHERE tenant_id=$1 AND actor_id=$2 AND operation=$3 AND key=$4`,
    [orgId,p.userId,operation,key,status,JSON.stringify(body)]);
 }
 private async idempotent(p:AuthenticatedPrincipal,orgId:string,id:string,key:string,
   op:'cancel'|'capacity',data:CancelSessionDto|CapacitySessionDto):Promise<StaffSessionDto>{
  const payload={id,op,...data};
  // Domain 4xx are intentionally finalized. SQL errors and unknown COMMIT abort/recover via same key.
  let outcome:{status:number;body:unknown};
  try {outcome=await this.uow.run(async c=>{
   await this.tenantLock(c,orgId);await this.writePermission(c,p,orgId);
   const name=op==='cancel'?'SessionCancel':'SessionCapacity';
   const claim=await this.claim(c,p,orgId,name,key,payload);
   if(claim.replay)return {status:claim.status,body:claim.body};
   let s:SessionRow;
   try{s=await this.lockedSession(c,orgId,id);}catch(err){
    if(err instanceof ProblemException && err.getStatus()===404){
     const body={code:'RESOURCE_NOT_FOUND'};await this.finalize(c,p,orgId,name,key,404,body);
     return {status:404,body};
    }
    throw err;
   }
   const clock=await c.query<{now:Date}>('SELECT clock_timestamp() AS now');
   let refusal:string|null=null;
   if(!['DRAFT','PUBLISHED'].includes(s.status) ||
       new Date(requireValue(clock.rows[0]).now).getTime()>=Date.parse(iso(s.start_at)))refusal='INVALID_STATE_TRANSITION';
   if(op==='capacity' && !validCapacity((data as CapacitySessionDto).capacityTotal,s.seats_committed))
    refusal='CAPACITY_BELOW_COMMITTED';
   if(op==='cancel' && !(data as CancelSessionDto).reason.trim())refusal='INVALID_CANCELLATION_REASON';
   if(refusal){const body={code:refusal};await this.finalize(c,p,orgId,name,key,409,body);
    return {status:409,body};}
   let changed:SessionRow;
   if(op==='capacity'){
    const total=(data as CapacitySessionDto).capacityTotal;
    const result=await c.query<SessionRow>(`UPDATE sessions
     SET capacity_total=$3,version=version+1,updated_at=clock_timestamp()
     WHERE tenant_id=$1 AND id=$2 RETURNING *`,[orgId,id,total]);
    changed=requireValue(result.rows[0]);
    await this.audit(c,p,orgId,id,'SessionCapacityChanged',{old:s.capacity_total,new:total});
   }else{
    const reason=(data as CancelSessionDto).reason.trim();
    // Historical attendance cannot be rewritten; a future session with such rows is rejected.
    const invalid=await c.query(`SELECT 1 FROM bookings WHERE tenant_id=$1 AND session_id=$2
      AND status IN ('ATTENDED','NO_SHOW') LIMIT 1`,[orgId,id]);
    if(invalid.rows[0]){const body={code:'BOOKING_STATE_CONFLICT'};
     await this.finalize(c,p,orgId,name,key,409,body);return {status:409,body};}
    const result=await c.query<SessionRow>(`UPDATE sessions SET status='CANCELLED',cancel_reason=$3,
      seats_committed=0,version=version+1,updated_at=clock_timestamp()
      WHERE tenant_id=$1 AND id=$2 RETURNING *`,[orgId,id,reason]);
    changed=requireValue(result.rows[0]);
    const bookings=await c.query<{id:string}>(`UPDATE bookings SET status='CANCELLED',cancelled_at=clock_timestamp(),
      cancel_reason=$3,updated_at=clock_timestamp() WHERE tenant_id=$1 AND session_id=$2
      AND status='CONFIRMED' RETURNING id`,[orgId,id,reason]);
    for(const booking of bookings.rows){
     await c.query(`INSERT INTO booking_events(tenant_id,booking_id,from_status,to_status,actor_id,reason)
       VALUES($1,$2,'CONFIRMED','CANCELLED',$3,$4)`,[orgId,booking.id,p.userId,reason]);
     await c.query(`INSERT INTO outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload)
       VALUES($1,'BOOKING',$2,'BookingCancelled',$3::jsonb)`,
       [orgId,booking.id,JSON.stringify({sessionId:id,reason})]);
    }
    await c.query(`UPDATE resource_allocations SET active=false,deactivated_at=clock_timestamp()
      WHERE tenant_id=$1 AND session_id=$2 AND active`,[orgId,id]);
    await this.audit(c,p,orgId,id,'SessionCancelled',{reason,cancelledBookings:bookings.rows.length});
   }
   const body=staffView(changed);await this.finalize(c,p,orgId,name,key,200,body);
   return {status:200,body};
  },1);}catch(err){return knownDbError(err);}
  if(outcome.status!==200){const body=outcome.body as {code?:string};
   throw new ProblemException(outcome.status,body.code??'INVALID_STATE_TRANSITION');}
  return outcome.body as StaffSessionDto;
 }
 cancel(p:AuthenticatedPrincipal,orgId:string,id:string,key:string,dto:CancelSessionDto){return this.idempotent(p,orgId,id,key,'cancel',dto);}
 capacity(p:AuthenticatedPrincipal,orgId:string,id:string,key:string,dto:CapacitySessionDto){return this.idempotent(p,orgId,id,key,'capacity',dto);}
 private async page(c:PoolClient,sql:string,params:unknown[],size:number,projection:(s:SessionRow)=>StaffSessionDto|PublicSessionDto){
  const rows=await c.query<SessionRow>(sql,[...params,size+1]);
  const hasMore=rows.rows.length>size;
  const chosen=rows.rows.slice(0,size);const last=chosen.at(-1);
  return {items:chosen.map(projection),page:{hasMore,nextCursor:hasMore&&last?encodeSessionCursor(iso(last.start_at),last.id):null}};
 }
 async listStaff(p:AuthenticatedPrincipal,orgId:string,input:{from?:string;to?:string;limit?:string;cursor?:string}){
  const page=queryPage(input);await this.authorization.forRead(p,orgId);
  const c=await this.db.connect();try {
   return await this.page(c,`SELECT s.* FROM sessions s
     WHERE s.tenant_id=$1 AND s.start_at >= $2::timestamptz AND s.start_at < $3::timestamptz
      AND ($4::timestamptz IS NULL OR (s.start_at,s.id)>($4::timestamptz,$5::uuid))
      AND EXISTS(SELECT 1 FROM memberships m JOIN organizations o ON o.id=m.tenant_id
       WHERE m.tenant_id=s.tenant_id AND m.user_id=$6 AND m.status='ACTIVE'
       AND o.status='ACTIVE' AND (m.role IN ('OWNER','MANAGER','RECEPTIONIST') OR
          (m.role='TRAINER' AND EXISTS(SELECT 1 FROM resources r
            WHERE r.tenant_id=s.tenant_id AND r.id=s.trainer_resource_id
              AND r.trainer_user_id=$6 AND r.type='TRAINER'))))
     ORDER BY s.start_at,s.id LIMIT $7`,
     [orgId,page.from,page.to,page.cursorStart,page.cursorId,p.userId],page.limit,staffView);
  }finally{c.release();}
 }
 async getStaff(p:AuthenticatedPrincipal,orgId:string,id:string):Promise<StaffSessionDto>{
  const role=await this.authorization.forRead(p,orgId);const c=await this.db.connect();try {
   const res=await c.query<SessionRow>(`SELECT s.* FROM sessions s
    WHERE s.tenant_id=$1 AND s.id=$2 AND EXISTS (
      SELECT 1 FROM memberships m JOIN organizations o ON o.id=m.tenant_id
      WHERE m.tenant_id=s.tenant_id AND m.user_id=$3 AND m.status='ACTIVE' AND o.status='ACTIVE'
        AND (m.role IN ('OWNER','MANAGER','RECEPTIONIST') OR
          (m.role='TRAINER' AND EXISTS(SELECT 1 FROM resources r WHERE r.tenant_id=s.tenant_id
             AND r.id=s.trainer_resource_id AND r.trainer_user_id=$3 AND r.type='TRAINER'))))`,
     [orgId,id,p.userId]);
   if(!res.rows[0]||!(role==='TRAINER'||ADMINS.has(role)||role==='RECEPTIONIST'))throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   return staffView(res.rows[0]);
  }finally{c.release();}
 }
 async listPublic(orgId:string,input:{from?:string;to?:string;limit?:string;cursor?:string}){
  const page=queryPage(input);const c=await this.db.connect();try {
   return await this.page(c,`SELECT s.*,sv.title AS service_title,b.name AS branch_name
    FROM sessions s JOIN services sv ON sv.id=s.service_id AND sv.tenant_id=s.tenant_id
     JOIN branches b ON b.id=s.branch_id AND b.tenant_id=s.tenant_id
     JOIN organizations o ON o.id=s.tenant_id
    WHERE s.tenant_id=$1 AND s.status='PUBLISHED' AND o.status='ACTIVE' AND s.start_at>clock_timestamp()
      AND s.start_at >= $2::timestamptz AND s.start_at < $3::timestamptz
      AND ($4::timestamptz IS NULL OR (s.start_at,s.id)>($4::timestamptz,$5::uuid))
    ORDER BY s.start_at,s.id LIMIT $6`,
    [orgId,page.from,page.to,page.cursorStart,page.cursorId],page.limit,publicView);
  }finally{c.release();}
 }
 async getPublic(orgId:string,id:string):Promise<PublicSessionDto>{
  const c=await this.db.connect();try {
   const result=await c.query<SessionRow>(`SELECT s.*,sv.title AS service_title,b.name AS branch_name
     FROM sessions s JOIN services sv ON sv.id=s.service_id AND sv.tenant_id=s.tenant_id
     JOIN branches b ON b.id=s.branch_id AND b.tenant_id=s.tenant_id
     JOIN organizations o ON o.id=s.tenant_id
     WHERE s.tenant_id=$1 AND s.id=$2 AND s.status='PUBLISHED' AND o.status='ACTIVE'
       AND s.start_at>clock_timestamp()`,[orgId,id]);
   if(!result.rows[0])throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   return publicView(result.rows[0]);
  }finally{c.release();}
 }
}
