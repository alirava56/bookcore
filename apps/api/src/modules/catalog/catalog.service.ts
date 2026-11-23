import {requireValue} from '../../common/require-value';
import {Injectable} from '@nestjs/common';
import type {PoolClient} from 'pg';
import {DatabaseService} from '../../infrastructure/database/database.service';
import {UnitOfWork} from '../../infrastructure/transactions/unit-of-work';
import {TenantAuthorizationService} from '../organizations/authorization.service';
import type {AuthenticatedPrincipal,MembershipRole} from '../../common/security/authorization';
import {ProblemException} from '../../common/errors/problem';
import {pgCode,UnknownCommitOutcome} from '../../infrastructure/transactions/sqlstate';
import {CreateBranchDto,CreateResourceDto,CreateServiceDto,CreateBusinessHourDto,CreateScheduleExceptionDto,DeactivateRuleDto} from './catalog.dto';
import {evaluateAvailability,validateSchedulingInstant,type AvailabilityResult,type HourRule,type ExceptionRule} from './availability';

type CatalogTable='branches'|'services'|'resources'|'business_hours'|'schedule_exceptions';
type Page={cursor:string|null;limit:number};
type Raw=Record<string,unknown>;
const writable=new Set<MembershipRole>(['OWNER','MANAGER']);
const readRoles:Record<CatalogTable,MembershipRole[]>={
 branches:['OWNER','MANAGER','RECEPTIONIST','TRAINER'],services:['OWNER','MANAGER','RECEPTIONIST','TRAINER'],
 resources:['OWNER','MANAGER','RECEPTIONIST'],business_hours:['OWNER','MANAGER','RECEPTIONIST','TRAINER'],
 schedule_exceptions:['OWNER','MANAGER','RECEPTIONIST','TRAINER']};
