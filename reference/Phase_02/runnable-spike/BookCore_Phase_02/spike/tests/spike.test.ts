import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {fork, type ChildProcess} from 'node:child_process';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {pool,closeDb,codeOf,transaction} from '../src/db.js';
import {book,cancelBooking,cancelSession,changeCapacity,canonicalJson,sqlstateDisposition,type Result,type BookingInput} from '../src/operations.js';
import {fixture,createSiblingSession,createUser,summary,type Fixture} from '../src/fixtures.js';
import {reconciliationSql,bookingHistoryReconciliationSql} from '../src/reconcile.js';

after(async()=>{await closeDb();});
const key=()=>randomUUID();
const bookingInput=(f:Fixture,i:number):BookingInput=>({tenantId:f.tenantId,actorId:f.customers[i]!,
 customerId:f.customers[i]!,sessionId:f.sessionId,key:key(),operation:'book'});
const metrics:{experiment:string;results:unknown}[]=[];
function percentile(a:number[],fraction:number):number {const s=[...a].sort((x,y)=>x-y);return s[Math.max(0,Math.ceil(s.length*fraction)-1)]??0;}
export function forkBarrier(jobs:BookingInput[], timeoutMs=180_000):Promise<Array<{status:number;code:string|null;latencyMs:number}>> {
 if(jobs.length!==100) return Promise.reject(new Error('harness requires exactly 100 jobs'));
 return new Promise((resolvePromise,reject)=>{
   const workerFile=resolve(process.cwd(),'dist/src/worker.js');
   const halves=[jobs.slice(0,50),jobs.slice(50)];
   const children:ChildProcess[]=[];
   const ready=new Set<number>(), finished=new Set<number>(), exited=new Set<number>();
   const outputs:Array<{status:number;code:string|null;latencyMs:number}>=[];
   let settled=false;
   const timer=setTimeout(()=>abort(new Error('two-process concurrency harness timeout')),timeoutMs);
   const terminate=()=>{
     for(const c of children){
       if(c.exitCode===null && !c.killed) c.kill('SIGTERM');
       const forced=setTimeout(()=>{if(c.exitCode===null)c.kill('SIGKILL');},1500);
       forced.unref();
     }
   };
   const abort=(err:Error)=>{
     if(settled)return;
     settled=true;
     clearTimeout(timer);
     terminate();
     reject(err);
   };
   const complete=()=>{
     if(!settled && finished.size===2 && exited.size===2) {
       settled=true;clearTimeout(timer);resolvePromise(outputs);
     }
   };
   for(let i=0;i<2;i++){
     const ch=fork(workerFile,[],{env:{...process.env,BOOKCORE_INSTANCE:`worker-${i}`,PG_POOL_MAX:'10'},execArgv:[]});
     children.push(ch);
     ch.on('error',(e)=>abort(e));
     ch.on('exit',(code,signal)=>{
       if(settled)return;
       if(code!==0 || signal) return abort(new Error(`worker ${i} failed: exit=${code}, signal=${signal}`));
       if(!finished.has(i)) return abort(new Error(`worker ${i} exited before final IPC message`));
       exited.add(i);complete();
     });
     ch.on('message',(msg:unknown)=>{
       if(settled)return;
       const m=msg as {type?:string;pid?:number;results?:typeof outputs;error?:string};
       if(m.type==='ready'){
         if(ready.has(i))return abort(new Error(`duplicate worker ${i} ready`));
         ready.add(i);
         if(ready.size===2){
           children.forEach((child,index)=>child.send({type:'go',jobs:halves[index]},err=>{
             if(err)abort(err);
           }));
         }
       }else if(m.type==='finished'){
         if(finished.has(i) || !Array.isArray(m.results) || m.results.length!==halves[i]!.length)
           return abort(new Error(`worker ${i} invalid or duplicated final results`));
         finished.add(i);outputs.push(...m.results);complete();
       }else if(m.type==='fatal')abort(new Error(`worker ${i}: ${m.error ?? 'unknown error'}`));
     });
   }
 });
}

for(const capacity of [1,20]) {
 test(`A: ${capacity} seats / 100 independent attempts / two processes / three repetitions`,{timeout:180000},async()=>{
   for(let repeat=0;repeat<3;repeat++){
     const f=await fixture(capacity,100); const jobs=f.customers.map((_,i)=>bookingInput(f,i));
     const before=performance.now();const results=await forkBarrier(jobs);const durationMs=performance.now()-before;
     const r=await summary(f);
     const success=results.filter(x=>x.status===201).length;
     assert.equal(results.length,100);assert.equal(success,capacity);
     assert.equal(results.filter(x=>x.status===409).length,100-capacity);
     assert.equal(results.filter(x=>x.status===0).length,0);
     assert.equal(r.seats,capacity);assert.equal(r.effective,capacity);
     assert.equal(r.events,capacity);assert.equal(r.outbox,capacity);
     const times=results.map(x=>x.latencyMs);
     metrics.push({experiment:`A${capacity}-run${repeat+1}`,results:{durationMs,success,
       failed:results.filter(x=>x.status!==201).length,p50:percentile(times,.5),
       p95:percentile(times,.95),p99:percentile(times,.99),timeouts:results.filter(x=>x.code==='55P03').length}});
   }
 });
}

