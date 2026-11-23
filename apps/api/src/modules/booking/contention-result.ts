/** Phase 14: only documented business rejection SESSION_FULL is a losing request. */
export type BookingAttemptResult = {status:number;body:Record<string,unknown>};
export type ContentionOutcome = {successful:number;businessRejected:number;statusDistribution:Record<string,number>};
export function verifyBookingContentionResults(responses:readonly BookingAttemptResult[],capacity:number):ContentionOutcome {
 if(!Number.isInteger(capacity)||capacity<1||capacity>100)throw Error('CONTENTION_CAPACITY_INVALID');
 if(responses.length!==100)throw Error('CONTENTION_REQUEST_COUNT_INVALID');
 let successful=0,businessRejected=0;const statusDistribution:Record<string,number>={};
 for(const [i,r] of responses.entries()){
  if(!r || !Number.isInteger(r.status) || !r.body || typeof r.body!=='object')
   throw Error('CONTENTION_MALFORMED_RESULT:'+i);
  const status=String(r.status);statusDistribution[status]=(statusDistribution[status]||0)+1;
  if(r.status===201){
   if(typeof r.body.id!=='string'||!r.body.id)throw Error('CONTENTION_SUCCESS_MISSING_BOOKING:'+i);
   successful++;continue;
  }
  if(r.status===409 && r.body.code==='SESSION_FULL'){businessRejected++;continue;}
  // Explicitly reject 5xx, 429, timeouts/transport failures (caller throws),
  // unknown 409, incorrect error codes, all other statuses and malformed results.
  throw Error('CONTENTION_UNEXPECTED_RESPONSE:'+i+':'+status+':'+String(r.body.code??'missing'));
 }
 if(successful!==capacity||businessRejected!==100-capacity)
  throw Error('CONTENTION_COMMITTED_RESPONSE_COUNT_MISMATCH');
 return {successful,businessRejected,statusDistribution};
}
