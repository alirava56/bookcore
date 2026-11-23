/** Operational policy: inspect first; no domain repair through this module. */
export const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type OperationalFindingCode =
 'COUNTER_DRIFT'|'CAPACITY_BOUNDS'|'CANCELLED_COMMITMENT'|'CANCELLED_ALLOCATION'|
 'BOOKING_EVENT_CHAIN'|'BOOKING_LAST_STATE'|'OUTBOX_PROJECTION_DRIFT'|
 'OUTBOX_STALE_LEASE'|'CONSENT_EXPIRED'|'INVITATION_EXPIRED';
export interface Finding {code:OperationalFindingCode;subjectId:string;observed:string;expected:string;
 classification:'INTEGRITY'|'LIFECYCLE'|'OPERATIONAL';repair:'MANUAL_ONLY'|'NONE'}
export function validateScope(tenant:string,limit:number):void {
 if(!UUID_PATTERN.test(tenant))throw new Error('TENANT_UUID_REQUIRED');
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('BOUNDED_LIMIT_REQUIRED');
}
export function classifyCapacity(id:string,committed:number,capacity:number,effective:number):Finding[] {
 const findings:Finding[]=[];
 if(committed<0||committed>capacity)findings.push({code:'CAPACITY_BOUNDS',subjectId:id,
  observed:String(committed),expected:`0..${capacity}`,classification:'INTEGRITY',repair:'MANUAL_ONLY'});
 if(committed!==effective)findings.push({code:'COUNTER_DRIFT',subjectId:id,
  observed:String(committed),expected:String(effective),classification:'INTEGRITY',repair:'MANUAL_ONLY'});
 return findings;
}
export const RATE_BUCKET_MIN_AGE_HOURS=48;
export const RATE_BUCKET_BATCH_MAX=100;
/** No deletion of FINAL or PROCESSING idempotency records is authorized in Phase 10. */
export const IDEMPOTENCY_PURGE_ALLOWED=false;
export function validateMaintenance(limit:number,ageHours:number):void {
 if(!Number.isInteger(limit)||limit<1||limit>RATE_BUCKET_BATCH_MAX)throw new Error('INVALID_BATCH_SIZE');
 if(!Number.isInteger(ageHours)||ageHours<RATE_BUCKET_MIN_AGE_HOURS||ageHours>8760)
  throw new Error('RETENTION_BELOW_MINIMUM');
}
export function requireReason(input:string|undefined):string {
 if(!input||input.trim().length<10||input.length>500)throw new Error('OPERATION_REASON_REQUIRED');
 return input.trim();
}
