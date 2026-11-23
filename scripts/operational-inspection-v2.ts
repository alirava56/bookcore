import {requireValue} from '../apps/api/src/common/require-value';
/** Phase 11: privilege-separated, read-only, bounded, resumable PostgreSQL inspection. */
import {Pool,type PoolClient} from 'pg';
import {UUID_PATTERN} from '../apps/api/src/modules/operations/operations.domain';
import {INSPECTION_KINDS,validKind,validateInspectionOptions,sealInspectionCursor,
 openInspectionCursor,validateInspectionPage,inspectionCompletion,type InspectionKind,type InspectionPage} from
 '../apps/api/src/modules/operations/inspection.domain';
export type Options={tenant:string;kind:InspectionKind;limit:number;maxPages:number;all:boolean;cursor?:string};
export type InspectionSummary={tenantId:string;asOf:string|null;readOnly:true;
 completedKinds:InspectionKind[];incompleteKinds:InspectionKind[];pages:number;scanned:number;
 findings:Record<string,unknown>[];cursors:Record<string,string>;
 coverageComplete:boolean;selectedScopeComplete:boolean;allSupportedKindsCovered:boolean;
 consistentSnapshot:false;certifiedIntegrity:false};
export async function scanTenant(options:Options):Promise<InspectionSummary>{
 validateInspectionOptions(options.kind,options.limit,options.maxPages,options.all);
 if(!UUID_PATTERN.test(options.tenant))throw new Error('TENANT_UUID_REQUIRED');
 if(options.all&&options.cursor)throw new Error('MULTI_KIND_RESUME_UNSUPPORTED');
 const url=process.env.BOOKCORE_INSPECT_DATABASE_URL;
 if(!url||!/^postgres(?:ql)?:\/\//.test(url))throw new Error('INSPECTOR_CREDENTIAL_REQUIRED');
 const secret=process.env.BOOKCORE_INSPECTION_CURSOR_KEY;
 if(!secret)throw new Error('INSPECTION_SIGNING_KEY_REQUIRED');
 const kinds:readonly InspectionKind[]=options.all?INSPECTION_KINDS:[options.kind];
 const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:5000,application_name:'bookcore-inspection-v2'});
 const summary:InspectionSummary={tenantId:options.tenant,asOf:null,readOnly:true,
  completedKinds:[],incompleteKinds:[],pages:0,scanned:0,findings:[],cursors:{},
  coverageComplete:false,selectedScopeComplete:false,allSupportedKindsCovered:false,
  consistentSnapshot:false,certifiedIntegrity:false};
 try {
  for(const kind of kinds){
   const parsed=options.cursor?openInspectionCursor(options.cursor,secret,options.tenant,kind):undefined;
   let after=parsed?.after??null;
   if(parsed)summary.asOf=parsed.asOf;
   let finished=false;
   for(let index=0;index<options.maxPages;index++){
    let client:PoolClient|undefined;let started=false;let committing=false;let bad=false;
    let value:unknown;
    try {
     client=await pool.connect();
     await client.query('BEGIN READ ONLY');started=true;
     await client.query("SET LOCAL statement_timeout='12000ms'");
     const rs=await client.query<{result:unknown}>(
      'SELECT public.bookcore_inspect_tenant_page($1::uuid,$2::text,$3::text,$4::timestamptz,$5::int) AS result',
      [options.tenant,kind,after,summary.asOf,options.limit]);
     value=rs.rows[0]?.result;
     committing=true;await client.query('COMMIT');started=false;
    }catch(err){if(started&&client)try{await client.query('ROLLBACK');started=false;}catch{bad=true;}throw err;}
    finally{if(client)client.release(bad||(started&&committing));}
    const page:InspectionPage=validateInspectionPage(value,options.tenant,kind,options.limit);
    if(summary.asOf && summary.asOf!==page.asOf)throw new Error('INSPECTION_ASOF_CHANGED');
    summary.asOf=page.asOf;
    summary.pages++;summary.scanned+=page.inspected;
    summary.findings.push(...page.findings.map(f=>({...f,kind})));
    if(!page.hasMore){finished=true;break;}
    if(page.nextAfter===after)throw new Error('INSPECTION_CURSOR_NOT_ADVANCING');
    after=page.nextAfter;
   }
   if(finished)summary.completedKinds.push(kind);
   else {
    summary.incompleteKinds.push(kind);
    if(after && summary.asOf)summary.cursors[kind]=sealInspectionCursor({
     v:1,tenant:options.tenant,kind,after,asOf:summary.asOf},secret);
   }
  }
  const completion=inspectionCompletion(options.all,summary.incompleteKinds.length,summary.findings.length);
  summary.selectedScopeComplete=completion.selectedScopeComplete;
  summary.allSupportedKindsCovered=completion.allSupportedKindsCovered;
  summary.coverageComplete=summary.allSupportedKindsCovered;
  return summary;
 }finally{await pool.end();}
}
function parseArgs(argv:string[]):Options{
 const params=new Map<string,string>();const bools=new Set<string>();
 for(let i=0;i<argv.length;i++){
  const arg=requireValue(argv[i]);
  if(arg==='--all')bools.add(arg);
  else if(['--tenant','--kind','--limit','--max-pages','--cursor'].includes(arg)){
   if(!argv[i+1])throw new Error('INSPECTION_ARGUMENT_REQUIRED');
   params.set(arg,requireValue(argv[++i]));
  }else throw new Error('INSPECTION_ARGUMENT_UNKNOWN');
 }
 const kind=params.get('--kind')??'SESSION';
 if(!validKind(kind))throw new Error('INSPECTION_KIND_INVALID');
 return {tenant:params.get('--tenant')??'',kind,limit:Number(params.get('--limit')??'50'),
  maxPages:Number(params.get('--max-pages')??'10'),all:bools.has('--all'),cursor:params.get('--cursor')};
}
if(require.main===module){
 const args=process.argv.slice(2);
 try{const options=parseArgs(args);scanTenant(options).then(result=>{
  process.stdout.write(JSON.stringify(result)+'\n');
  if(!result.selectedScopeComplete)process.exitCode=3;
  else if(result.findings.length)process.exitCode=2;
 }).catch(()=>{process.stderr.write('Inspection denied or unavailable; review restricted runbook.\n');process.exitCode=1;});}
 catch{process.stderr.write('Invalid inspection options.\n');process.exitCode=1;}
}
