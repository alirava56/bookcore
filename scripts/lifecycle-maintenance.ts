/** Deliberately limited maintenance. No idempotency or business-history deletion. */
import {Pool,type PoolClient} from 'pg';
import {requireReason,validateMaintenance,IDEMPOTENCY_PURGE_ALLOWED} from '../apps/api/src/modules/operations/operations.domain';
export async function pruneRateBuckets(limit:number,ageHours:number,reason:string,apply=false):Promise<{apply:boolean;affected:number}>{
 validateMaintenance(limit,ageHours);
 const safeReason=requireReason(reason);
 const url=process.env.BOOKCORE_MAINTENANCE_DATABASE_URL;
 if(!url || !/^postgres(?:ql)?:\/\//.test(url))throw new Error('MAINTENANCE_CREDENTIAL_REQUIRED');
 const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:5000,application_name:'bookcore-maintenance'});
 let client:PoolClient;try{client=await pool.connect();}catch(err){await pool.end();throw err;}
 let active=false,commitStarted=false,broken=false;
 try{
  await client.query('BEGIN');active=true;
  await client.query("SET LOCAL lock_timeout='2000ms'");
  await client.query("SET LOCAL statement_timeout='10000ms'");
  const r=await client.query<{affected:number}>(`SELECT public.bookcore_prune_auth_rate_buckets(
    $1::int,$2::int,$3::text,$4::boolean) AS affected`,[limit,ageHours,safeReason,apply]);
  const affected=Number(r.rows[0]?.affected??0);
  commitStarted=true;await client.query('COMMIT');active=false;
  return {apply,affected};
 }catch(err){if(active && !commitStarted)try{await client.query('ROLLBACK');}catch{broken=true;}throw err;}
 finally{client.release(broken||(commitStarted&&active));await pool.end();}
}
if(require.main===module){
 const [action,limitRaw,ageRaw,...reasonParts]=process.argv.slice(2);
 const apply=action==='apply';
 if(!['preview','apply'].includes(action??'') || IDEMPOTENCY_PURGE_ALLOWED){
  process.stderr.write('Unknown maintenance action.\n');process.exitCode=1;
 }else{
  pruneRateBuckets(Number(limitRaw),Number(ageRaw),reasonParts.join(' '),apply)
  .then(r=>{process.stdout.write(JSON.stringify(r)+'\n');})
  .catch(()=>{process.stderr.write('Maintenance denied or unavailable.\n');process.exitCode=1;});
 }
}
