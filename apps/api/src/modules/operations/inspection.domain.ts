import {requireValue} from '../../common/require-value';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {UUID_PATTERN} from './operations.domain';
export const INSPECTION_KINDS=['SESSION','BOOKING','OUTBOX','COUNTER','INVITATION','CONSENT'] as const;
export type InspectionKind=typeof INSPECTION_KINDS[number];
export type InspectionCursor={v:1;tenant:string;kind:InspectionKind;after:string;asOf:string};
export const MAX_INSPECTION_PAGES=200;
export const MAX_INSPECTION_WORKLOAD=20000;
export function validKind(value:string):value is InspectionKind{
 return (INSPECTION_KINDS as readonly string[]).includes(value);
}
export function validateInspectionOptions(kind:string,limit:number,pages:number,all:boolean):void {
 if(!validKind(kind))throw new Error('INSPECTION_KIND_INVALID');
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('INSPECTION_LIMIT_INVALID');
 if(!Number.isInteger(pages)||pages<1||pages>MAX_INSPECTION_PAGES)
  throw new Error('INSPECTION_PAGES_INVALID');
 if(limit*pages*(all?INSPECTION_KINDS.length:1)>MAX_INSPECTION_WORKLOAD)
  throw new Error('INSPECTION_WORKLOAD_UNBOUNDED');
}
function keyBytes(secret:string):Buffer{
 if(!/^[A-Za-z0-9_-]+$/.test(secret))throw new Error('INSPECTION_SIGNING_KEY_REQUIRED');
 const bytes=Buffer.from(secret,'base64url');
 if(bytes.length<32)throw new Error('INSPECTION_SIGNING_KEY_REQUIRED');
 return bytes;
}
function validInstant(text:string):boolean {
 // Protect the original PostgreSQL 6-digit fractional precision; never serialize via Date.toISOString().
 return /^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d(?::?\d\d)?)$/i.test(text)
  &&Number.isFinite(Date.parse(text));
}
function checkBody(c:InspectionCursor):void {
 if(c.v!==1||!UUID_PATTERN.test(c.tenant)||!validKind(c.kind)||!validInstant(c.asOf)||
  typeof c.after!=='string'||c.after.length>80||c.after.length===0||
  (c.kind!=='COUNTER'&&!UUID_PATTERN.test(c.after)))throw new Error('INSPECTION_CURSOR_INVALID');
}
export function sealInspectionCursor(c:InspectionCursor,secret:string):string {
 checkBody(c);
 const body=Buffer.from(JSON.stringify(c),'utf8').toString('base64url');
 const sig=createHmac('sha256',keyBytes(secret)).update(body).digest('base64url');
 return `${body}.${sig}`;
}
export function openInspectionCursor(token:string,secret:string,tenant:string,kind:InspectionKind):InspectionCursor {
 if(typeof token!=='string'||token.length>1024||token.length<20)throw new Error('INSPECTION_CURSOR_INVALID');
 const segments=token.split('.');if(segments.length!==2)throw new Error('INSPECTION_CURSOR_INVALID');
 const [body,signature]=segments as [string,string];
 if(!/^[A-Za-z0-9_-]+$/.test(body)||!/^[A-Za-z0-9_-]+$/.test(signature))
  throw new Error('INSPECTION_CURSOR_INVALID');
 const expected=createHmac('sha256',keyBytes(secret)).update(body).digest();
 const supplied=Buffer.from(signature,'base64url');
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))
  throw new Error('INSPECTION_CURSOR_INVALID');
 let data:unknown;
 try{data=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));}catch{throw new Error('INSPECTION_CURSOR_INVALID');}
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('INSPECTION_CURSOR_INVALID');
 const c=data as InspectionCursor;checkBody(c);
 if(c.tenant!==tenant||c.kind!==kind)throw new Error('INSPECTION_CURSOR_SCOPE_MISMATCH');
 return c;
}
export interface InspectionPage {
 tenantId:string;kind:InspectionKind;asOf:string;inspected:number;findings:Record<string,unknown>[];
 hasMore:boolean;nextAfter:string|null;kindCoverageComplete:boolean;consistentSnapshot:false;
 readOnly:true;repairPerformed:false;
}
export function validateInspectionPage(value:unknown,tenant:string,kind:InspectionKind,limit:number):InspectionPage{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INSPECTION_RESPONSE_INVALID');
 const p=value as InspectionPage;
 if(p.tenantId!==tenant||p.kind!==kind||!validInstant(p.asOf)||
  !Number.isInteger(p.inspected)||p.inspected<0||p.inspected>limit||
  !Array.isArray(p.findings)||typeof p.hasMore!=='boolean'||
  typeof p.kindCoverageComplete!=='boolean'||p.kindCoverageComplete===p.hasMore||
  p.consistentSnapshot!==false||p.readOnly!==true||p.repairPerformed!==false||
  (p.hasMore ? (typeof p.nextAfter!=='string'||p.inspected!==limit) : p.nextAfter!==null)||
  (typeof p.nextAfter==='string' && (kind==='COUNTER'?p.nextAfter.length>80:!UUID_PATTERN.test(p.nextAfter))))
  throw new Error('INSPECTION_RESPONSE_INVALID');
 return p;
}