test('B/D: concurrent identical idempotency key returns same booking; payload conflict rejects',async()=>{
 const f=await fixture(3,2);const x=bookingInput(f,0);
 const [a,b]=await Promise.all([book(x),book(x)]);
 assert.equal(a.status,201);assert.equal(b.status,201);
 assert.equal(a.body.id,b.body.id);assert.equal(Number(a.replayed)+Number(b.replayed),1);
 const conflict=await book({...x,customerId:f.customers[1]!});
 assert.equal(conflict.status,409);assert.equal(conflict.body.code,'IDEMPOTENCY_KEY_REUSED');
 assert.equal((await summary(f)).effective,1);
});

test('D: same key after expiry before cleanup replays; terminal SESSION_FULL persisted',async()=>{
 const f=await fixture(1,2),x=bookingInput(f,0),y=bookingInput(f,1);
 assert.equal((await book(x)).status,201);
 const failed=await book(y);assert.equal(failed.status,409);assert.equal(failed.body.code,'SESSION_FULL');
 await pool.query(`UPDATE idempotency_records SET expires_at=clock_timestamp()-interval '1 minute',
   created_at=clock_timestamp()-interval '2 days' WHERE tenant_id=$1 AND key=$2`,[f.tenantId,y.key]);
 const again=await book(y);assert.equal(again.status,409);assert.equal(again.replayed,true);
 assert.equal((await summary(f)).effective,1);
});

test('D: simulated lost response after successful COMMIT is recovered with same key',async()=>{
 const f=await fixture(2,1),x=bookingInput(f,0);
 // Harness deliberately discards a successful response: this is NOT real connection-loss testing.
 void await book(x);
 const replay=await book(x);assert.equal(replay.status,201);assert.equal(replay.replayed,true);
 assert.equal((await summary(f)).events,1);
});

test('E: concurrent double cancellation releases one seat, emits one cancellation event',async()=>{
 const f=await fixture(1,1),x=bookingInput(f,0),created=await book(x);
 const bookingId=String(created.body.id);
 const [a,b]=await Promise.all([0,1].map(()=>cancelBooking({tenantId:f.tenantId,
  actorId:x.actorId,bookingId,key:key(),reason:'Customer cancel',operation:'cancelBooking'})));
 assert.deepEqual([a!.status,b!.status],[200,200]);
 const s=await summary(f);assert.equal(s.seats,0);assert.equal(s.effective,0);
 assert.equal(s.events,2);assert.equal(s.outbox,2);
 assert.equal([a,b].filter(q=>q!.body.alreadyCancelled===true).length,1);
});

test('E: capacity decrease below commitments is rejected; valid decrease accepted',async()=>{
 const f=await fixture(4,2);
 for(let i=0;i<2;i++)assert.equal((await book(bookingInput(f,i))).status,201);
 const ctx={tenantId:f.tenantId,actorId:f.managerId,key:key(),operation:'changeCapacity',sessionId:f.sessionId};
 const bad=await changeCapacity({...ctx,capacity:1});assert.equal(bad.status,409);
 const ok=await changeCapacity({...ctx,key:key(),capacity:2});assert.equal(ok.status,200);
 assert.equal((await summary(f)).effective,2);
});

test('E: full cancel 15 confirmed — all audit, bookings, counter and allocation changes atomic',async()=>{
 const f=await fixture(15,15);
 for(let i=0;i<15;i++)assert.equal((await book(bookingInput(f,i))).status,201);
 const base=await summary(f);assert.equal(base.events,15);
 const ctx={tenantId:f.tenantId,actorId:f.managerId,key:key(),operation:'cancelSession',
  sessionId:f.sessionId,reason:'Test shutdown'};
 await assert.rejects(()=>cancelSession({...ctx,injectAfter:7}),/INJECTED_PRECOMMIT_FAILURE/);
 assert.deepEqual(await summary(f),base,'after injected failure, no partial commit');
 const result=await cancelSession(ctx);assert.equal(result.status,200);
 const after=await summary(f);
 assert.equal(after.status,'CANCELLED');assert.equal(after.seats,0);assert.equal(after.effective,0);
 assert.equal(after.activeAlloc,0);assert.equal(after.events,30);assert.equal(after.outbox,31);
});

test('C1/C2: overlapping trainer denied by GiST; adjacent time allowed [start,end)',async()=>{
 const f=await fixture(10,0,{room:false});
 await assert.rejects(()=>createSiblingSession(f,new Date(f.startAt.getTime()+30*60000),
   new Date(f.endAt.getTime()+30*60000)),e=>codeOf(e)==='23P01');
 const adjacent=await createSiblingSession(f,f.endAt,new Date(f.endAt.getTime()+3600000));
 assert.ok(adjacent);
});

test('C3: trainer buffers block adjacent logical sessions and accept gap after buffer',async()=>{
 const f=await fixture(10,0,{room:false,buffer:10});
 await assert.rejects(()=>createSiblingSession(f,f.endAt,new Date(f.endAt.getTime()+3600000)),
 e=>codeOf(e)==='23P01');
 const later=new Date(f.endAt.getTime()+20*60000);
 assert.ok(await createSiblingSession(f,later,new Date(later.getTime()+3600000)));
});

