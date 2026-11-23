import {requireValue} from '../../common/require-value';
/** Enumerated from actual Phase 08 producers. Historical v1 minimal payloads are intentional. */
export const EVENT_AGGREGATES:Readonly<Record<string,string>>={
 BookingConfirmed:'BOOKING',BookingCancelled:'BOOKING',BookingAttendanceRecorded:'BOOKING',
 SessionDraftCreated:'SESSION',SessionPublished:'SESSION',SessionFinished:'SESSION',
 SessionCapacityChanged:'SESSION',SessionCancelled:'SESSION',
 OrganizationCreated:'ORGANIZATION',MemberAdded:'MEMBERSHIP',MembershipChanged:'MEMBERSHIP',
 BranchCreated:'BRANCH',ServiceCreated:'SERVICE',ResourceCreated:'RESOURCE',
 BusinessHourCreated:'BUSINESS_HOUR',BusinessHourDeactivated:'BUSINESS_HOUR',
 ScheduleExceptionCreated:'SCHEDULE_EXCEPTION',ScheduleExceptionDeactivated:'SCHEDULE_EXCEPTION',
 StaffInvitationCreated:'STAFF_INVITATION',StaffInvitationAccepted:'STAFF_INVITATION',
 StaffInvitationRevoked:'STAFF_INVITATION',StaffInvitationDeclined:'STAFF_INVITATION',
 BookingConsentGranted:'BOOKING_CONSENT',BookingConsentRevoked:'BOOKING_CONSENT'
};
export type EventEnvelope={id:string;tenant_id:string;aggregate_type:string;aggregate_id:string;
 event_type:string;payload:unknown;schema_version:number;attempts:number};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class PermanentOutboxError extends Error {constructor(public readonly errorCode:string){super(errorCode);}}
