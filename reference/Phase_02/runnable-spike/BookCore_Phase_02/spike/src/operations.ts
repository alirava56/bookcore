import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { codeOf, one, transaction } from './db.js';

export type Result = {status:number; body:Record<string,unknown>; replayed:boolean};
export type Context = {tenantId:string; actorId:string; key:string; operation:string};
export type BookingInput = Context & {sessionId:string; customerId:string};
export type CancelInput = Context & {bookingId:string; reason:string; staff?:boolean};
export type SessionInput = Context & {sessionId:string; reason:string; injectAfter?:number};
export type CapacityInput = Context & {sessionId:string; capacity:number};

// Key ordering is stable (RFC8785-like subset): JSON objects are sorted recursively;
// input contract restricts values to JSON scalar/array/object, no NaN, no undefined.
export function canonicalJson(x: unknown):string {
  if(x===null || typeof x==='string'||typeof x==='boolean') return JSON.stringify(x);
  if(typeof x==='number' && Number.isFinite(x)) return JSON.stringify(x);
  if(Array.isArray(x)) return '['+x.map(canonicalJson).join(',')+']';
  if(x && typeof x==='object' && Object.getPrototypeOf(x)===Object.prototype) {
    return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonicalJson((x as Record<string,unknown>)[k])).join(',')+'}';
  }
  throw new Error('unsupported JSON fingerprint input');
}
export function fingerprint(method:string, path:string, body:unknown):string {
  return createHash('sha256').update(canonicalJson({method,path,body})).digest('hex');
}
const response=(status:number,body:Record<string,unknown>):Result=>({status,body,replayed:false});
const reject=(status:number,code:string)=>response(status,{type:'about:blank',title:code,status,code});

async function checkActor(c:PoolClient, ctx:Context, staff:boolean):Promise<boolean> {
  const actor=await one<{status:string}>(c,'SELECT status FROM users WHERE id=$1 FOR SHARE',[ctx.actorId]);
  if(actor?.status!=='ACTIVE') return false;
  const tenant=await one<{status:string}>(c,'SELECT status FROM organizations WHERE id=$1 FOR SHARE',[ctx.tenantId]);
  if(tenant?.status!=='ACTIVE') return false;
  if(staff) {
    const m=await one<{role:string;status:string}>(c,
      'SELECT role,status FROM memberships WHERE tenant_id=$1 AND user_id=$2 FOR SHARE',[ctx.tenantId,ctx.actorId]);
    return m?.status==='ACTIVE' && (m.role==='OWNER'||m.role==='MANAGER');
  }
  return true;
}
async function claim(c:PoolClient, ctx:Context, hash:string):Promise<Result|null> {
  const inserted=await c.query(
    `INSERT INTO idempotency_records(tenant_id,actor_id,operation,key,request_hash,state)
     VALUES($1,$2,$3,$4,$5,'PROCESSING') ON CONFLICT DO NOTHING RETURNING key`,
     [ctx.tenantId,ctx.actorId,ctx.operation,ctx.key,hash]);
  if(inserted.rowCount===1) return null;
  const existing=await one<{request_hash:string;state:string;response_status:number;response_body:Record<string,unknown>}>(c,
    `SELECT request_hash,state,response_status,response_body FROM idempotency_records
     WHERE tenant_id=$1 AND actor_id=$2 AND operation=$3 AND key=$4`,
    [ctx.tenantId,ctx.actorId,ctx.operation,ctx.key]);
  if(!existing) throw new Error('idempotency conflict row missing after conflict wait');
  if(existing.request_hash!==hash) return reject(409,'IDEMPOTENCY_KEY_REUSED');
  if(existing.state!=='FINAL') throw new Error('nonterminal committed idempotency row');
  return {status:existing.response_status, body:existing.response_body, replayed:true};
}
async function finish(c:PoolClient,ctx:Context,r:Result):Promise<Result> {
  const sql=`UPDATE idempotency_records SET state='FINAL',response_status=$5,response_body=$6::jsonb,
   response_headers='{}'::jsonb WHERE tenant_id=$1 AND actor_id=$2 AND operation=$3 AND key=$4`;
  await c.query(sql,[ctx.tenantId,ctx.actorId,ctx.operation,ctx.key,r.status,JSON.stringify(r.body)]);
  return r;
}
async function sessionLock(c:PoolClient,tenantId:string,sessionId:string) {
  return one<{id:string;status:string;capacity_total:number;seats_committed:number;start_at:Date;end_at:Date}>(c,
    'SELECT id,status,capacity_total,seats_committed,start_at,end_at FROM sessions WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
    [tenantId,sessionId]);
}
async function audit(c:PoolClient,tenantId:string,actorId:string,kind:string,id:string,reason?:string):Promise<void> {
  await c.query(`INSERT INTO audit_events(tenant_id,actor_id,action,aggregate_type,aggregate_id,reason)
   VALUES($1,$2,$3,'SESSION',$4,$5)`, [tenantId,actorId,kind,id,reason??null]);
}
async function emit(c:PoolClient,tenantId:string,aggregateType:string,aggregateId:string,eventType:string):Promise<void> {
  await c.query(`INSERT INTO outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload)
   VALUES($1,$2,$3,$4,$5::jsonb)`,[tenantId,aggregateType,aggregateId,eventType,JSON.stringify({id:aggregateId})]);
}
async function event(c:PoolClient,tenantId:string,bookingId:string,from:string|null,to:string,actorId:string,reason?:string):Promise<void> {
  await c.query(`INSERT INTO booking_events(tenant_id,booking_id,from_status,to_status,actor_id,reason)
    VALUES($1,$2,$3,$4,$5,$6)`,[tenantId,bookingId,from,to,actorId,reason??null]);
  await emit(c,tenantId,'BOOKING',bookingId,`Booking${to==='CONFIRMED'?'Confirmed':'Cancelled'}`);
}

