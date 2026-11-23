import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {request as httpRequest} from 'node:http';
import {buildApplication} from '../../src/bootstrap';
import {parseConfig} from '../../src/config/app-config';
/** Full-stack smoke test: real HTTP/NestJS/Argon2/JWT/PostgreSQL17 only. Cannot pass with database mocks. */
const must=['DATABASE_URL','MIGRATION_DATABASE_URL','AUTH_JWT_ISSUER','AUTH_JWT_AUDIENCE',
 'AUTH_JWT_ACTIVE_KID','AUTH_JWT_KEYS_JSON','MONITOR_API_KEY'];
if(process.env.BOOKCORE_TEST_DATABASE_DISPOSABLE!=='yes'||must.some(x=>!process.env[x]))
 throw new Error('PHASE11_REAL_DISPOSABLE_POSTGRESQL17_AND_NESTJS_CONFIG_REQUIRED');
const config=parseConfig({...process.env,NODE_ENV:'test'});
type Response={status:number;body:Record<string,unknown>};
test('MVP workflows: register → org → invitation → resource → session → booking/consent → reports/outbox',
 {timeout:180000},async()=>{
 const app=await buildApplication(config);await app.listen(0,'127.0.0.1');
 const db=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:3});
 const base=`http://127.0.0.1:${(app.getHttpServer().address() as {port:number}).port}/api/v1`;
 const request=async(path:string,method='GET',token?:string,body?:unknown,key?:string):Promise<Response>=>{
  const payload=body===undefined?undefined:JSON.stringify(body);
  return new Promise((resolve,reject)=>{
   // The identity suite exercises real IP limits on its own loopback address.
   const req=httpRequest(base+path,{localAddress:'127.0.0.2',method,headers:{
    ...(token?{authorization:`Bearer ${token}`}:{}),...(key?{'idempotency-key':key}:{}),
    ...(payload===undefined?{}:{'content-type':'application/json','content-length':Buffer.byteLength(payload)}),
   }},res=>{
    res.setEncoding('utf8');let raw='';
    res.on('data',chunk=>{raw+=String(chunk);});res.on('error',reject);
    res.on('end',()=>{
     try{resolve({status:res.statusCode??0,body:raw?JSON.parse(raw):{}});}catch(error){reject(error);}
    });
   });
   req.setTimeout(10000,()=>req.destroy(new Error('MVP_HTTP_TIMEOUT')));
   req.on('error',reject);req.end(payload);
  });
 };
 const createAccount=async()=>{
  const email=`p11-${randomUUID()}@example.invalid`,password=`P11-${randomUUID()}-VeryStrong`;
  const reg=await request('/auth/register','POST',undefined,{email,password});
  assert.equal(reg.status,201,JSON.stringify(reg.body));
  const login=await request('/auth/login','POST',undefined,{email,password});
  assert.equal(login.status,200,JSON.stringify(login.body));
  return {userId:reg.body.id as string,token:login.body.accessToken as string};
 };
 try{
  const owner=await createAccount(),trainer=await createAccount(),customer=await createAccount(),assisted=await createAccount();
  const org=await request('/organizations','POST',owner.token,{name:'Phase 11 Gym',timezone:'Asia/Tehran'});
  assert.equal(org.status,201,JSON.stringify(org.body));const id=org.body.id as string;
  // Current users are not staff just because their global User exists.
  const cannotRead=await request(`/organizations/${id}/members`,'GET',customer.token);
  assert.ok([403,404].includes(cannotRead.status));
  const invite=await request(`/organizations/${id}/staff-invitations`,'POST',owner.token,
   {userId:trainer.userId,role:'TRAINER'});
  assert.equal(invite.status,201,JSON.stringify(invite.body));
  const accepted=await request('/me/staff-invitations/accept','POST',trainer.token,{token:invite.body.token});
  assert.equal(accepted.status,200,JSON.stringify(accepted.body));
  assert.notEqual((await request('/me/staff-invitations/accept','POST',trainer.token,
   {token:invite.body.token})).status,200);
  const declined=await request(`/organizations/${id}/staff-invitations`,'POST',owner.token,
   {userId:customer.userId,role:'RECEPTIONIST'});
  assert.equal(declined.status,201);
  assert.equal((await request('/me/staff-invitations/decline','POST',customer.token,{token:declined.body.token})).status,200);
  assert.equal((await db.query(`SELECT status FROM staff_invitations WHERE tenant_id=$1 AND id=$2`,[id,declined.body.id])).rows[0]?.status,'DECLINED');
  const branch=await request(`/organizations/${id}/branches`,'POST',owner.token,{name:'Main Branch'});
  const service=await request(`/organizations/${id}/services`,'POST',owner.token,{title:'Private Coaching',durationMin:60});
  const resource=await request(`/organizations/${id}/resources`,'POST',owner.token,
   {type:'TRAINER',displayName:'Test Coach',trainerUserId:trainer.userId});
  for(const r of [branch,service,resource])assert.equal(r.status,201,JSON.stringify(r.body));
  const room=await request(`/organizations/${id}/resources`,'POST',owner.token,
   {type:'ROOM',displayName:'Synthetic Room',branchId:branch.body.id});
  assert.equal(room.status,201,JSON.stringify(room.body));
  for(const path of ['members','services','resources','schedule-exceptions'])
   assert.equal((await request(`/organizations/${id}/${path}`,'GET',owner.token)).status,200);
  for(let day=1;day<=7;day++)for(const scope of [{branchId:branch.body.id},{resourceId:resource.body.id}]){
   const hours=await request(`/organizations/${id}/business-hours`,'POST',owner.token,
    {...scope,isoWeekday:day,startLocal:'00:00',endLocal:'23:59',endDayOffset:0});
   assert.equal(hours.status,201,JSON.stringify(hours.body));
  }
  const future=new Date(Date.now()+10*86400000);future.setUTCHours(10,0,0,0);
  const day=future.toISOString().slice(0,10);
  const session=await request(`/organizations/${id}/sessions`,'POST',owner.token,
   {branchId:branch.body.id,serviceId:service.body.id,trainerResourceId:resource.body.id,
    startAt:`${day}T13:30:00+03:30`,endAt:`${day}T14:30:00+03:30`,capacityTotal:4},randomUUID());
  assert.equal(session.status,201,JSON.stringify(session.body));const sid=session.body.id as string;
  assert.equal((await request(`/public/organizations/${id}/sessions/${sid}`)).status,404);
  assert.equal((await request(`/organizations/${id}/sessions/${sid}/publish`,'POST',owner.token)).status,200);
  assert.equal((await request(`/public/organizations/${id}/sessions/${sid}`)).status,200);
  const staffSessions=await request(`/organizations/${id}/sessions`,'GET',owner.token);
  assert.equal(staffSessions.status,200);
  const from=new Date(future.getTime()-86400000).toISOString();
  const to=new Date(future.getTime()+86400000).toISOString();
  const window=`from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const publicSessions=await request(`/public/organizations/${id}/sessions?${window}`);
  assert.equal(publicSessions.status,200,JSON.stringify(publicSessions.body));
  const selfKey=randomUUID();const self=await request(`/organizations/${id}/sessions/${sid}/bookings`,
   'POST',customer.token,{},selfKey);
  assert.equal(self.status,201,JSON.stringify(self.body));
  const replay=await request(`/organizations/${id}/sessions/${sid}/bookings`,
   'POST',customer.token,{},selfKey);
  assert.equal(replay.status,201);assert.equal(replay.body.id,self.body.id);
  const history=await request(`/organizations/${id}/bookings/me`,'GET',customer.token);
  assert.equal(history.status,200);
  const items:unknown=history.body.items;
  assert.ok(Array.isArray(items)&&items.some((item:unknown)=>
   item!==null&&typeof item==='object'&&'id' in item&&item.id===self.body.id));
  const consent=await request(`/organizations/${id}/booking-consents`,'POST',assisted.token,{durationDays:1});
  assert.equal(consent.status,201,JSON.stringify(consent.body));
  assert.equal((await request(`/organizations/${id}/booking-consents/me`,'GET',assisted.token)).status,200);
  const onBehalf=await request(`/organizations/${id}/sessions/${sid}/bookings`,
   'POST',owner.token,{customerId:assisted.userId},randomUUID());
  assert.equal(onBehalf.status,201,JSON.stringify(onBehalf.body));
  const ownerVsCustomer=await db.query<{created_by_actor_id:string;customer_id:string}>(
   `SELECT created_by_actor_id,customer_id FROM bookings WHERE id=$1`,[onBehalf.body.id]);
  assert.equal(ownerVsCustomer.rows[0]?.created_by_actor_id,owner.userId);
  assert.equal(ownerVsCustomer.rows[0]?.customer_id,assisted.userId);
  const cancel=await request(`/organizations/${id}/bookings/${self.body.id}/cancel`,
   'POST',customer.token,{},randomUUID());
  assert.equal(cancel.status,200,JSON.stringify(cancel.body));
  const state=await db.query<{seats_committed:number}>(`SELECT seats_committed FROM sessions WHERE id=$1`,[sid]);
  assert.equal(state.rows[0]?.seats_committed,1);
  const report=await request(`/organizations/${id}/reports/occupancy?${window}`,
   'GET',owner.token);
  assert.equal(report.status,200,JSON.stringify(report.body));
  assert.ok(!JSON.stringify(report.body).includes(assisted.userId),'report must not leak customer id');
  const events=await db.query<{n:string}>(`SELECT count(*)::text AS n FROM outbox_events
    WHERE tenant_id=$1 AND event_type='BookingConfirmed'`,[id]);
  assert.equal(events.rows[0]?.n,'2');
  // Seed a session whose end has already passed, so the real finish and attendance routes can run now.
  const c=await db.connect();
  let pastId:string|undefined;
  const pastBookings:string[]=[];
  try{
   await c.query('BEGIN');
   const past=await c.query<{id:string}>(`INSERT INTO sessions
    (tenant_id,branch_id,service_id,trainer_resource_id,start_at,end_at,timezone_snapshot,status,capacity_total,created_by)
    VALUES($1,$2,$3,$4,clock_timestamp()-interval '1 day 1 hour',clock_timestamp()-interval '1 day',
     'Asia/Tehran','PUBLISHED',2,$5) RETURNING id`,[id,branch.body.id,service.body.id,resource.body.id,owner.userId]);
   pastId=past.rows[0]?.id;assert.ok(pastId);
   await c.query(`INSERT INTO resource_allocations(tenant_id,session_id,resource_id,start_at,end_at)
    SELECT tenant_id,id,trainer_resource_id,start_at,end_at FROM sessions WHERE tenant_id=$1 AND id=$2`,[id,pastId]);
   for(const client of [customer,assisted]){
    const booking=await c.query<{id:string}>(`INSERT INTO bookings(tenant_id,session_id,customer_id,created_by_actor_id)
     VALUES($1,$2,$3,$3) RETURNING id`,[id,pastId,client.userId]);
    const bookingId=booking.rows[0]?.id;assert.ok(bookingId);pastBookings.push(bookingId);
    await c.query(`INSERT INTO booking_events(tenant_id,booking_id,from_status,to_status,actor_id)
     VALUES($1,$2,NULL,'CONFIRMED',$3)`,[id,bookingId,client.userId]);
   }
   await c.query('UPDATE sessions SET seats_committed=2 WHERE tenant_id=$1 AND id=$2',[id,pastId]);
   await c.query('COMMIT');
  }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
  assert.equal((await request(`/organizations/${id}/sessions/${pastId}/finish`,'POST',owner.token)).status,200);
  const [attendance,cancelRace]=await Promise.all([
   request(`/organizations/${id}/bookings/${pastBookings[0]}/attendance`,'POST',trainer.token,{status:'ATTENDED'},randomUUID()),
   request(`/organizations/${id}/bookings/${pastBookings[0]}/cancel`,'POST',customer.token,{},randomUUID()),
  ]);
  assert.equal(attendance.status,200,JSON.stringify(attendance.body));assert.equal(cancelRace.status,409);
  assert.equal((await request(`/organizations/${id}/bookings/${pastBookings[1]}/attendance`,'POST',owner.token,{status:'NO_SHOW'},randomUUID())).status,200);
  const final=await db.query<{status:string;seats_committed:number;outcomes:string[]}>(`SELECT s.status,s.seats_committed,
   ARRAY(SELECT b.status FROM bookings b WHERE b.tenant_id=s.tenant_id AND b.session_id=s.id ORDER BY b.status) AS outcomes
   FROM sessions s WHERE s.tenant_id=$1 AND s.id=$2`,[id,pastId]);
  assert.deepEqual(final.rows[0],{status:'FINISHED',seats_committed:2,outcomes:['ATTENDED','NO_SHOW']});
 }finally{await db.end();await app.close();}
});
