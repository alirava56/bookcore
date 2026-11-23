import {createHmac,timingSafeEqual} from 'node:crypto';
/** Pure booking invariants. Database row locks/constraints enforce these at commit. */
export type BookingStatus='CONFIRMED'|'CANCELLED'|'ATTENDED'|'NO_SHOW';
export type BookingTransition=Exclude<BookingStatus,'CONFIRMED'>;
export const isEffective=(status:BookingStatus):boolean=>status!=='CANCELLED';
export function canTransitionBooking(from:BookingStatus,to:BookingTransition):boolean {
 return from==='CONFIRMED' && (to==='CANCELLED'||to==='ATTENDED'||to==='NO_SHOW');
}
export function canBook(sessionStatus:string,startMs:number,nowMs:number,seats:number,total:number,cutoffMin:number):string|null {
 if(sessionStatus!=='PUBLISHED'||!Number.isFinite(startMs)||nowMs>=startMs ||
    startMs-nowMs < cutoffMin*60000)return 'SESSION_NOT_BOOKABLE';
 if(!Number.isSafeInteger(seats)||!Number.isSafeInteger(total)||seats<0||total<1||seats>total)
   return 'DATABASE_INVARIANT_VIOLATION';
 return seats>=total?'SESSION_FULL':null;
}
/** Duplicate effective booking takes precedence over a full session only after a row-locked read. */
export function bookingRejection(capacityCode:string|null,alreadyBooked:boolean):string|null {
 return alreadyBooked?'BOOKING_ALREADY_EXISTS':capacityCode;
}
export function canCancelBooking(status:BookingStatus,sessionStatus:string,startMs:number,nowMs:number,
    cutoffMin:number,administrative:boolean):boolean {
 return status==='CONFIRMED' && sessionStatus==='PUBLISHED' && nowMs<startMs &&
    (administrative || startMs-nowMs>=cutoffMin*60000);
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// PostgreSQL has microsecond precision; JavaScript Date/toISOString() must NEVER round the cursor.
const PG_UTC=/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{6}Z$/;
const RFC3339=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/;
function instant(raw:string):string {
 if(!RFC3339.test(raw)||!Number.isFinite(Date.parse(raw)))throw new Error('INVALID_TIME_FILTER');
 return new Date(raw).toISOString();
}
function validCursorTime(at:string):boolean {
 return PG_UTC.test(at) && Number.isFinite(Date.parse(at)) &&
  new Date(at).toISOString().slice(0,19)===at.slice(0,19);
}
function pageMac(body:string,secret:string,scope:string):string {
 return createHmac('sha256',secret).update('BOOKCORE_BOOKING_CURSOR_V1\0'+scope+'\0'+body).digest('base64url');
}
export function encodeBookingCursor(at:string,id:string,secret:string,scope:string):string {
 if(!validCursorTime(at)||!UUID.test(id)||!secret||!scope)throw new Error('INVALID_CURSOR');
 const body=Buffer.from(JSON.stringify({v:1,at,id:id.toLowerCase()})).toString('base64url');
 return body+'.'+pageMac(body,secret,scope);
}
export function parseBookingPage(input:{from?:string;to?:string;cursor?:string;limit?:string},
 secret:string,scope:string,now=Date.now()) {
 const from=input.from?instant(input.from):new Date(now-31*86400000).toISOString();
 const to=input.to?instant(input.to):new Date(now+86400000).toISOString();
 if(Date.parse(to)<=Date.parse(from)||Date.parse(to)-Date.parse(from)>365*86400000)
  throw new Error('INVALID_TIME_WINDOW');
 const limit=input.limit===undefined?25:Number(input.limit);
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('INVALID_PAGE_LIMIT');
 let at:string|null=null,id:string|null=null;
 if(input.cursor!==undefined){
  try {
   if(!secret||!scope||input.cursor.length>512||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]{43}$/.test(input.cursor))throw new Error();
   const [body,mac]=input.cursor.split('.');
   if(!body||!mac)throw new Error();
   const expected=Buffer.from(pageMac(body,secret,scope));const actual=Buffer.from(mac);
   if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error();
   const raw=Buffer.from(body,'base64url').toString('utf8');
   if(Buffer.from(raw).toString('base64url')!==body)throw new Error();
   const value=JSON.parse(raw) as {v?:number;at?:string;id?:string};
   if(!value||Object.keys(value).sort().join(',')!=='at,id,v'||value.v!==1||
      typeof value.at!=='string'||!validCursorTime(value.at)||
      typeof value.id!=='string'||!UUID.test(value.id)||value.id!==value.id.toLowerCase())throw new Error();
   at=value.at;id=value.id;
   const lower=from.slice(0,23)+'000Z';
   const upper=to.slice(0,23)+'000Z';
   if(at<lower||at>=upper)throw new Error();
  }catch{throw new Error('INVALID_CURSOR');}
 }
 return {from,to,limit,at,id};
}

/** Stable JSON fingerprint independent of object property insertion order. */
export function canonicalRequest(value:unknown):string {
 const normalize=(item:unknown):unknown=>{
  if(Array.isArray(item))return item.map(normalize);
  if(item!==null&&typeof item==='object'){
   const obj=item as Record<string,unknown>,ordered:Record<string,unknown>={};
   for(const key of Object.keys(obj).sort()){
    if(obj[key]!==undefined)ordered[key]=normalize(obj[key]);
   }
   return ordered;
  }
  return item;
 };
 return JSON.stringify(normalize(value)) ?? 'null';
}
