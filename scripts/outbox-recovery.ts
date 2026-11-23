/** Bound operational identity comes ONLY from PostgreSQL session_user -> operator registry.
 * OUTBOX_OPS_DATABASE_URL must use a dedicated per-operator LOGIN role (direct connection).
 * list TENANT_UUID | retry TENANT_UUID EVENT_UUID "reason at least 10 chars"
 */
import {Pool} from 'pg';
import {UUID_PATTERN,requireReason} from '../apps/api/src/modules/operations/operations.domain';
async function main():Promise<void>{
 const [command,tenant,event,reason]=process.argv.slice(2);
 const url=process.env.OUTBOX_OPS_DATABASE_URL;
 if(!url||!/^postgres(?:ql)?:\/\//.test(url)||!UUID_PATTERN.test(tenant??'')||
  !['list','retry'].includes(command??''))throw new Error('OPERATOR_INPUT_INVALID');
 if(command==='retry'&&!UUID_PATTERN.test(event??''))throw new Error('OPERATOR_INPUT_INVALID');
 const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:5000,application_name:'bookcore-ops'});
 try{
  if(command==='list'){
   const r=await pool.query(`SELECT * FROM public.bookcore_list_quarantined_outbox($1::uuid)`,[tenant]);
   process.stdout.write(JSON.stringify({count:r.rows.length,items:r.rows})+'\n');
  }else{
   const validReason=requireReason(reason);
   const r=await pool.query<{requeued:boolean}>(`SELECT public.bookcore_requeue_outbox_bound($1::uuid,$2::uuid,$3::text) AS requeued`,
    [tenant,event,validReason]);
   if(!r.rows[0]?.requeued)throw new Error('QUARANTINE_EVENT_NOT_FOUND');
   process.stdout.write(JSON.stringify({status:'REQUEUED'})+'\n');
  }
 }finally{await pool.end();}
}
if(require.main===module)main().catch(()=>{
 process.stderr.write('Outbox recovery denied or unavailable; inspect authorized operator configuration.\n');
 process.exitCode=1;
});
