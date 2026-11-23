import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool, transaction, one } from './db.js';

export type Fixture={tenantId:string; sessionId:string; managerId:string;trainerId:string; roomId:string;
  branchId:string; serviceId:string; trainerResourceId:string;customers:string[];startAt:Date; endAt:Date};
export async function createUser(c:PoolClient):Promise<string> {
 const id=randomUUID(); await c.query(`INSERT INTO users(id,email) VALUES($1,$2)`,[id,`${id}@test.invalid`]);return id;
}
export async function fixture(capacity:number, count=100, opts?:{room?:boolean;buffer?:number;startAt?:Date}):Promise<Fixture> {
 return transaction(async c=>{
   const tenantId=randomUUID(),branchId=randomUUID(),serviceId=randomUUID(),sessionId=randomUUID();
   const managerId=await createUser(c),trainerId=await createUser(c);
   await c.query('INSERT INTO organizations(id,name,timezone) VALUES($1,$2,$3)',[tenantId,'Test Facility','Asia/Tehran']);
   await c.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER'),($1,$3,'TRAINER')`,[tenantId,managerId,trainerId]);
   await c.query('INSERT INTO branches(id,tenant_id,name) VALUES($1,$2,$3)',[branchId,tenantId,'Main']);
   await c.query('INSERT INTO services(id,tenant_id,title,duration_min) VALUES($1,$2,$3,60)',[serviceId,tenantId,'Test Class']);
   const trainerResourceId=randomUUID(),roomId=randomUUID();
   const before=opts?.buffer??0;
   await c.query(`INSERT INTO resources(id,tenant_id,type,trainer_user_id,display_name,buffer_before_min,buffer_after_min)
     VALUES($1,$2,'TRAINER',$3,'Test Trainer',$4,$4)`,[trainerResourceId,tenantId,trainerId,before]);
   if(opts?.room!==false){await c.query(`INSERT INTO resources(id,tenant_id,branch_id,type,display_name)
     VALUES($1,$2,$3,'ROOM','Test Room')`,[roomId,tenantId,branchId]);}
   const startAt=opts?.startAt??new Date(Date.now()+7*86400000),endAt=new Date(startAt.getTime()+3600000);
   await c.query(`INSERT INTO sessions(id,tenant_id,branch_id,service_id,trainer_resource_id,room_resource_id,
       start_at,end_at,timezone_snapshot,status,capacity_total,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Asia/Tehran','PUBLISHED',$9,$10)`,
      [sessionId,tenantId,branchId,serviceId,trainerResourceId,opts?.room===false?null:roomId,startAt,endAt,capacity,managerId]);
   await c.query(`INSERT INTO resource_allocations(tenant_id,session_id,resource_id,start_at,end_at)
      VALUES($1,$2,$3,$4,$5)`,[tenantId,sessionId,trainerResourceId,new Date(startAt.getTime()-before*60000),new Date(endAt.getTime()+before*60000)]);
   if(opts?.room!==false){await c.query(`INSERT INTO resource_allocations(tenant_id,session_id,resource_id,start_at,end_at)
      VALUES($1,$2,$3,$4,$5)`,[tenantId,sessionId,roomId,startAt,endAt]);}
   const customers:string[]=[];
   for(let i=0;i<count;i++){const id=await createUser(c);customers.push(id);}
   return {tenantId,sessionId,managerId,trainerId,roomId,branchId,serviceId,trainerResourceId,customers,startAt,endAt};
 });
}
export async function createSiblingSession(f:Fixture, start:Date,end:Date,
  options?:{trainerResourceId?:string;roomId?:string|null;branchId?:string;status?:string}){
 const id=randomUUID();
 await transaction(async c=>{
   const trainer=options?.trainerResourceId??f.trainerResourceId;
   const room=options?.roomId===undefined?null:options.roomId;
   await c.query(`INSERT INTO sessions(id,tenant_id,branch_id,service_id,trainer_resource_id,room_resource_id,
      start_at,end_at,timezone_snapshot,status,capacity_total,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Asia/Tehran',$9,10,$10)`,
     [id,f.tenantId,options?.branchId??f.branchId,f.serviceId,trainer,room,start,end,options?.status??'DRAFT',f.managerId]);
   const tr=await one<{buffer_before_min:number;buffer_after_min:number}>(c,
     'SELECT buffer_before_min,buffer_after_min FROM resources WHERE id=$1',[trainer]);
   if(!tr)throw new Error('missing trainer');
   await c.query(`INSERT INTO resource_allocations(tenant_id,session_id,resource_id,start_at,end_at)
    VALUES($1,$2,$3,$4,$5)`,[f.tenantId,id,trainer,
      new Date(start.getTime()-tr.buffer_before_min*60000),new Date(end.getTime()+tr.buffer_after_min*60000)]);
   if(room){const r=await one<{buffer_before_min:number;buffer_after_min:number}>(c,
       'SELECT buffer_before_min,buffer_after_min FROM resources WHERE id=$1',[room]);
     if(!r)throw new Error('missing room');
     await c.query(`INSERT INTO resource_allocations(tenant_id,session_id,resource_id,start_at,end_at)
      VALUES($1,$2,$3,$4,$5)`,[f.tenantId,id,room,
      new Date(start.getTime()-r.buffer_before_min*60000),new Date(end.getTime()+r.buffer_after_min*60000)]);
   }
 });
 return id;
}
export async function summary(f:Fixture):Promise<{status:string;seats:number;effective:number;events:number;outbox:number;activeAlloc:number}> {
 const r=await pool.query(`SELECT s.status,s.seats_committed::int AS seats,
 (SELECT count(*)::int FROM bookings b WHERE b.tenant_id=s.tenant_id AND b.session_id=s.id AND b.status IN('CONFIRMED','ATTENDED','NO_SHOW')) AS effective,
 (SELECT count(*)::int FROM booking_events e JOIN bookings b ON b.id=e.booking_id WHERE b.session_id=s.id) AS events,
 (SELECT count(*)::int FROM outbox_events o WHERE o.tenant_id=s.tenant_id AND
  (o.aggregate_id=s.id OR o.aggregate_id IN (SELECT id FROM bookings WHERE session_id=s.id))) AS outbox,
 (SELECT count(*)::int FROM resource_allocations a WHERE a.session_id=s.id AND a.active) AS "activeAlloc"
 FROM sessions s WHERE s.id=$1`,[f.sessionId]);
 const x=r.rows[0];return {status:x.status,seats:x.seats,effective:x.effective,events:x.events,outbox:x.outbox,activeAlloc:x.activeAlloc};
}