/** Pure reference model for event-order chain diagnostics; PostgreSQL remains the authority. */
export type BookingHistoryStatus='CONFIRMED'|'CANCELLED'|'ATTENDED'|'NO_SHOW';
export type HistoryEvent={eventOrder:number;id:string;at:string;fromStatus:BookingHistoryStatus|null;
 toStatus:BookingHistoryStatus;reason:string|null};
export type HistoryDiagnostic='MISSING_INITIAL_EVENT'|'DUPLICATE_INITIAL_EVENT'|
 'INVALID_EVENT_TRANSITION'|'BOOKING_FINAL_STATE_MISMATCH';
export function inspectBookingHistory(status:BookingHistoryStatus,cancelReason:string|null,
 events:readonly HistoryEvent[]):HistoryDiagnostic[]{
 const ordered=[...events].sort((a,b)=>a.eventOrder-b.eventOrder);
 const findings=new Set<HistoryDiagnostic>();
 const initialCount=ordered.filter(e=>e.fromStatus===null&&e.toStatus==='CONFIRMED').length;
 if(initialCount===0)findings.add('MISSING_INITIAL_EVENT');
 else if(initialCount!==1)findings.add('DUPLICATE_INITIAL_EVENT');
 if(ordered.length>2)findings.add('INVALID_EVENT_TRANSITION');
 let last:BookingHistoryStatus|null=null;
 for(let i=0;i<ordered.length;i++){
  const e=requireValue(ordered[i]);
  if(!Number.isSafeInteger(e.eventOrder)||e.eventOrder<1||
   (i>0&&e.eventOrder===requireValue(ordered[i-1]).eventOrder))findings.add('INVALID_EVENT_TRANSITION');
  if(i===0){if(e.fromStatus!==null||e.toStatus!=='CONFIRMED'||e.reason!==null)
   findings.add('INVALID_EVENT_TRANSITION');}
  else if(last!=='CONFIRMED'||e.fromStatus!==last||
   !['CANCELLED','ATTENDED','NO_SHOW'].includes(e.toStatus)||
   (e.toStatus==='CANCELLED'&&e.reason!==cancelReason)||
   (e.toStatus!=='CANCELLED'&&e.reason!==null))findings.add('INVALID_EVENT_TRANSITION');
  last=e.toStatus;
 }
 if(last!==status||(status==='CONFIRMED'&&events.length!==1)||
  (status!=='CONFIRMED'&&events.length!==2))findings.add('BOOKING_FINAL_STATE_MISMATCH');
 return [...findings];
}

/** CLI completion means all *selected* kinds were traversed, not database certification. */
export function inspectionCompletion(selectedAll:boolean,incomplete:number,findings:number):{
 selectedScopeComplete:boolean;allSupportedKindsCovered:boolean;consistentSnapshot:false;
 certifiedIntegrity:false;exitCode:0|2|3}{
 const selectedScopeComplete=incomplete===0;
 return {selectedScopeComplete,allSupportedKindsCovered:selectedAll&&selectedScopeComplete,
  consistentSnapshot:false,certifiedIntegrity:false,exitCode:!selectedScopeComplete?3:findings>0?2:0};
}
