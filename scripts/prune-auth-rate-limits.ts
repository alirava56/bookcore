/** Legacy unrestricted cleanup intentionally disabled; see lifecycle-maintenance.ts. */
export async function pruneAuthRateLimits():Promise<never>{
 throw new Error('LEGACY_UNBOUNDED_MAINTENANCE_DISABLED');
}
if(require.main===module){
 process.stderr.write('Legacy maintenance disabled. Use restricted lifecycle-maintenance CLI.\n');
 process.exitCode=1;
}
