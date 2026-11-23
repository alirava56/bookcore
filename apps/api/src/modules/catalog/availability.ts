import {requireValue} from '../../common/require-value';
/** Pure rule evaluator. No SQL, authorization or capacity decisions occur here. */
export type AvailabilityCode='AVAILABLE'|'INVALID_TIME_INTERVAL'|'OUTSIDE_BUSINESS_HOURS'|'BRANCH_CLOSED'|'RESOURCE_UNAVAILABLE'|'SCHEDULE_EXCEPTION_CONFLICT';
export interface HourRule {isoWeekday:number;startLocal:string;endLocal:string;endDayOffset:0|1;active:boolean;branchId:string|null;resourceId:string|null}
export interface ExceptionRule {kind:'CLOSED'|'OPEN_OVERRIDE';startAt:string;endAt:string;active:boolean;branchId:string|null;resourceId:string|null}
export interface Interval {start:number;end:number}
export interface AvailabilityRequest {
 timezone:string;startAt:string;endAt:string;branchId:string;resourceId?:string;
 organizationActive:boolean;resourceActive?:boolean;bufferBeforeMin?:number;bufferAfterMin?:number;
 hours:HourRule[];exceptions:ExceptionRule[];
}
export interface AvailabilityResult {code:AvailabilityCode;available:boolean;capacityChecked:false;resourceConflictChecked:false}
const result=(code:AvailabilityCode):AvailabilityResult=>({code,available:code==='AVAILABLE',capacityChecked:false,resourceConflictChecked:false});
const formatterCache=new Map<string,Intl.DateTimeFormat>();
function localParts(epoch:number,timezone:string){
 let fmt=formatterCache.get(timezone);
 if(!fmt){fmt=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,calendar:'gregory',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});formatterCache.set(timezone,fmt);}
 const parts=Object.fromEntries(fmt.formatToParts(epoch).filter(x=>x.type!=='literal').map(p=>[p.type,Number(p.value)]));
 return {year:requireValue(parts.year),month:requireValue(parts.month),day:requireValue(parts.day),hour:requireValue(parts.hour),minute:requireValue(parts.minute),second:requireValue(parts.second)};
}
function zoneOffsetMin(epoch:number,timezone:string):number{
 const p=localParts(epoch,timezone);
 return Math.round((Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-Math.floor(epoch/1000)*1000)/60000);
}
function equalLocal(a:ReturnType<typeof localParts>,b:ReturnType<typeof localParts>):boolean {
 return a.year===b.year && a.month===b.month && a.day===b.day && a.hour===b.hour && a.minute===b.minute;
}
/** Reject nonexistent or ambiguous local weekly boundaries; never pick one DST fold silently. */
export function localBoundaryToInstant(date:{year:number;month:number;day:number},hhmm:string,timezone:string):number|null {
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm))return null;
 const [hour,minute]=hhmm.split(':').map(Number);
 const target={...date,hour:requireValue(hour),minute:requireValue(minute),second:0};
 const naive=Date.UTC(date.year,date.month-1,date.day,hour,minute);
 const offsets=new Set([-36,0,36].map(h=>zoneOffsetMin(naive+h*3600000,timezone)));
 const candidates=[...offsets].map(o=>naive-o*60000).filter(i=>equalLocal(localParts(i,timezone),target));
 return new Set(candidates).size===1?requireValue(candidates[0]):null;
}
/** Strict input offset matching for tenant-local scheduling inputs. Query instants use a different policy. */
export function validateSchedulingInstant(input:string,timezone:string):string {
 const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/.exec(input);
 if(!m)throw new Error('INVALID_RFC3339_OFFSET');
 const parsed=Date.parse(input);if(!Number.isFinite(parsed))throw new Error('INVALID_INSTANT');
 const offset=m[7]==='Z'?0:(requireValue(m[7])[0]==='-'?-1:1)*(Number(requireValue(m[7]).slice(1,3))*60+Number(requireValue(m[7]).slice(4,6)));
 if(Math.abs(offset)>14*60 || zoneOffsetMin(parsed,timezone)!==offset)throw new Error('TIMEZONE_OFFSET_MISMATCH');
 const p=localParts(parsed,timezone);
 if(p.year!==Number(m[1])||p.month!==Number(m[2])||p.day!==Number(m[3])||p.hour!==Number(m[4])||p.minute!==Number(m[5])||p.second!==Number(m[6]))throw new Error('INVALID_LOCAL_TIME');
 return new Date(parsed).toISOString();
}
const overlap=(a:Interval,b:Interval)=>a.start<b.end && b.start<a.end;
function covered(target:Interval,ranges:Interval[]):boolean {
 const sorted=ranges.filter(r=>r.end>target.start && r.start<target.end).sort((a,b)=>a.start-b.start);
 let end=target.start;
 for(const r of sorted){if(r.start>end)return false;end=Math.max(end,r.end);if(end>=target.end)return true;}
 return false;
}
function addDays(date:{year:number;month:number;day:number},days:number){
 const d=new Date(Date.UTC(date.year,date.month-1,date.day+days));
 return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};
}
function ruleWindows(target:Interval,timezone:string,hours:HourRule[]):{ranges:Interval[];invalidBoundary:boolean}{
 const first=localParts(target.start,timezone),last=localParts(target.end-1,timezone);
 const from=Date.UTC(first.year,first.month-1,first.day),to=Date.UTC(last.year,last.month-1,last.day);
 if(to-from>3*86400000)return {ranges:[],invalidBoundary:true};
 const ranges:Interval[]=[];let invalidBoundary=false;
 for(let d=from-2*86400000;d<=to+86400000;d+=86400000){
  const current=new Date(d),date={year:current.getUTCFullYear(),month:current.getUTCMonth()+1,day:current.getUTCDate()};
  const weekday=current.getUTCDay()||7;
  for(const hour of hours.filter(h=>h.active&&h.isoWeekday===weekday)){
   const start=localBoundaryToInstant(date,hour.startLocal,timezone);
   const end=localBoundaryToInstant(addDays(date,hour.endDayOffset),hour.endLocal,timezone);
   if(start===null||end===null){if(d>=from-86400000&&d<=to)invalidBoundary=true;continue;}
   if(end>start)ranges.push({start,end});else invalidBoundary=true;
  }
 }
 return {ranges,invalidBoundary};
}
export function evaluateAvailability(req:AvailabilityRequest):AvailabilityResult {
 let zone:string;
 try {zone=new Intl.DateTimeFormat('en-US',{timeZone:req.timezone}).resolvedOptions().timeZone;}catch{return result('INVALID_TIME_INTERVAL');}
 const start=Date.parse(req.startAt),end=Date.parse(req.endAt);
 if(!/Z$|[+-]\d\d:\d\d$/.test(req.startAt)||!/Z$|[+-]\d\d:\d\d$/.test(req.endAt)||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000)return result('INVALID_TIME_INTERVAL');
 if(!req.organizationActive)return result('RESOURCE_UNAVAILABLE');
 const core={start,end};
 const resource={start:start-(req.bufferBeforeMin??0)*60000,end:end+(req.bufferAfterMin??0)*60000};
 if(req.resourceId && (req.resourceActive===false || !Number.isSafeInteger(req.bufferBeforeMin??0) || !Number.isSafeInteger(req.bufferAfterMin??0)
   || (req.bufferBeforeMin??0)<0||(req.bufferAfterMin??0)<0 || (req.bufferBeforeMin??0)>240||(req.bufferAfterMin??0)>240))return result('RESOURCE_UNAVAILABLE');
 const relevant=(scope:'branch'|'resource')=> req.exceptions.filter(e=>e.active&&(scope==='branch'?e.branchId===req.branchId:e.resourceId===req.resourceId && !!req.resourceId));
 function ruleCheck(scope:'branch'|'resource',interval:Interval):boolean|'invalid'|'closed' {
  const exceptions=relevant(scope);
  if(exceptions.some(e=>e.kind==='CLOSED'&&overlap({start:Date.parse(e.startAt),end:Date.parse(e.endAt)},interval)))return 'closed';
  const applicable=req.hours.filter(h=>h.active&&(scope==='branch'?h.branchId===req.branchId:!!req.resourceId&&h.resourceId===req.resourceId));
  const week=ruleWindows(interval,zone,applicable);
  const overrides=exceptions.filter(e=>e.kind==='OPEN_OVERRIDE').map(e=>({start:Date.parse(e.startAt),end:Date.parse(e.endAt)}));
  if(week.invalidBoundary)return 'invalid';
  return covered(interval,[...week.ranges,...overrides]);
 }
 const branch=ruleCheck('branch',core);
 if(branch==='closed')return result('BRANCH_CLOSED');
 if(branch==='invalid')return result('INVALID_TIME_INTERVAL');
 if(!branch)return result('OUTSIDE_BUSINESS_HOURS');
 if(req.resourceId){const r=ruleCheck('resource',resource);
  if(r==='closed')return result('RESOURCE_UNAVAILABLE');
  if(r==='invalid')return result('INVALID_TIME_INTERVAL');
  if(!r)return result('RESOURCE_UNAVAILABLE');
 }
 return result('AVAILABLE');
}