export async function book(x:BookingInput):Promise<Result> {
  const hash=fingerprint('POST',`/organizations/${x.tenantId}/sessions/${x.sessionId}/bookings`,{customerId:x.customerId});
  return transaction(async c=>{
    if(!await checkActor(c,x,false)) return reject(401,'AUTHENTICATION_REQUIRED');
    const replay=await claim(c,x,hash); if(replay) return replay;
    const s=await sessionLock(c,x.tenantId,x.sessionId);
    if(!s) return finish(c,x,reject(404,'RESOURCE_NOT_FOUND'));
    // This spike handles only self-service booking. Staff-on-behalf is deliberately excluded.
    if(x.customerId!==x.actorId) return finish(c,x,reject(403,'TENANT_ACCESS_DENIED'));
    const now=await one<{ts:Date}>(c,'SELECT clock_timestamp() AS ts');
    if(s.status!=='PUBLISHED'||!now || now.ts>=s.start_at)
      return finish(c,x,reject(409,'SESSION_NOT_BOOKABLE'));
    const duplicate=await one<{id:string}>(c,`SELECT id FROM bookings WHERE tenant_id=$1 AND session_id=$2
     AND customer_id=$3 AND status IN ('CONFIRMED','ATTENDED','NO_SHOW')`,[x.tenantId,x.sessionId,x.customerId]);
    if(duplicate) return finish(c,x,reject(409,'BOOKING_ALREADY_EXISTS'));
    if(s.seats_committed>=s.capacity_total) return finish(c,x,reject(409,'SESSION_FULL'));
    const id=randomUUID();
    await c.query(`INSERT INTO bookings(id,tenant_id,session_id,customer_id,created_by_actor_id)
       VALUES($1,$2,$3,$4,$5)`,[id,x.tenantId,x.sessionId,x.customerId,x.actorId]);
    await c.query(`UPDATE sessions SET seats_committed=seats_committed+1,version=version+1,
      updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2`,[x.tenantId,x.sessionId]);
    await event(c,x.tenantId,id,null,'CONFIRMED',x.actorId);
    return finish(c,x,response(201,{id,status:'CONFIRMED',sessionId:x.sessionId}));
  });
}

