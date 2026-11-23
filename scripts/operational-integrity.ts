/** Read-only, tenant-bound inspection: no API route, no generic UPDATE privilege. */
import {Pool,type PoolClient} from 'pg';
import {validateScope} from '../apps/api/src/modules/operations/operations.domain';
export async function inspect(tenantId:string,limit=100):Promise<unknown>{
 validateScope(tenantId,limit);
 const url=process.env.BOOKCORE_INSPECT_DATABASE_URL;
 if(!url || !/^postgres(?:ql)?:\/\//.test(url))throw new Error('INSPECTOR_CREDENTIAL_REQUIRED');
 const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:5000,application_name:'bookcore-inspect'});
 let client:PoolClient|undefined;let active=false;let commitStarted=false;let broken=false;
 try{client=await pool.connect();}catch(err){await pool.end();throw err;}
 try{
  await client.query('BEGIN READ ONLY');active=true;
  await client.query("SET LOCAL statement_timeout='15000ms'");
  const r=await client.query<{result:unknown}>(`SELECT public.bookcore_inspect_tenant($1::uuid,$2::int) AS result`,[tenantId,limit]);
  commitStarted=true;await client.query('COMMIT');active=false;
  return r.rows[0]?.result;
 }catch(err){if(active)try{await client.query('ROLLBACK');}catch{broken=true;}throw err;}
 finally{client.release(broken||(commitStarted&&active));await pool.end();}
}
if(require.main===module){
 const [tenant,rawLimit]=process.argv.slice(2);
 inspect(tenant??'',rawLimit===undefined?100:Number(rawLimit))
  .then(result=>{process.stdout.write(JSON.stringify(result)+'\n');})
  .catch(()=>{process.stderr.write('Inspection denied or unavailable; consult operator runbook.\n');process.exitCode=1;});
}
