/** Pure checks: database clock and authoritative row locking are applied in the service. */
export type SessionStatus='DRAFT'|'PUBLISHED'|'CANCELLED'|'FINISHED';
export type SessionTransition='PUBLISHED'|'CANCELLED'|'FINISHED';
export function canTransition(from:SessionStatus,to:SessionTransition):boolean {
 return (from==='DRAFT'&&(to==='PUBLISHED'||to==='CANCELLED')) ||
   (from==='PUBLISHED'&&(to==='CANCELLED'||to==='FINISHED'));
}
export function validCapacity(total:number,committed:number):boolean {
 return Number.isSafeInteger(total) && total>=1 && total<=1000 &&
   Number.isSafeInteger(committed) && committed>=0 && committed<=total;
}
export function boundedInterval(start:number,end:number,now:number):boolean {
 return Number.isFinite(start)&&Number.isFinite(end)&&start>now&&end>start&&end-start<=86400000;
}
export function bufferedInterval(start:string,end:string,before:number,after:number){
 if(![before,after].every(n=>Number.isInteger(n)&&n>=0&&n<=240))throw new Error('INVALID_RESOURCE_BUFFER');
 return {startAt:new Date(Date.parse(start)-before*60000).toISOString(),
  endAt:new Date(Date.parse(end)+after*60000).toISOString()};
}
export interface SessionPage {from:string;to:string;limit:number;cursorStart:string|null;cursorId:string|null}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseSessionPage(from?:string,to?:string,rawLimit?:string,rawCursor?:string,now=Date.now()):SessionPage {
 const start=from===undefined?new Date(now).toISOString():parseQueryInstant(from);
 const end=to===undefined?new Date(Date.parse(start)+31*86400000).toISOString():parseQueryInstant(to);
 if(Date.parse(end)<=Date.parse(start)||Date.parse(end)-Date.parse(start)>31*86400000)throw new Error('INVALID_TIME_WINDOW');
 const limit=rawLimit===undefined?25:Number(rawLimit);
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('INVALID_PAGE_LIMIT');
 let cursorStart:string|null=null,cursorId:string|null=null;
 if(rawCursor!==undefined){
  try {if(rawCursor.length>256||!/^[A-Za-z0-9_-]+$/.test(rawCursor))throw new Error();
   const parsed=JSON.parse(Buffer.from(rawCursor,'base64url').toString('utf8')) as {start:string;id:string};
   if(!UUID.test(parsed.id))throw new Error();cursorStart=parseQueryInstant(parsed.start);cursorId=parsed.id;
   if(Date.parse(cursorStart)<Date.parse(start)||Date.parse(cursorStart)>=Date.parse(end))throw new Error();
  }catch{throw new Error('INVALID_CURSOR');}
 }
 return {from:start,to:end,limit,cursorStart,cursorId};
}
export function encodeSessionCursor(start:string,id:string):string {
 return Buffer.from(JSON.stringify({start:new Date(start).toISOString(),id})).toString('base64url');
}
export function parseQueryInstant(value:string):string {
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/.test(value))throw new Error('INVALID_TIME_FILTER');
 const n=Date.parse(value);if(!Number.isFinite(n))throw new Error('INVALID_TIME_FILTER');
 return new Date(n).toISOString();
}