export async function cancelBooking(x:CancelInput):Promise<Result> {
  const hash=fingerprint('POST',`/organizations/${x.tenantId}/bookings/${x.bookingId}/cancel`,{reason:x.reason});
  return transaction(async c=>{
    if(!await checkActor(c,x,Boolean(x.staff))) return reject(403,'TENANT_ACCESS_DENIED');
    const replay=await claim(c,x,hash); if(replay) return replay;
    // The pre-read doesn't lock Booking. Global lock order remains Session before Booking.
    const ref=await one<{session_id:string}>(c,'SELECT session_id FROM bookings WHERE tenant_id=$1 AND id=$2',
      [x.tenantId,x.bookingId]);
    if(!ref) return finish(c,x,reject(404,'RESOURCE_NOT_FOUND'));
    const s=await sessionLock(c,x.tenantId,ref.session_id);
    if(!s) return finish(c,x,reject(404,'RESOURCE_NOT_FOUND'));
    const b=await one<{id:string;status:string;customer_id:string}>(c,
     'SELECT id,status,customer_id FROM bookings WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
      [x.tenantId,x.bookingId]);
    if(!b || (!x.staff && b.customer_id!==x.actorId)) return finish(c,x,reject(404,'RESOURCE_NOT_FOUND'));
    if(b.status==='CANCELLED') return finish(c,x,response(200,{id:b.id,status:'CANCELLED',alreadyCancelled:true}));
    if(b.status!=='CONFIRMED') return finish(c,x,reject(409,'INVALID_STATE_TRANSITION'));
    const now=await one<{ts:Date}>(c,'SELECT clock_timestamp() AS ts');
    const policy=await one<{cancellation_cutoff_min:number}>(c,
      'SELECT cancellation_cutoff_min FROM organizations WHERE id=$1',[x.tenantId]);
    if(s.status!=='PUBLISHED' || !now || !policy || (x.staff ? now.ts>=s.start_at :
      now.ts.getTime()>s.start_at.getTime()-policy.cancellation_cutoff_min*60*1000))
      return finish(c,x,reject(422,'CANCELLATION_WINDOW_CLOSED'));
    if(!x.reason.trim()) return finish(c,x,reject(422,'CANCELLATION_REASON_REQUIRED'));
    await c.query(`UPDATE bookings SET status='CANCELLED',cancelled_at=clock_timestamp(),cancel_reason=$3,
     updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2`,[x.tenantId,b.id,x.reason]);
    await c.query(`UPDATE sessions SET seats_committed=seats_committed-1,version=version+1,
     updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2`,[x.tenantId,ref.session_id]);
    await event(c,x.tenantId,b.id,'CONFIRMED','CANCELLED',x.actorId,x.reason);
    return finish(c,x,response(200,{id:b.id,status:'CANCELLED',alreadyCancelled:false}));
  });
}

