/** Pure, constraint-aware mapping; never reveal raw SQL or the constraint identifier in HTTP. */
export function bookingPgError(err:unknown):{status:number;code:string}|null {
 const e=err as {code?:unknown;constraint?:unknown}|null;
 if(!e||typeof e.code!=='string')return null;
 switch(e.code){
  case '23505': return {status:409,code:e.constraint==='unique_effective_booking'?'BOOKING_ALREADY_EXISTS':'DATABASE_CONSTRAINT_CONFLICT'};
  case '23503': return {status:404,code:'RESOURCE_NOT_FOUND'};
  case '23514': return {status:409,code:'DATABASE_INVARIANT_VIOLATION'};
  case '23P01': return {status:409,code:'RESOURCE_CONFLICT'};
  case '40P01':case '40001':case '55P03':case '57014':return {status:503,code:'TRANSACTION_RETRY_REQUIRED'};
  default:return null;
 }
}
