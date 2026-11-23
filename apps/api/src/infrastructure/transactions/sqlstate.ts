export type SqlDisposition='retryable-abort'|'conflict'|'timeout'|'other';
export function pgCode(err:unknown):string|undefined {
  return err!==null && typeof err==='object' && 'code' in err && typeof err.code==='string' ? err.code : undefined;
}
export function confirmedPgAbort(err:unknown):boolean {
  if(!err || typeof err!=='object') return false;
  const obj=err as {severity?:unknown;code?:unknown};
  return obj.severity==='ERROR' && typeof obj.code==='string' && /^[A-Z0-9]{5}$/.test(obj.code);
}
export function sqlDisposition(err:unknown):SqlDisposition {
  if(!confirmedPgAbort(err))return 'other';
  const code=pgCode(err);
  if(code==='40P01'||code==='40001')return 'retryable-abort';
  if(code==='23P01'||code==='23505'||code==='23503'||code==='23514')return 'conflict';
  if(code==='55P03'||code==='57014')return 'timeout';
  return 'other';
}
export class UnknownCommitOutcome extends Error {
  constructor(){super('Transaction outcome unknown; recover using original idempotency key');this.name='UnknownCommitOutcome';}
}