test('C5: one Trainer resource conflicts across branches in the same tenant',async()=>{
 const f=await fixture(10,0,{room:false});const branch2=randomUUID();
 await pool.query('INSERT INTO branches(id,tenant_id,name) VALUES($1,$2,$3)',[branch2,f.tenantId,'Other Branch']);
 await assert.rejects(()=>createSiblingSession(f,new Date(f.startAt.getTime()+10*60000),
  new Date(f.endAt.getTime()+10*60000),{branchId:branch2}),e=>codeOf(e)==='23P01');
});

test('F/security: tenant composite FK rejects cross-tenant session booking reference',async()=>{
 const a=await fixture(1,1),b=await fixture(1,1);
 await assert.rejects(()=>pool.query(`INSERT INTO bookings(tenant_id,session_id,customer_id,created_by_actor_id)
  VALUES($1,$2,$3,$3)`,[a.tenantId,b.sessionId,a.customers[0]]),e=>codeOf(e)==='23503');
});

test('F: deferred constraint trigger rejects direct counter drift',async()=>{
 const f=await fixture(2,1);await assert.rejects(()=>pool.query(`UPDATE sessions SET seats_committed=1
 WHERE tenant_id=$1 AND id=$2`,[f.tenantId,f.sessionId]),e=>codeOf(e)==='23514');
 assert.equal((await summary(f)).seats,0);
});

test('F: deferred constraint rejects mismatched allocation buffer and non-final idempotency claim',async()=>{
 const f=await fixture(2,1,{buffer:7});
 await assert.rejects(()=>pool.query(`UPDATE resource_allocations SET end_at=end_at+interval '2 minutes'
  WHERE tenant_id=$1 AND session_id=$2 AND resource_id=$3`,[f.tenantId,f.sessionId,f.trainerResourceId]),
  e=>codeOf(e)==='23514');
 await assert.rejects(()=>pool.query(`INSERT INTO idempotency_records(tenant_id,actor_id,operation,key,request_hash,state)
   VALUES($1,$2,'test',$3,$4,'PROCESSING')`,[f.tenantId,f.customers[0]!,key(),'a'.repeat(64)]),
  e=>codeOf(e)==='23514');
});

test('F/security: append-only BookingEvents deny update/delete',async()=>{
 const f=await fixture(1,1),x=bookingInput(f,0);await book(x);
 await assert.rejects(()=>pool.query(`DELETE FROM booking_events WHERE tenant_id=$1`,[f.tenantId]),
  e=>codeOf(e)==='23514');
});

test('F: independent reconciliation reports no drift after permitted mutations',async()=>{
 const f=await fixture(1,1);await book(bookingInput(f,0));
 const r=await pool.query(reconciliationSql);
 assert.equal(r.rows.length,0);
});

test('B: SQLSTATE classification is explicitly bounded',()=>{
 assert.equal(sqlstateDisposition({code:'40P01'}),'retry');
 assert.equal(sqlstateDisposition({code:'40001'}),'retry');
 assert.equal(sqlstateDisposition({code:'55P03'}),'timeout');
 assert.equal(sqlstateDisposition({code:'23P01'}),'conflict');
 assert.equal(sqlstateDisposition({code:'23505'}),'conflict');
 assert.equal(sqlstateDisposition({code:'23514'}),'error');
 assert.equal(canonicalJson({b:1,a:2}),canonicalJson({a:2,b:1}));
});

process.on('beforeExit',()=>{
 if(metrics.length)process.stdout.write(`BOOKCORE_SPIKE_METRICS=${JSON.stringify(metrics)}\n`);
});