export async function changeCapacity(x:CapacityInput):Promise<Result> {
  const hash=fingerprint('PATCH',`/organizations/${x.tenantId}/sessions/${x.sessionId}/capacity`,{capacity:x.capacity});
  return transaction(async c=>{
    if(!await checkActor(c,x,true)) return reject(403,'TENANT_ACCESS_DENIED');
    const replay=await claim(c,x,hash);if(replay)return replay;
    const s=await sessionLock(c,x.tenantId,x.sessionId);
    if(!s)return finish(c,x,reject(404,'RESOURCE_NOT_FOUND'));
    const now=await one<{ts:Date}>(c,'SELECT clock_timestamp() AS ts');
    if(!now || now.ts>=s.start_at || !['DRAFT','PUBLISHED'].includes(s.status))
      return finish(c,x,reject(409,'INVALID_STATE_TRANSITION'));
    if(!Number.isInteger(x.capacity)||x.capacity<1||x.capacity>1000)
      return finish(c,x,reject(422,'INVALID_CAPACITY'));
    if(x.capacity<s.seats_committed) return finish(c,x,reject(409,'CAPACITY_BELOW_COMMITTED'));
    await c.query(`UPDATE sessions SET capacity_total=$3,version=version+1,
      updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2`,[x.tenantId,x.sessionId,x.capacity]);
    await audit(c,x.tenantId,x.actorId,'CapacityChanged',x.sessionId);
    await emit(c,x.tenantId,'SESSION',x.sessionId,'SessionCapacityChanged');
    return finish(c,x,response(200,{sessionId:x.sessionId,capacity:x.capacity}));
  });
}

export async function cancelSession(x:SessionInput):Promise<Result> {
  const hash=fingerprint('POST',`/organizations/${x.tenantId}/sessions/${x.sessionId}/cancel`,{reason:x.reason});
  return transaction(async c=>{
    if(!await checkActor(c,x,true))return reject(403,'TENANT_ACCESS_DENIED');
    const replay=await claim(c,x,hash);if(replay)return replay;
    const s=await sessionLock(c,x.tenantId,x.sessionId);
    if(!s)return finish(c,x,reject(404,'RESOURCE_NOT_FOUND'));
    const now=await one<{ts:Date}>(c,'SELECT clock_timestamp() AS ts');
    if(!now || now.ts>=s.start_at || !['DRAFT','PUBLISHED'].includes(s.status))
      return finish(c,x,reject(409,'SESSION_NOT_CANCELLABLE'));
    if(!x.reason.trim())return finish(c,x,reject(422,'CANCELLATION_REASON_REQUIRED'));
    const locked=await c.query(`SELECT id,status FROM bookings WHERE tenant_id=$1 AND session_id=$2
        ORDER BY id FOR UPDATE`,[x.tenantId,x.sessionId]);
    if(locked.rows.some((b:{status:string})=>!['CONFIRMED','CANCELLED'].includes(b.status)))
      return finish(c,x,reject(409,'INVALID_STATE_TRANSITION'));
    let cancelled=0;
    for(const b of locked.rows as {id:string;status:string}[]) {
      if(b.status==='CANCELLED')continue;
      await c.query(`UPDATE bookings SET status='CANCELLED',cancelled_at=clock_timestamp(),
        cancel_reason='SESSION_CANCELLED',updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2`,
        [x.tenantId,b.id]);
      await event(c,x.tenantId,b.id,'CONFIRMED','CANCELLED',x.actorId,'SESSION_CANCELLED');
      cancelled++;
      if(x.injectAfter===cancelled)throw new Error('INJECTED_PRECOMMIT_FAILURE');
    }
    await c.query(`UPDATE sessions SET status='CANCELLED',seats_committed=0,version=version+1,
       cancel_reason=$3,updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2`,[x.tenantId,x.sessionId,x.reason]);
    await c.query(`UPDATE resource_allocations SET active=false,deactivated_at=clock_timestamp()
      WHERE tenant_id=$1 AND session_id=$2 AND active`,[x.tenantId,x.sessionId]);
    await audit(c,x.tenantId,x.actorId,'SessionCancelled',x.sessionId,x.reason);
    await emit(c,x.tenantId,'SESSION',x.sessionId,'SessionCancelled');
    return finish(c,x,response(200,{sessionId:x.sessionId,status:'CANCELLED',cancelledBookings:cancelled}));
  });
}

export function sqlstateDisposition(err:unknown):'retry'|'conflict'|'timeout'|'error' {
 const code=codeOf(err);
 if(code==='40P01'||code==='40001')return 'retry';
 if(code==='23P01'||code==='23505')return 'conflict';
 if(code==='55P03')return 'timeout';
 return 'error';
}
