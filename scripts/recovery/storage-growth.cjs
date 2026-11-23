'use strict';
const {checkPgEnvironment,parseArgs}=require('./policy.cjs');const {run}=require('./exec.cjs');
// This query uses catalog estimates rather than scanning business rows. Requires read-only monitoring login.
const QUERY=`SELECT json_build_object('sampledAt',clock_timestamp(),'tables',COALESCE(json_agg(
 json_build_object('table',c.relname,'estimatedRows',COALESCE(s.n_live_tup,0),
 'totalBytes',pg_total_relation_size(c.oid),'indexBytes',pg_indexes_size(c.oid))
 ORDER BY c.relname),'[]'::json)) FROM pg_class c
 JOIN pg_namespace ns ON ns.oid=c.relnamespace
 LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
 WHERE ns.nspname='public' AND c.relkind IN ('r','p') AND c.relname=ANY(ARRAY[
 'bookings','booking_events','audit_events','outbox_events','processed_outbox_events',
 'idempotency_records','auth_sessions','refresh_tokens','staff_invitations','booking_consents']);`;
async function measure(env=process.env){
 checkPgEnvironment(env);
 if(env.BOOKCORE_MONITORING_ROLE_APPROVED!=='yes')throw new Error('MONITORING_ROLE_NOT_APPROVED');
 const raw=await run('psql',['--no-psqlrc','--tuples-only','--no-align','--set','ON_ERROR_STOP=1',
  '--command','BEGIN READ ONLY; '+QUERY+' COMMIT;'],env,{timeoutMs:20000});
 // psql outputs JSON and a COMMIT line; fail closed on unexpected format.
 const item=raw.split('\n').find(x=>x.startsWith('{'));if(!item)throw new Error('MONITOR_QUERY_FAILED');
 return JSON.parse(item);
}
if(require.main===module){measure().then(v=>process.stdout.write(JSON.stringify(v)+'\n')).catch(()=>{
 process.stderr.write('Storage diagnostics unavailable.\n');process.exitCode=1;});}
module.exports={measure,QUERY};