test('C4: separate trainer and room do not falsely conflict',async()=>{
 const f=await fixture(2,0,{room:true});
 const newTrainer=await transaction(async c=>{
  const user=await createUser(c),trainer=randomUUID(),room=randomUUID();
  await c.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'TRAINER')`,[f.tenantId,user]);
  await c.query(`INSERT INTO resources(id,tenant_id,type,trainer_user_id,display_name)
   VALUES($1,$2,'TRAINER',$3,'Other trainer')`,[trainer,f.tenantId,user]);
  await c.query(`INSERT INTO resources(id,tenant_id,branch_id,type,display_name)
   VALUES($1,$2,$3,'ROOM','Other room')`,[room,f.tenantId,f.branchId]);
  return {trainer,room};
 });
 assert.ok(await createSiblingSession(f,f.startAt,f.endAt,
  {trainerResourceId:newTrainer.trainer,roomId:newTrainer.room}));
});

test('C6: full cancellation releases allocation and preserves history',async()=>{
 const f=await fixture(2,1,{room:false});
 const x=bookingInput(f,0);assert.equal((await book(x)).status,201);
 const cancelled=await cancelSession({tenantId:f.tenantId,actorId:f.managerId,sessionId:f.sessionId,
  key:key(),reason:'Scheduling withdrawal',operation:'cancelSession'});
 assert.equal(cancelled.status,200);
 assert.ok(await createSiblingSession(f,f.startAt,f.endAt));
 const b=await summary(f);assert.equal(b.events,2);assert.equal(b.activeAlloc,0);
});

test('C7: cross-midnight UTC interval remains adjacent under half-open semantics',async()=>{
 const start=new Date(Date.now()+7*86400000); start.setUTCHours(23,30,0,0);
 const f=await fixture(2,0,{room:false,startAt:start});
 assert.ok(await createSiblingSession(f,f.endAt,new Date(f.endAt.getTime()+3600000)));
});

test('E3: booking versus capacity change never commits seats > total',async()=>{
 const f=await fixture(20,20);
 const jobs=f.customers.map((_,i)=>book(bookingInput(f,i)));
 const cap=changeCapacity({tenantId:f.tenantId,actorId:f.managerId,key:key(),operation:'changeCapacity',
  sessionId:f.sessionId,capacity:2});
 const [bookings,capacityResult]=await Promise.all([Promise.all(jobs),cap]);
 const s=await pool.query('SELECT capacity_total,seats_committed FROM sessions WHERE id=$1',[f.sessionId]);
 assert.ok(s.rows[0].seats_committed<=s.rows[0].capacity_total);
 assert.equal((await summary(f)).effective,s.rows[0].seats_committed);
 assert.ok([200,409].includes(capacityResult.status));
 assert.equal(bookings.filter(r=>r.status===201).length,s.rows[0].seats_committed);
});

test('Security: unauthorized role cannot change session capacity',async()=>{
 const f=await fixture(3,1);
 const result=await changeCapacity({tenantId:f.tenantId,actorId:f.customers[0]!,
 key:key(),operation:'changeCapacity',sessionId:f.sessionId,capacity:1});
 assert.equal(result.status,403);
 assert.equal((await summary(f)).seats,0);
});

test('Security: membership revocation serializes with in-flight write',async()=>{
 const f=await fixture(3,0);
 const staff=await transaction(async c=>{
   const id=await createUser(c);
   await c.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'MANAGER')`,[f.tenantId,id]);
   return id;
 });
 const first=changeCapacity({tenantId:f.tenantId,actorId:staff,key:key(),operation:'changeCapacity',
   sessionId:f.sessionId,capacity:2});
 const revoke=transaction(async c=>{
   await c.query(`UPDATE memberships SET status='REVOKED',revoked_at=clock_timestamp()
    WHERE tenant_id=$1 AND user_id=$2`,[f.tenantId,staff]);
 });
 const [firstResult]=await Promise.all([first,revoke]);
 assert.ok([200,403].includes(firstResult.status));
 const later=await changeCapacity({tenantId:f.tenantId,actorId:staff,key:key(),operation:'changeCapacity',
  sessionId:f.sessionId,capacity:1});
 assert.equal(later.status,403);
});

test('Security: tenant-safe ResourceAllocation FK rejects resource from another tenant',async()=>{
 const a=await fixture(1,0),b=await fixture(1,0);
 await assert.rejects(()=>pool.query(`INSERT INTO resource_allocations(tenant_id,session_id,resource_id,start_at,end_at)
 VALUES($1,$2,$3,$4,$5)`,[a.tenantId,a.sessionId,b.trainerResourceId,a.startAt,a.endAt]),
  e=>codeOf(e)==='23503');
});

test('F: independent unique index refuses duplicate effective booking',async()=>{
 const f=await fixture(2,1),x=bookingInput(f,0);
 assert.equal((await book(x)).status,201);
 await assert.rejects(()=>pool.query(`INSERT INTO bookings(tenant_id,session_id,customer_id,created_by_actor_id)
  VALUES($1,$2,$3,$3)`,[f.tenantId,f.sessionId,x.customerId]),e=>codeOf(e)==='23505');
});

test('B: actual lock timeout SQLSTATE 55P03 under controlled contention',async()=>{
 const f=await fixture(2,0),a=await pool.connect(),b=await pool.connect();
 try{
  await a.query('BEGIN');await b.query('BEGIN');
  await a.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE',[f.sessionId]);
  await b.query("SET LOCAL lock_timeout = '100ms'");
  await assert.rejects(()=>b.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE',[f.sessionId]),
   err=>codeOf(err)==='55P03');
 }finally{await a.query('ROLLBACK');await b.query('ROLLBACK');a.release();b.release();}
});

test('B: controlled opposing lock order reproduces PostgreSQL 40P01 deadlock',async()=>{
 const aFixture=await fixture(1,0),bFixture=await fixture(1,0);
 const a=await pool.connect(),b=await pool.connect();
 try{
  await a.query('BEGIN');await b.query('BEGIN');
  await a.query("SET LOCAL deadlock_timeout='100ms'");
  await b.query("SET LOCAL deadlock_timeout='100ms'");
  await a.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE',[aFixture.sessionId]);
  await b.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE',[bFixture.sessionId]);
  const settled=await Promise.allSettled([
   a.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE',[bFixture.sessionId]),
   b.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE',[aFixture.sessionId]),
  ]);
  assert.ok(settled.some(x=>x.status==='rejected' && codeOf(x.reason)==='40P01'));
 }finally{await a.query('ROLLBACK');await b.query('ROLLBACK');a.release();b.release();}
});