function text(value:string,min:number,max:number,code:string){const s=value.trim();if(s.length<min||s.length>max)throw new ProblemException(422,code);return s;}
function view(table:CatalogTable,r:Raw):Record<string,unknown>{
 switch(table){
  case 'branches':return {id:r.id,tenantId:r.tenant_id,name:r.name,address:r.address??null,active:r.active};
  case 'services':return {id:r.id,tenantId:r.tenant_id,title:r.title,durationMin:r.duration_min,active:r.active};
  case 'resources':return {id:r.id,tenantId:r.tenant_id,type:r.type,displayName:r.display_name,
     ...(r.type==='ROOM'?{branchId:r.branch_id}:{trainerUserId:r.trainer_user_id}),active:r.active,
     bufferBeforeMin:r.buffer_before_min,bufferAfterMin:r.buffer_after_min};
  case 'business_hours':return {id:r.id,isoWeekday:r.iso_weekday,startLocal:String(r.start_local).slice(0,5),
     endLocal:String(r.end_local).slice(0,5),endDayOffset:r.end_day_offset,branchId:r.branch_id??null,
     resourceId:r.resource_id??null,active:r.active};
  case 'schedule_exceptions':return {id:r.id,kind:r.kind,startAt:new Date(r.start_at as string).toISOString(),
     endAt:new Date(r.end_at as string).toISOString(),reason:r.reason,branchId:r.branch_id??null,
     resourceId:r.resource_id??null,active:r.active};
 }
}
function mapDatabaseError(err:unknown):never {
 if(err instanceof ProblemException)throw err;
 const state=pgCode(err);
 if(err instanceof UnknownCommitOutcome)throw err;
 if(state==='23505')throw new ProblemException(409,'UNIQUE_CONSTRAINT_CONFLICT');
 if(state==='23P01')throw new ProblemException(409,'SCHEDULE_EXCEPTION_CONFLICT');
 if(state==='23503')throw new ProblemException(409,'TENANT_REFERENCE_CONFLICT');
 if(state==='40P01'||state==='40001'||state==='55P03')throw new ProblemException(503,'TRANSACTION_RETRY_REQUIRED');
 if(state==='23514')throw new ProblemException(409,'INVALID_SCHEDULE_RULE');
 throw err;
}
function ensureScope(branch?:string,resource?:string){
 if((branch!==undefined)===(resource!==undefined))throw new ProblemException(422,'EXACTLY_ONE_SCHEDULE_SCOPE_REQUIRED');
}
function parseQueryInstant(raw:string):string {
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(raw)||!Number.isFinite(Date.parse(raw)))
  throw new ProblemException(400,'INVALID_TIME_FILTER');
 return new Date(raw).toISOString();
}
@Injectable()
export class CatalogService {
 constructor(private readonly db:DatabaseService,private readonly uow:UnitOfWork,
  private readonly auth:TenantAuthorizationService){}
 private async writer<T>(p:AuthenticatedPrincipal,orgId:string,run:(c:PoolClient)=>Promise<T>):Promise<T>{
  try {return await this.uow.run(async c=>{
    const lock=await c.query<{ok:boolean}>(`SELECT public.lock_bookcore_organization($1) AS ok`,[orgId]);
    if(!lock.rows[0]?.ok)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
    const role=await this.auth.forWrite(c,p,orgId,false);
    if(!writable.has(role))throw new ProblemException(403,'TENANT_ACCESS_DENIED');
    return run(c);
  },1);}catch(err){return mapDatabaseError(err);}
 }
 private async event(c:PoolClient,p:AuthenticatedPrincipal,orgId:string,id:string,type:string,kind:string,metadata:object={}){
  const payload=JSON.stringify(metadata);
  await c.query(`INSERT INTO audit_events(tenant_id,actor_id,action,aggregate_type,aggregate_id,metadata)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,[orgId,p.userId,type,kind,id,payload]);
  await c.query(`INSERT INTO outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload)
    VALUES($1,$2,$3,$4,$5::jsonb)`,[orgId,kind,id,type,payload]);
 }
 async createBranch(p:AuthenticatedPrincipal,orgId:string,dto:CreateBranchDto){
  const name=text(dto.name,2,120,'INVALID_BRANCH_NAME');
  const address=dto.address===undefined?null:text(dto.address,1,500,'INVALID_BRANCH_ADDRESS');
  return this.writer(p,orgId,async c=>{
   const row=await c.query<Raw>(`INSERT INTO branches(tenant_id,name,address) VALUES($1,$2,$3) RETURNING *`,[orgId,name,address]);
   const r=requireValue(row.rows[0]);await this.event(c,p,orgId,r.id as string,'BranchCreated','BRANCH');return view('branches',r);
  });
 }
 async createService(p:AuthenticatedPrincipal,orgId:string,dto:CreateServiceDto){
  const title=text(dto.title,2,160,'INVALID_SERVICE_TITLE');
  return this.writer(p,orgId,async c=>{
   const row=await c.query<Raw>(`INSERT INTO services(tenant_id,title,duration_min) VALUES($1,$2,$3) RETURNING *`,[orgId,title,dto.durationMin]);
   const r=requireValue(row.rows[0]);await this.event(c,p,orgId,r.id as string,'ServiceCreated','SERVICE');return view('services',r);
  });
 }
 async createResource(p:AuthenticatedPrincipal,orgId:string,dto:CreateResourceDto){
  const displayName=text(dto.displayName,2,160,'INVALID_RESOURCE_NAME');
  if((dto.type==='ROOM'&&(!dto.branchId||dto.trainerUserId!==undefined))||
    (dto.type==='TRAINER'&&(!dto.trainerUserId||dto.branchId!==undefined)))throw new ProblemException(422,'INVALID_RESOURCE_TYPE_FIELDS');
  return this.writer(p,orgId,async c=>{
   if(dto.type==='ROOM'){
    await this.lockActiveTarget(c,orgId,requireValue(dto.branchId),'branch');
   }else{
    const m=await c.query(`SELECT m.user_id FROM memberships m JOIN users u ON u.id=m.user_id
      WHERE m.tenant_id=$1 AND m.user_id=$2 AND m.role='TRAINER' AND m.status='ACTIVE'
      AND u.status='ACTIVE' FOR SHARE OF m`,[orgId,dto.trainerUserId]);
    if(!m.rows.length)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   }
   const row=await c.query<Raw>(`INSERT INTO resources
     (tenant_id,type,display_name,branch_id,trainer_user_id,buffer_before_min,buffer_after_min)
     VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[orgId,dto.type,displayName,dto.branchId??null,
      dto.trainerUserId??null,dto.bufferBeforeMin??0,dto.bufferAfterMin??0]);
   const r=requireValue(row.rows[0]);await this.event(c,p,orgId,r.id as string,'ResourceCreated','RESOURCE', {resourceType:dto.type});
   return view('resources',r);
  });
 }
 async lockActiveTarget(c:PoolClient,orgId:string,id:string,kind:'branch'|'service'|'resource'){
  const r=await c.query<{active:boolean}>('SELECT public.bookcore_share_active_catalog($1,$2,$3) AS active',[orgId,id,kind]);
  if(!r.rows[0]?.active)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
 }
 private async target(c:PoolClient,orgId:string,branch?:string,resource?:string){
  ensureScope(branch,resource);
  await this.lockActiveTarget(c,orgId,branch??requireValue(resource),branch?'branch':'resource');
 }
 async createHour(p:AuthenticatedPrincipal,orgId:string,dto:CreateBusinessHourDto){
  ensureScope(dto.branchId,dto.resourceId);
  const start=Number(dto.startLocal.slice(0,2))*60+Number(dto.startLocal.slice(3));
  const end=Number(dto.endLocal.slice(0,2))*60+Number(dto.endLocal.slice(3))+dto.endDayOffset*1440;
  if(end-start<1||end-start>1440)throw new ProblemException(422,'INVALID_WEEKLY_INTERVAL');
  return this.writer(p,orgId,async c=>{
   await this.target(c,orgId,dto.branchId,dto.resourceId);
   const rows=await c.query<Raw>(`INSERT INTO business_hours
    (tenant_id,branch_id,resource_id,iso_weekday,start_local,end_local,end_day_offset)
    VALUES ($1,$2,$3,$4,$5::time,$6::time,$7) RETURNING *`,
    [orgId,dto.branchId??null,dto.resourceId??null,dto.isoWeekday,dto.startLocal,dto.endLocal,dto.endDayOffset]);
   const r=requireValue(rows.rows[0]);await this.event(c,p,orgId,r.id as string,'BusinessHourCreated','BUSINESS_HOUR');return view('business_hours',r);
  });
 }
 async createException(p:AuthenticatedPrincipal,orgId:string,dto:CreateScheduleExceptionDto){
  ensureScope(dto.branchId,dto.resourceId);
  const reason=text(dto.reason,1,500,'INVALID_EXCEPTION_REASON');
  return this.writer(p,orgId,async c=>{
   await this.target(c,orgId,dto.branchId,dto.resourceId);
   const org=await c.query<{timezone:string}>(`SELECT timezone FROM organizations WHERE id=$1`,[orgId]);
   if(!org.rows[0])throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   let start:string,end:string;
   try {start=validateSchedulingInstant(dto.startAt,org.rows[0].timezone);
    end=validateSchedulingInstant(dto.endAt,org.rows[0].timezone);}
   catch {throw new ProblemException(422,'INVALID_TIMEZONE_OFFSET');}
   if(Date.parse(end)<=Date.parse(start)||Date.parse(end)-Date.parse(start)>31*86400000)
    throw new ProblemException(422,'INVALID_EXCEPTION_INTERVAL');
   const rows=await c.query<Raw>(`INSERT INTO schedule_exceptions
     (tenant_id,branch_id,resource_id,kind,start_at,end_at,reason,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[orgId,dto.branchId??null,
      dto.resourceId??null,dto.kind,start,end,reason,p.userId]);
   const r=requireValue(rows.rows[0]);await this.event(c,p,orgId,r.id as string,'ScheduleExceptionCreated','SCHEDULE_EXCEPTION',{kind:dto.kind});
   return view('schedule_exceptions',r);
  });
 }
 async deactivate(p:AuthenticatedPrincipal,orgId:string,table:'business_hours'|'schedule_exceptions',id:string,dto:DeactivateRuleDto){
  if(dto.active!==false)throw new ProblemException(422,'DEACTIVATE_ONLY');
  // table is a closed internal enum, never constructed from HTTP input.
  return this.writer(p,orgId,async c=>{
   const row=await c.query<Raw>(`SELECT * FROM ${table} WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[orgId,id]);
   if(!row.rows[0])throw new ProblemException(404,'RESOURCE_NOT_FOUND');
   if(row.rows[0].active!==true)throw new ProblemException(409,'RULE_ALREADY_INACTIVE');
   const changed=await c.query<Raw>(`UPDATE ${table} SET active=false WHERE tenant_id=$1 AND id=$2 RETURNING *`,[orgId,id]);
   await this.event(c,p,orgId,id,table==='business_hours'?'BusinessHourDeactivated':'ScheduleExceptionDeactivated',
    table==='business_hours'?'BUSINESS_HOUR':'SCHEDULE_EXCEPTION');
   return view(table,requireValue(changed.rows[0]));
  });
 }
 /** Internal Phase06 seam: caller passes an authorized transaction client.
  * A rule-layer AVAILABLE result is NOT a final capacity or conflict guarantee.
  */
 async evaluateInTransaction(c:PoolClient,orgId:string,branchId:string,
  resourceId:string|null,startAt:string,endAt:string,trustedPersistedUtc=false):Promise<AvailabilityResult>{
  const org=await c.query<{timezone:string;status:string}>(`SELECT timezone,status FROM organizations WHERE id=$1`,[orgId]);
  const timezone=org.rows[0]?.timezone;
  if(!timezone)throw new ProblemException(404,'RESOURCE_NOT_FOUND');
  let start:string,end:string;
  try {start=trustedPersistedUtc?new Date(parseQueryInstant(startAt)).toISOString():validateSchedulingInstant(startAt,timezone);
    end=trustedPersistedUtc?new Date(parseQueryInstant(endAt)).toISOString():validateSchedulingInstant(endAt,timezone);}
  catch{return {code:'INVALID_TIME_INTERVAL',available:false,capacityChecked:false,resourceConflictChecked:false};}
  const branch=await c.query<{active:boolean}>(`SELECT active FROM branches WHERE tenant_id=$1 AND id=$2`,[orgId,branchId]);
  if(!branch.rows[0])throw new ProblemException(404,'RESOURCE_NOT_FOUND');
  const resource=resourceId?await c.query<{active:boolean;type:string;branch_id:string|null;buffer_before_min:number;buffer_after_min:number}>(
   `SELECT active,type,branch_id,buffer_before_min,buffer_after_min FROM resources WHERE tenant_id=$1 AND id=$2`,[orgId,resourceId]):null;
  if(resourceId&&!resource?.rows[0])throw new ProblemException(404,'RESOURCE_NOT_FOUND');
  const r=resource?.rows[0];
  if(r?.type==='ROOM'&&r.branch_id!==branchId)return {code:'RESOURCE_UNAVAILABLE',available:false,capacityChecked:false,resourceConflictChecked:false};
  const hours=await c.query<{branch_id:string|null;resource_id:string|null;iso_weekday:number;start_local:string;end_local:string;end_day_offset:0|1;active:boolean}>(
   `SELECT branch_id,resource_id,iso_weekday,to_char(start_local,'HH24:MI') AS start_local,
      to_char(end_local,'HH24:MI') AS end_local,end_day_offset,active FROM business_hours
      WHERE tenant_id=$1 AND active AND (branch_id=$2 OR ($3::uuid IS NOT NULL AND resource_id=$3))`,[orgId,branchId,resourceId]);
  const before=r?.buffer_before_min??0,after=r?.buffer_after_min??0;
  const exceptions=await c.query<{branch_id:string|null;resource_id:string|null;kind:'CLOSED'|'OPEN_OVERRIDE';start_at:Date;end_at:Date;active:boolean}>(
   `SELECT branch_id,resource_id,kind,start_at,end_at,active FROM schedule_exceptions
      WHERE tenant_id=$1 AND active AND (branch_id=$2 OR ($3::uuid IS NOT NULL AND resource_id=$3))
        AND start_at < $4::timestamptz AND end_at > $5::timestamptz`,
    [orgId,branchId,resourceId,new Date(Date.parse(end)+after*60000),new Date(Date.parse(start)-before*60000)]);
  return evaluateAvailability({timezone,startAt:start,endAt:end,branchId,resourceId:resourceId??undefined,
   organizationActive:org.rows[0]?.status==='ACTIVE'&&branch.rows[0].active,
   resourceActive:r?.active,bufferBeforeMin:before,bufferAfterMin:after,
   hours:hours.rows.map(h=>({branchId:h.branch_id,resourceId:h.resource_id,isoWeekday:h.iso_weekday,
     startLocal:h.start_local,endLocal:h.end_local,endDayOffset:h.end_day_offset,active:h.active} satisfies HourRule)),
   exceptions:exceptions.rows.map(e=>({branchId:e.branch_id,resourceId:e.resource_id,kind:e.kind,
     startAt:e.start_at.toISOString(),endAt:e.end_at.toISOString(),active:e.active} satisfies ExceptionRule))});
 }
 async list(p:AuthenticatedPrincipal,orgId:string,table:CatalogTable,page:Page,filters?:{from?:string;to?:string}){
  // Role decision must be reflected in the final SELECT, not just a stale precheck.
  const currentRole=await this.auth.forRead(p,orgId,false);
  if(!readRoles[table].includes(currentRole))throw new ProblemException(403,'TENANT_ACCESS_DENIED');
  let from:string|undefined,to:string|undefined;
  if(table==='schedule_exceptions'){
   if(filters?.from)from=parseQueryInstant(filters.from);
   if(filters?.to)to=parseQueryInstant(filters.to);
   if((from&&!to)||(!from&&to))throw new ProblemException(400,'REQUIRED_TIME_WINDOW');
   if(from&&to&&(Date.parse(to)<=Date.parse(from)||Date.parse(to)-Date.parse(from)>31*86400000))
     throw new ProblemException(400,'INVALID_TIME_WINDOW');
  }
  const c=await this.db.connect();
  try {
   // Resource IDs/names are staff-private. TRAINER role is not allowed to enumerate Resources.
   // For weekly schedules trainers receive only rules targeting their own trainer resource.
   const extra=(table==='business_hours'||table==='schedule_exceptions')?
    `AND (actor.role<>'TRAINER' OR (t.branch_id IS NULL AND EXISTS(SELECT 1 FROM resources r
       WHERE r.tenant_id=t.tenant_id AND r.id=t.resource_id AND r.type='TRAINER'
          AND r.trainer_user_id=$4 AND r.active)))`:'';
   const range=from&&to?'AND t.start_at < $6::timestamptz AND t.end_at > $7::timestamptz':'';
   const values=[orgId,page.cursor,page.limit+1,p.userId,readRoles[table]];
   if(from&&to)values.push(from,to);
   const rows=await c.query<Raw>(`SELECT t.* FROM ${table} t
     WHERE t.tenant_id=$1 AND ($2::uuid IS NULL OR t.id>$2::uuid)
      ${range}
      AND EXISTS(SELECT 1 FROM memberships actor JOIN organizations org ON org.id=actor.tenant_id
       WHERE actor.tenant_id=t.tenant_id AND actor.user_id=$4 AND actor.status='ACTIVE'
       AND org.status='ACTIVE' AND actor.role=ANY($5::text[]) ${extra})
     ORDER BY t.id LIMIT $3`,values);
   const items=rows.rows.slice(0,page.limit).map(r=>view(table,r));
   const hasMore=rows.rows.length>page.limit;
   return {items,page:{nextCursor:hasMore?String(rows.rows[page.limit-1]?.id??''):null,hasMore}};
  } finally{c.release();}
 }
}