type Field='uuid'|'string'|'int'|'status'|'role'|'resourceType'|'exceptionKind';
type Contract={required?:Record<string,Field>;optional?:Record<string,Field>};
const empty:Contract={};
const booking:Contract={required:{bookingId:'uuid',status:'status'}};
/** Explicit v1 compatibility: `{}` for sources which emit no metadata, no invented mandatory fields. */
export const V1_PAYLOADS:Readonly<Record<string,Contract>>={
 BookingConfirmed:booking,BookingCancelled:booking,BookingAttendanceRecorded:booking,
 SessionDraftCreated:empty,SessionPublished:empty,SessionFinished:empty,
 SessionCapacityChanged:{required:{old:'int',new:'int'}},
 SessionCancelled:{required:{reason:'string',cancelledBookings:'int'}},
 OrganizationCreated:empty,MemberAdded:{required:{role:'role'}},
 MembershipChanged:{required:{oldStatus:'string',newStatus:'string',oldRole:'role',newRole:'role'}},
 BranchCreated:empty,ServiceCreated:empty,ResourceCreated:{required:{resourceType:'resourceType'}},
 BusinessHourCreated:empty,BusinessHourDeactivated:empty,
 ScheduleExceptionCreated:{required:{kind:'exceptionKind'}},ScheduleExceptionDeactivated:empty,
 StaffInvitationCreated:{required:{inviteeId:'uuid',role:'role'}},
 StaffInvitationAccepted:{required:{inviteeId:'uuid',role:'role'}},
 StaffInvitationRevoked:{required:{inviteeId:'uuid'}},
 StaffInvitationDeclined:{required:{inviteeId:'uuid'}},
 BookingConsentGranted:{required:{customerId:'uuid'}},BookingConsentRevoked:{required:{customerId:'uuid'}}
};
function fail():never{throw new PermanentOutboxError('EVENT_PAYLOAD_INVALID');}
function valid(field:Field,value:unknown):boolean{
 switch(field){
  case 'uuid':return typeof value==='string'&&UUID.test(value);
  case 'int':return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
  case 'string':return typeof value==='string'&&value.trim().length>0&&value.length<=500;
  case 'status':return typeof value==='string'&&['CONFIRMED','CANCELLED','ATTENDED','NO_SHOW'].includes(value);
  case 'role':return typeof value==='string'&&['OWNER','MANAGER','RECEPTIONIST','TRAINER'].includes(value);
  case 'resourceType':return value==='TRAINER'||value==='ROOM';
  case 'exceptionKind':return value==='OPEN_OVERRIDE'||value==='CLOSED';
 }
}
export function validateEvent(row:EventEnvelope):{sessionId:string}|undefined{
 if(!UUID.test(row.id)||!UUID.test(row.tenant_id)||!UUID.test(row.aggregate_id)||
  !Object.hasOwn(EVENT_AGGREGATES,row.event_type)||EVENT_AGGREGATES[row.event_type]!==row.aggregate_type||
  row.schema_version!==1)throw new PermanentOutboxError('EVENT_CONTRACT_UNSUPPORTED');
 const payload=row.payload;
 if(!payload||Array.isArray(payload)||typeof payload!=='object')fail();
 let serialized:string;
 try{serialized=JSON.stringify(payload);}catch{fail();}
 if(!serialized||Buffer.byteLength(serialized,'utf8')>16384)throw new PermanentOutboxError('EVENT_PAYLOAD_OVERSIZED');
 function inspect(obj:unknown,depth:number):void{
  if(depth>5)throw new PermanentOutboxError('EVENT_PAYLOAD_NESTING');
  if(Array.isArray(obj)){if(obj.length>32)fail();for(const v of obj)inspect(v,depth+1);return;}
  if(obj&&typeof obj==='object')for(const [k,v] of Object.entries(obj)){
   if(/password|token|secret|authorization|credential|private.?key|jwt|cookie/i.test(k))
    throw new PermanentOutboxError('EVENT_SENSITIVE_FIELD');
   if(k.length>80)fail();inspect(v,depth+1);
  }
 }
 inspect(payload,0);
 const p=payload as Record<string,unknown>;
 // Legacy Phase 02 test-harness emits `{id:aggregateId}`. Do not accept it for new application events.
 const legacy=p.id===row.aggregate_id&&Object.keys(p).length===1;
 if(legacy&&row.event_type==='BookingConfirmed')return;
 // Session cancellation creates BookingCancelled with a session reference rather than bookingId.
 if(row.event_type==='BookingCancelled'&&Object.keys(p).sort().join(',')==='reason,sessionId' &&
   typeof p.sessionId==='string'&&valid('uuid',p.sessionId)&&valid('string',p.reason))return {sessionId:p.sessionId};
 // A versioned but historical BookingAttendanceRecorded uses ATTENDED or NO_SHOW.
 const contract=V1_PAYLOADS[row.event_type];if(!contract)fail();
 const allowed={...contract.required,...contract.optional};
 for(const [key,field] of Object.entries(contract.required??{}))if(!valid(field,p[key]))fail();
 for(const [key,value] of Object.entries(p))if(!Object.hasOwn(allowed,key)||!valid(requireValue(allowed[key]),value))fail();
 if('bookingId' in p && p.bookingId!==row.aggregate_id)fail();
 if('id' in p && p.id!==row.aggregate_id)fail();
 const exact:Record<string,string>={BookingConfirmed:'CONFIRMED',BookingCancelled:'CANCELLED'};
 if(Object.hasOwn(exact,row.event_type)&&p.status!==exact[row.event_type])fail();
 if(row.event_type==='BookingAttendanceRecorded'&&!['ATTENDED','NO_SHOW'].includes(p.status as string))fail();
}
export function retryDelayMs(attempts:number,random=0):number{
 if(!Number.isInteger(attempts)||attempts<1)throw new Error('INVALID_ATTEMPT');
 return Math.min(300000,1000*2**Math.min(attempts-1,10))+Math.floor(Math.max(0,Math.min(random,1))*250);
}
export function failureCode(err:unknown):string{
 if(err instanceof PermanentOutboxError)return err.errorCode;
 const code=(err as {code?:unknown}|null)?.code;
 if(code==='40P01'||code==='40001'||code==='55P03'||code==='57014')return 'RETRYABLE_DATABASE_CONFLICT';
 return 'HANDLER_TRANSIENT_FAILURE';
}
/** Static table identifiers only; untrusted event fields never become SQL identifiers. */
export const AGGREGATE_TABLES:Readonly<Record<string,string>>={
 BOOKING:'bookings',SESSION:'sessions',ORGANIZATION:'organizations',MEMBERSHIP:'memberships',
 BRANCH:'branches',SERVICE:'services',RESOURCE:'resources',BUSINESS_HOUR:'business_hours',
 SCHEDULE_EXCEPTION:'schedule_exceptions',STAFF_INVITATION:'staff_invitations',BOOKING_CONSENT:'booking_consents'
};