test('F: read-only role explicitly denied mutation (superuser-owned disposable DB)',async()=>{
 const f=await fixture(1,0);
 await pool.query(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bookcore_spike_readonly')
  THEN CREATE ROLE bookcore_spike_readonly NOLOGIN; END IF; END $$;`);
 await pool.query('GRANT SELECT ON sessions TO bookcore_spike_readonly');
 const c=await pool.connect();
 try{
  await c.query('BEGIN');await c.query('SET LOCAL ROLE bookcore_spike_readonly');
  await assert.rejects(()=>c.query('UPDATE sessions SET capacity_total=3 WHERE id=$1',[f.sessionId]),
   e=>codeOf(e)==='42501');
 }finally{await c.query('ROLLBACK');c.release();}
});

// B-06 adversarial regression: independent persisted-state reads after rejected SQL.
test('B06: Booking session reassignment is rejected even within same tenant',async()=>{
 const f=await fixture(2,1),x=bookingInput(f,0),created=await book(x);
 assert.equal(created.status,201);
 const sibling=await createSiblingSession(f,new Date(f.endAt.getTime()+3600000),new Date(f.endAt.getTime()+7200000));
 await assert.rejects(()=>pool.query(`UPDATE bookings SET session_id=$3 WHERE tenant_id=$1 AND id=$2`,
  [f.tenantId,created.body.id,sibling]),err=>codeOf(err)==='23514');
 const b=await pool.query('SELECT session_id FROM bookings WHERE id=$1',[created.body.id]);
 assert.equal(b.rows[0].session_id,f.sessionId);
 assert.equal((await summary(f)).seats,1);
});

test('B06: Booking tenant and customer reassignment and direct deletion rejected',async()=>{
 const f=await fixture(2,2),x=bookingInput(f,0),created=await book(x);
 assert.equal(created.status,201);
 const other=await fixture(1,0);
 for(const [column,value] of [['tenant_id',other.tenantId],['customer_id',f.customers[1]!]] as const){
  await assert.rejects(()=>pool.query(`UPDATE bookings SET ${column}=$2 WHERE id=$1`,
   [created.body.id,value]),err=>['23503','23514'].includes(codeOf(err)??''));
 }
 await assert.rejects(()=>pool.query('DELETE FROM bookings WHERE id=$1',[created.body.id]),
  err=>codeOf(err)==='23514');
 assert.equal((await summary(f)).effective,1);
});

test('B06: Allocation session/tenant/resource reassignment and direct deletion rejected',async()=>{
 const f=await fixture(2,0),other=await fixture(2,0);
 const row=await pool.query('SELECT id FROM resource_allocations WHERE tenant_id=$1 AND session_id=$2 LIMIT 1',
  [f.tenantId,f.sessionId]);
 const allocId=row.rows[0].id;
 for(const [column,value] of [['session_id',other.sessionId],['tenant_id',other.tenantId],
  ['resource_id',other.trainerResourceId]] as const){
  await assert.rejects(()=>pool.query(`UPDATE resource_allocations SET ${column}=$2 WHERE id=$1`,
   [allocId,value]),e=>['23503','23514'].includes(codeOf(e)??''));
 }
 await assert.rejects(()=>pool.query('DELETE FROM resource_allocations WHERE id=$1',[allocId]),
  e=>codeOf(e)==='23514');
 assert.equal((await summary(f)).activeAlloc,2);
});

test('B06: Published schedule and Session tenant identity are immutable',async()=>{
 const f=await fixture(2,0),other=await fixture(2,0);
 await assert.rejects(()=>pool.query("UPDATE sessions SET start_at=start_at+interval '1 hour' WHERE id=$1",
  [f.sessionId]),e=>codeOf(e)==='23514');
 await assert.rejects(()=>pool.query('UPDATE sessions SET tenant_id=$2 WHERE id=$1',
  [f.sessionId,other.tenantId]),e=>codeOf(e)==='23514');
 assert.equal((await summary(f)).status,'PUBLISHED');
});

test('B06: Invalid booking and Session status transitions reject direct SQL',async()=>{
 const f=await fixture(2,1),x=bookingInput(f,0),created=await book(x);
 await assert.rejects(()=>pool.query("UPDATE bookings SET status='ATTENDED' WHERE id=$1",
  [created.body.id]),e=>codeOf(e)==='23514'); // requires committed effective count but no event? see note below
 await assert.rejects(()=>pool.query("UPDATE sessions SET status='DRAFT' WHERE id=$1",
  [f.sessionId]),e=>codeOf(e)==='23514');
});

test('B06: Resource identity and definition with active allocations protected',async()=>{
 const f=await fixture(2,0),other=await fixture(2,0);
 await assert.rejects(()=>pool.query('UPDATE resources SET tenant_id=$2 WHERE id=$1',
  [f.trainerResourceId,other.tenantId]),e=>codeOf(e)==='23514');
 await assert.rejects(()=>pool.query("UPDATE resources SET type='ROOM' WHERE id=$1",
  [f.trainerResourceId]),e=>codeOf(e)==='23514');
 await assert.rejects(()=>pool.query('UPDATE resources SET buffer_before_min=5 WHERE id=$1',
  [f.trainerResourceId]),e=>codeOf(e)==='23514');
});

test('B06: Invalid Trainer/Room resource substitution is denied by DB trigger',async()=>{
 const f=await fixture(2,0,{room:true});
 await assert.rejects(()=>pool.query('UPDATE sessions SET trainer_resource_id=$2 WHERE id=$1',
  [f.sessionId,f.roomId]),e=>codeOf(e)==='23514');
});

test('B06: Cancellation preserves immutable history and does not reactivate allocations',async()=>{
 const f=await fixture(1,1,{room:false}),x=bookingInput(f,0);
 assert.equal((await book(x)).status,201);
 assert.equal((await cancelSession({tenantId:f.tenantId,actorId:f.managerId,
  key:key(),operation:'cancelSession',sessionId:f.sessionId,reason:'adversarial'})).status,200);
 await assert.rejects(()=>pool.query(`UPDATE resource_allocations SET active=true,deactivated_at=NULL
  WHERE session_id=$1`,[f.sessionId]),e=>codeOf(e)==='23514');
 await assert.rejects(()=>pool.query("UPDATE booking_events SET reason='tampered' WHERE tenant_id=$1",
  [f.tenantId]),e=>codeOf(e)==='23514');
 assert.equal((await summary(f)).activeAlloc,0);
});

test('B06: Direct counter corruption and direct allocation deactivation never commit',async()=>{
 const f=await fixture(2,0);
 await assert.rejects(()=>pool.query(`UPDATE sessions SET seats_committed=1 WHERE id=$1`,
  [f.sessionId]),e=>codeOf(e)==='23514');
 await assert.rejects(()=>pool.query(`UPDATE resource_allocations SET active=false,
  deactivated_at=clock_timestamp() WHERE session_id=$1`,[f.sessionId]),e=>codeOf(e)==='23514');
 assert.equal((await summary(f)).seats,0);
 assert.equal((await summary(f)).activeAlloc,2);
});

test('C concurrency: two overlapping allocations race and exactly one succeeds',async()=>{
 const f=await fixture(2,0,{room:false}),start=new Date(f.endAt.getTime()+3600000);
 const end=new Date(start.getTime()+3600000);
 const all=await Promise.allSettled([createSiblingSession(f,start,end),createSiblingSession(f,start,end)]);
 assert.equal(all.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(all.filter(x=>x.status==='rejected'&&codeOf(x.reason)==='23P01').length,1);
 const count=await pool.query(`SELECT count(*)::int AS n FROM resource_allocations
 WHERE tenant_id=$1 AND resource_id=$2 AND start_at=$3 AND active`,[f.tenantId,f.trainerResourceId,start]);
 assert.equal(count.rows[0].n,1);
});

test('D: abandoned claim rolls back; later same key executes from scratch',async()=>{
 const f=await fixture(2,1),x=bookingInput(f,0);
 await assert.rejects(()=>transaction(async c=>{
  await c.query(`INSERT INTO idempotency_records(tenant_id,actor_id,operation,key,request_hash,state)
   VALUES($1,$2,$3,$4,$5,'PROCESSING')`,[f.tenantId,x.actorId,x.operation,x.key,'a'.repeat(64)]);
  throw new Error('INJECTED_BEFORE_COMMIT');
 }),/INJECTED_BEFORE_COMMIT/);
 const r=await pool.query('SELECT count(*)::int AS n FROM idempotency_records WHERE key=$1',[x.key]);
 assert.equal(r.rows[0].n,0);
 assert.equal((await book(x)).status,201);
 assert.equal((await summary(f)).events,1);
});

test('D: expiration cleanup allows key reuse but does not duplicate booking',async()=>{
 const f=await fixture(2,1),x=bookingInput(f,0);
 assert.equal((await book(x)).status,201);
 await pool.query(`UPDATE idempotency_records SET expires_at=clock_timestamp()-interval '1 minute',
  created_at=clock_timestamp()-interval '2 days' WHERE tenant_id=$1 AND key=$2`,[f.tenantId,x.key]);
 assert.equal((await book(x)).replayed,true);
 await pool.query('DELETE FROM idempotency_records WHERE tenant_id=$1 AND key=$2 AND expires_at<clock_timestamp()',
  [f.tenantId,x.key]);
 const after=await book(x);
 assert.equal(after.status,409);assert.equal(after.body.code,'BOOKING_ALREADY_EXISTS');
 assert.equal((await summary(f)).effective,1);
});

test('E: Booking and full Session cancellation compete without inconsistency',async()=>{
 const f=await fixture(1,2),a=await book(bookingInput(f,0));
 assert.equal(a.status,201);
 const results=await Promise.allSettled([
  book(bookingInput(f,1)),
  cancelSession({tenantId:f.tenantId,actorId:f.managerId,key:key(),operation:'cancelSession',
    sessionId:f.sessionId,reason:'concurrent shutdown'})
 ]);
 assert.ok(results.every(x=>x.status==='fulfilled'));
 const summaryResult=await summary(f);
 assert.equal(summaryResult.status,'CANCELLED');
 assert.equal(summaryResult.effective,0);assert.equal(summaryResult.seats,0);
 assert.equal(summaryResult.activeAlloc,0);
});

test('B: server SQLSTATE versus network failure produces distinct commit classification',async()=>{
 const {serverRejectedTransaction,UnknownCommitOutcome}=await import('../src/db.js');
 assert.equal(serverRejectedTransaction({code:'23514',severity:'ERROR'}),true);
 assert.equal(serverRejectedTransaction({code:'ECONNRESET',message:'socket'}),false);
 assert.equal(serverRejectedTransaction({code:'EPIPE',message:'socket'}),false);
 assert.equal(serverRejectedTransaction({code:'57P01',severity:'FATAL'}),false);
 assert.equal(serverRejectedTransaction({code:'XX000',severity:'PANIC'}),false);
 const unknown=new UnknownCommitOutcome({code:'ECONNRESET'});
 assert.equal(unknown.name,'UnknownCommitOutcome');
});

test('G1: server major version and applied migration checksums are independently queryable',async()=>{
 const version=await pool.query('SHOW server_version_num');
 const major=Math.floor(Number(version.rows[0].server_version_num)/10000);
 assert.equal(major,17,'technical spike runs on the pinned PostgreSQL 17 major');
 const applied=await pool.query('SELECT name,checksum_sha256 FROM spike_migrations ORDER BY name');
 assert.deepEqual(applied.rows.map(r=>r.name),
  ['001_core.sql','002_resource_guard.sql','003_hardening.sql','004_history_consistency.sql']);
 const {createHash}=await import('node:crypto');
 const {readFileSync}=await import('node:fs');
 for(const row of applied.rows){
  const bytes=readFileSync(resolve(process.cwd(),'migrations',row.name));
  assert.equal(row.checksum_sha256,createHash('sha256').update(bytes).digest('hex'));
 }
});

test('B06: Booking state changes without a corresponding historical event cannot commit',async()=>{
 const f=await fixture(1,1),created=await book(bookingInput(f,0));
 assert.equal(created.status,201);
 await assert.rejects(()=>transaction(async c=>{
  await c.query(`UPDATE bookings SET status='CANCELLED',cancelled_at=clock_timestamp(),
   cancel_reason='tampered',updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2`,
   [f.tenantId,created.body.id]);
  await c.query('UPDATE sessions SET seats_committed=0 WHERE tenant_id=$1 AND id=$2',
   [f.tenantId,f.sessionId]);
 }),e=>codeOf(e)==='23514');
 assert.equal((await summary(f)).effective,1);
 assert.equal((await summary(f)).events,1);
});

// Phase 02 final remediation: these are *database* regressions. A source-file
// declaration is not evidence that a PostgreSQL assertion has been executed.
test('H01: extra event INSERT on unchanged CONFIRMED Booking rejects at COMMIT',async()=>{
 const f=await fixture(2,1),created=await book(bookingInput(f,0));
 assert.equal(created.status,201);
 await assert.rejects(()=>pool.query(`INSERT INTO booking_events
   (tenant_id,booking_id,from_status,to_status,actor_id)
   VALUES($1,$2,NULL,'CONFIRMED',$3)`,[f.tenantId,created.body.id,f.managerId]),
   e=>codeOf(e)==='23514');
 assert.equal((await summary(f)).events,1);
});

test('H02: forged terminal event INSERT without changing Booking rejects at COMMIT',async()=>{
 const f=await fixture(2,1),created=await book(bookingInput(f,0));
 assert.equal(created.status,201);
 await assert.rejects(()=>pool.query(`INSERT INTO booking_events
   (tenant_id,booking_id,from_status,to_status,actor_id,reason)
   VALUES($1,$2,'CONFIRMED','CANCELLED',$3,'forged')`,
   [f.tenantId,created.body.id,f.managerId]),e=>codeOf(e)==='23514');
 assert.equal((await summary(f)).events,1);
});

test('H03: invalid event transition is immediately rejected',async()=>{
 const f=await fixture(2,1),created=await book(bookingInput(f,0));
 assert.equal(created.status,201);
 await assert.rejects(()=>pool.query(`INSERT INTO booking_events
   (tenant_id,booking_id,from_status,to_status,actor_id)
   VALUES($1,$2,'CANCELLED','ATTENDED',$3)`,[f.tenantId,created.body.id,f.managerId]),
   e=>codeOf(e)==='23514');
});

test('H04: altered cancellation reason after cancellation is forbidden',async()=>{
 const f=await fixture(2,1),created=await book(bookingInput(f,0));
 assert.equal(created.status,201);
 const cancelled=await cancelBooking({tenantId:f.tenantId,actorId:f.customers[0]!,key:key(),
   operation:'cancelBooking',bookingId:String(created.body.id),reason:'requested'});
 assert.equal(cancelled.status,200);
 await assert.rejects(()=>pool.query(`UPDATE bookings SET cancel_reason='tampered'
   WHERE tenant_id=$1 AND id=$2`,[f.tenantId,created.body.id]),e=>codeOf(e)==='23514');
 await assert.rejects(()=>pool.query(`UPDATE bookings SET cancelled_at=clock_timestamp()
   WHERE tenant_id=$1 AND id=$2`,[f.tenantId,created.body.id]),e=>codeOf(e)==='23514');
 const b=await pool.query('SELECT cancel_reason FROM bookings WHERE id=$1',[created.body.id]);
 assert.equal(b.rows[0].cancel_reason,'requested');
});

test('H05: cancelled Session reason is immutable',async()=>{
 const f=await fixture(2,0);
 const cancelled=await cancelSession({tenantId:f.tenantId,actorId:f.managerId,key:key(),
   operation:'cancelSession',sessionId:f.sessionId,reason:'maintenance'});
 assert.equal(cancelled.status,200);
 await assert.rejects(()=>pool.query(`UPDATE sessions SET cancel_reason='rewritten' WHERE id=$1`,
   [f.sessionId]),e=>codeOf(e)==='23514');
 const s=await pool.query('SELECT cancel_reason,status FROM sessions WHERE id=$1',[f.sessionId]);
 assert.equal(s.rows[0].cancel_reason,'maintenance');
 assert.equal(s.rows[0].status,'CANCELLED');
});

test('H06: cancellation reason of blank string cannot commit',async()=>{
 const f=await fixture(2,1),created=await book(bookingInput(f,0));
 assert.equal(created.status,201);
 await assert.rejects(()=>transaction(async c=>{
   await c.query(`UPDATE bookings SET status='CANCELLED',cancelled_at=clock_timestamp(),
    cancel_reason=' ',updated_at=clock_timestamp() WHERE id=$1`,[created.body.id]);
   await c.query('UPDATE sessions SET seats_committed=0 WHERE id=$1',[f.sessionId]);
   await c.query(`INSERT INTO booking_events(tenant_id,booking_id,from_status,to_status,actor_id,reason)
     VALUES($1,$2,'CONFIRMED','CANCELLED',$3,' ')`,[f.tenantId,created.body.id,f.managerId]);
 }),e=>codeOf(e)==='23514');
 assert.equal((await summary(f)).effective,1);
});

test('H07: logical event order and server-generated timestamp are immutable',async()=>{
 const f=await fixture(2,1),created=await book(bookingInput(f,0));
 assert.equal(created.status,201);
 const events=await pool.query(`SELECT event_order,at FROM booking_events
   WHERE tenant_id=$1 AND booking_id=$2 ORDER BY event_order`,[f.tenantId,created.body.id]);
 assert.equal(events.rowCount,1);
 assert.ok(BigInt(events.rows[0].event_order)>0n);
 await assert.rejects(()=>pool.query(`UPDATE booking_events SET at='2000-01-01T00:00:00Z'
   WHERE booking_id=$1`,[created.body.id]),e=>codeOf(e)==='23514');
});

test('H08: completed cancellation has exactly one initial and one terminal event',async()=>{
 const f=await fixture(2,1),created=await book(bookingInput(f,0));
 assert.equal(created.status,201);
 assert.equal((await cancelBooking({tenantId:f.tenantId,actorId:f.customers[0]!,
   key:key(),operation:'cancelBooking',bookingId:String(created.body.id),reason:'schedule'})).status,200);
 const events=await pool.query(`SELECT from_status,to_status,reason FROM booking_events
   WHERE tenant_id=$1 AND booking_id=$2 ORDER BY event_order`,[f.tenantId,created.body.id]);
 assert.equal(events.rowCount,2);
 assert.equal(events.rows[0].from_status,null);
 assert.equal(events.rows[0].to_status,'CONFIRMED');
 assert.equal(events.rows[1].from_status,'CONFIRMED');
 assert.equal(events.rows[1].to_status,'CANCELLED');
 assert.equal(events.rows[1].reason,'schedule');
});

test('H09: partial direct SQL cancellation with wrong event reason rolls back atomically',async()=>{
 const f=await fixture(2,1),created=await book(bookingInput(f,0));
 assert.equal(created.status,201);
 await assert.rejects(()=>transaction(async c=>{
   await c.query(`SELECT id FROM sessions WHERE id=$1 FOR UPDATE`,[f.sessionId]);
   await c.query(`UPDATE bookings SET status='CANCELLED',cancelled_at=clock_timestamp(),
     cancel_reason='correct',updated_at=clock_timestamp() WHERE id=$1`,[created.body.id]);
   await c.query(`UPDATE sessions SET seats_committed=seats_committed-1 WHERE id=$1`,[f.sessionId]);
   await c.query(`INSERT INTO booking_events(tenant_id,booking_id,from_status,to_status,actor_id,reason)
     VALUES($1,$2,'CONFIRMED','CANCELLED',$3,'wrong')`,[f.tenantId,created.body.id,f.managerId]);
 }),e=>codeOf(e)==='23514');
 assert.equal((await summary(f)).effective,1);
 assert.equal((await summary(f)).events,1);
});

test('H10: resource allocation deactivation metadata becomes immutable',async()=>{
 const f=await fixture(2,0,{room:false});
 assert.equal((await cancelSession({tenantId:f.tenantId,actorId:f.managerId,key:key(),
   operation:'cancelSession',sessionId:f.sessionId,reason:'facility closed'})).status,200);
 await assert.rejects(()=>pool.query(`UPDATE resource_allocations SET deactivated_at=clock_timestamp()
   WHERE session_id=$1`,[f.sessionId]),e=>codeOf(e)==='23514');
 assert.equal((await summary(f)).activeAlloc,0);
});

test('H11: migration 004 is recorded with a matching authentic file checksum',async()=>{
 const {createHash}=await import('node:crypto');
 const {readFileSync}=await import('node:fs');
 const file='004_history_consistency.sql';
 const row=await pool.query('SELECT checksum_sha256 FROM spike_migrations WHERE name=$1',[file]);
 assert.equal(row.rowCount,1);
 assert.equal(row.rows[0].checksum_sha256,createHash('sha256')
   .update(readFileSync(resolve(process.cwd(),'migrations',file))).digest('hex'));
});


test('H12: persisted BookingEvent chain reconciliation reports no drift',async()=>{
 const f=await fixture(2,1),created=await book(bookingInput(f,0));
 assert.equal(created.status,201);
 assert.equal((await cancelBooking({tenantId:f.tenantId,actorId:f.customers[0]!,key:key(),
   operation:'cancelBooking',bookingId:String(created.body.id),reason:'verified'})).status,200);
 const history=await pool.query(bookingHistoryReconciliationSql);
 assert.equal(history.rows.length,0,'booking history reconciliation must be empty');
});
