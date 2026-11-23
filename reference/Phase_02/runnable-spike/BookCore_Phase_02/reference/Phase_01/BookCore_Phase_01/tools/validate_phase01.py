#!/usr/bin/env python3
"""BookCore Phase 01 design-only static contract checks, no network or backend.

Requires ruamel.yaml, PyYAML, fastapi>=0.128, jsonschema>=4. Re-runnable:
  python tools/validate_phase01.py
Writes docs/verification/STATIC_DESIGN_VALIDATION.md, exits 1 if any actual check fails.
Does NOT execute an API, database, test suite, deployment or official OAS reference validator.
"""
from __future__ import annotations
import collections, hashlib, re, sys, json
from pathlib import Path
from typing import Any
from importlib.metadata import version, PackageNotFoundError
ROOT=Path(__file__).resolve().parents[1]
DOCS=ROOT/'docs'
REPORT=DOCS/'verification/STATIC_DESIGN_VALIDATION.md'
BASELINE_SHA256='3eb10bbc6a2679db4f70b7ef574369a2bf8b315b9585cb3b504ed4cf46609da5'
checks=[]
def check(label:str, ok:bool, details:str):
 checks.append((label,'PASS' if ok else 'FAIL',details))
def unverified(label:str,details:str): checks.append((label,'NOT VERIFIED',details))
def v(package):
 try:return version(package)
 except PackageNotFoundError:return 'unavailable'
def refs(node:Any,loc='root'):
 if isinstance(node,dict):
  for k,val in node.items():
   if k=='$ref': yield loc,val
   else: yield from refs(val,loc+'/'+str(k))
 elif isinstance(node,list):
  for i,item in enumerate(node): yield from refs(item,loc+f'/{i}')
def resolve(obj,ref):
 if not isinstance(ref,str) or not ref.startswith('#/'):raise ValueError('Non-local reference: '+repr(ref))
 for key in ref[2:].split('/'):
  key=key.replace('~1','/').replace('~0','~')
  obj=obj[key]
 return obj
def operations(oas):return [(p,m,op) for p,methods in oas['paths'].items() for m,op in methods.items() if m in {'get','post','put','patch','delete','head','options','trace'}]
check('Baseline original unchanged', (ROOT/'BOOKCORE_SOFTWARE_ENGINEERING_BLUEPRINT_FA.md').exists() and hashlib.sha256((ROOT/'BOOKCORE_SOFTWARE_ENGINEERING_BLUEPRINT_FA.md').read_bytes()).hexdigest()==BASELINE_SHA256, 'BC-SENG-001 original SHA256='+BASELINE_SHA256)
try:
 from ruamel.yaml import YAML
 y=YAML(typ='safe');y.allow_duplicate_keys=False
 oas=y.load((DOCS/'api/openapi.yaml').read_text())
 check('Strict YAML parse + duplicate-key rejection',True,'ruamel.yaml '+v('ruamel.yaml')+'; allow_duplicate_keys=False; parsed full OpenAPI source')
except Exception as e:
 check('Strict YAML parse + duplicate-key rejection',False,type(e).__name__+': '+str(e)[:180]); oas=None
if oas:
 ops=operations(oas)
 check('OpenAPI 3.1 root keys and method count',oas.get('openapi')=='3.1.0' and len(ops)==38 and len(oas['paths'])==31,'Found '+str(len(ops))+' operations in '+str(len(oas['paths']))+' path objects')
 try:
  from fastapi.openapi.models import OpenAPI
  m=OpenAPI.model_validate(oas)
  check('OpenAPI structural model validation',m.openapi=='3.1.0','FastAPI '+v('fastapi')+' OpenAPI Pydantic model validated entire document; not the official OpenAPI JSON meta-schema')
 except Exception as e:
  check('OpenAPI structural model validation',False,str(e)[:400])
 try:
  from jsonschema import Draft202012Validator, FormatChecker
  for name,sch in oas['components']['schemas'].items(): Draft202012Validator.check_schema(sch)
  check('Component JSON Schema meta-validation',True,str(len(oas['components']['schemas']))+' component schemas checked against JSON Schema Draft 2020-12 using jsonschema '+v('jsonschema'))
 except Exception as e:
  check('Component JSON Schema meta-validation',False,str(e)[:400])
 allrefs=list(refs(oas));broken=[]
 for loc,ref in allrefs:
  try:resolve(oas,ref)
  except Exception as e:broken.append(loc+'='+str(ref)+' '+str(e)[:80])
 check('Complete internal $ref resolution',not broken,str(len(allrefs))+' references; missing='+json.dumps(broken[:6],ensure_ascii=False))
 ids=[op.get('operationId') for p,m,op in ops]
 check('Unique nonempty operationId',all(isinstance(x,str) and x for x in ids) and len(set(ids))==len(ids),'Distinct '+str(len(set(ids)))+'/'+str(len(ids)))
 paramerrors=[]
 for path,method,op in ops:
  templ=set(re.findall(r'\{([^{}]+)\}',path))
  paramdata=[]
  for item in oas['paths'][path].get('parameters',[])+op.get('parameters',[]):
   try:paramdata.append(resolve(oas,item['$ref']) if '$ref' in item else item)
   except Exception as e:paramerrors.append(f'{method} {path}: unresolved parameter: {e}')
  ps=[p for p in paramdata if p.get('in')=='path']
  names=[p.get('name') for p in ps]
  if set(names)!=templ or len(names)!=len(templ) or not all(p.get('required') is True for p in ps):
   paramerrors.append(f'{method} {path}: url params={templ}, declared={names}')
  identities=[(p.get('in'),p.get('name')) for p in paramdata]
  if len(set(identities))!=len(identities):paramerrors.append(f'{method} {path}: duplicate parameter identity')
 check('Path template parameters are required and consistent',not paramerrors,str(len(ops))+' operations; mismatches='+json.dumps(paramerrors[:6]))
 # auth schemes and action-level security
 secerrors=[]; public={('/auth/register','post'),('/auth/login','post'),('/auth/refresh','post'),('/health/live','get'),('/public/organizations/{orgId}/sessions','get'),('/public/organizations/{orgId}/sessions/{sessionId}','get')}
 for path,method,op in ops:
  expected=[] if (path,method) in public else ([{'monitorAuth':[]}] if path=='/health/ready' else [{'bearerAuth':[]}])
  actual=op.get('security',oas.get('security'))
  if actual!=expected:secerrors.append(f'{method} {path} -> {actual} (expected {expected})')
  if not op.get('x-authorized-actors') or not op.get('x-business-rules') or not op.get('x-idempotency'):
   secerrors.append(f'{method} {path}: missing machine-readable policy extensions')
  if expected==[{'bearerAuth':[]}] and '401' not in op['responses']:
   secerrors.append(f'{method} {path}: missing 401')
 schemes=oas['components']['securitySchemes']; good=('bearerAuth' in schemes and schemes['bearerAuth'].get('type')=='http' and schemes['bearerAuth'].get('scheme')=='bearer' and schemes.get('monitorAuth',{}).get('type')=='apiKey')
 check('Authentication requirements, no dual-anonymous staff read',not secerrors and good, f'{len(ops)} operations, 6 anonymous including token-body refresh, 1 monitorAuth, remaining bearer; errors='+json.dumps(secerrors[:6]))
 # response / request shape completeness
 shapeerrors=[]
 for path,method,op in ops:
  responses=op.get('responses',{})
  if not any(str(k).startswith('2') for k in responses):shapeerrors.append(f'{method} {path} no success')
  for code,response in responses.items():
   try: response=resolve(oas,response['$ref']) if '$ref' in response else response
   except Exception:shapeerrors.append(f'{method} {path} response bad ref');continue
   if 'description' not in response:shapeerrors.append(f'{method} {path} {code} no response description')
   if str(code).startswith(('4','5')) and response.get('content',{}).get('application/problem+json',{}).get('schema',{}).get('$ref')!='#/components/schemas/Problem':shapeerrors.append(f'{method} {path} {code} not Problem Details')
   if str(code) in ('200','201') and path not in ['/health/live','/health/ready']:
    if 'application/json' not in response.get('content',{}):shapeerrors.append(f'{method} {path} success missing json contract')
  if 'requestBody' in op and method not in ['post','patch','put']:
   shapeerrors.append(f'{method} {path} unexpected requestBody')
  if 'requestBody' in op:
   body=op['requestBody'].get('content',{}).get('application/json',{}).get('schema',{})
   if body.get('type')=='object' and body.get('additionalProperties') is not False:shapeerrors.append(f'{method} {path} body allows arbitrary properties')
 check('Response coverage, RFC9457, request DTO shape',not shapeerrors,'errors='+json.dumps(shapeerrors[:8]))
 # public/staff response references must be disjoint
 pub={'/public/organizations/{orgId}/sessions': 'PublicSessionList','/public/organizations/{orgId}/sessions/{sessionId}':'PublicSession'}
 staff={'/organizations/{orgId}/sessions':'StaffSessionList','/organizations/{orgId}/sessions/{sessionId}':'StaffSession'}
 routeerrors=[]
 for paths,actor in [(pub,'PUBLIC_PUBLISHED'),(staff,'OWNER|MANAGER|RECEPTIONIST|ASSIGNED_TRAINER')]:
  for path,name in paths.items():
   get=oas['paths'][path]['get']; sr=get['responses']['200']['content']['application/json']['schema'].get('$ref')
   if sr!=f'#/components/schemas/{name}' or get['x-authorized-actors']!=actor:routeerrors.append(path+' wrong response or actor')
   if paths is pub and any(err in get['responses'] for err in ('401','403')):routeerrors.append(path+' public route has auth errors')
 sch=oas['components']['schemas']; ps=sch['PublicSession']
 allow={'id','serviceTitle','branchName','startAt','endAt','timezone','status','seatsAvailable'}
 if set(ps['properties'])!=allow or set(ps['required'])!=allow or ps.get('additionalProperties') is not False:routeerrors.append('PublicSession not exact required allowlist')
 if ps['properties']['status'].get('enum')!=['PUBLISHED']:routeerrors.append('PublicSession status not PUBLISHED-only')
 if any('StaffSession' in ref for val in [ps,sch['PublicSessionList']] for _,ref in refs(val)):routeerrors.append('PublicSession transitive staff schema ref')
 if set(sch['StaffSession']['properties'])==allow:routeerrors.append('StaffSession wrongly collapsed into public model')
 check('Public/staff Session response isolation',not routeerrors,'4 distinct paths, 2 dedicated public DTOs; errors='+json.dumps(routeerrors))
 # actual 2020-12 schema tests for leakage and /me
 try:
  from jsonschema import Draft202012Validator,FormatChecker
  v_public=Draft202012Validator({'components':{'schemas':sch},'$ref':'#/components/schemas/PublicSession'},format_checker=FormatChecker())
  sample={'id':'00000000-0000-4000-8000-000000000001','serviceTitle':'Yoga','branchName':'Center','startAt':'2026-11-22T09:00:00Z','endAt':'2026-11-22T10:00:00Z','timezone':'Asia/Tehran','status':'PUBLISHED','seatsAvailable':1}
  public_ok=v_public.is_valid(sample) and not v_public.is_valid({**sample,'seatsCommitted':3}) and not v_public.is_valid({**sample,'status':'CANCELLED'})
  v_me=Draft202012Validator({'components':{'schemas':sch},'$ref':'#/components/schemas/MeResponse'},format_checker=FormatChecker())
  user={'id':'00000000-0000-4000-8000-000000000002','email':'test@example.invalid','status':'ACTIVE'}
  membership={'tenantId':'00000000-0000-4000-8000-000000000003','userId':user['id'],'role':'TRAINER','status':'ACTIVE'}
  me_ok=v_me.is_valid({'user':user,'memberships':[]}) and v_me.is_valid({'user':user,'memberships':[membership]}) and not v_me.is_valid({'user':user,'memberships':[{**membership,'status':'REVOKED'}]}) and not v_me.is_valid({'user':user})
  check('JSON Schema executable public-field + active /me fixtures',public_ok and me_ok,'jsonschema '+v('jsonschema')+': positive samples accepted, extra staff field, nonpublished status, revoked/omitted memberships rejected')
 except Exception as e:check('JSON Schema executable public-field + active /me fixtures',False,type(e).__name__+' '+str(e)[:240])
 me=sch['MeResponse']; mem=sch['ActiveMembership']; meop=oas['paths']['/me']['get']
 check('Authoritative /me response matches ACTIVE-only schema',set(me['required'])=={'user','memberships'} and me['properties']['memberships']['items']['$ref']=='#/components/schemas/ActiveMembership' and mem['properties']['status']['enum']==['ACTIVE'] and meop['responses']['200']['content']['application/json']['schema']['$ref']=='#/components/schemas/MeResponse','active membership enforced by schema; description explicitly includes it')
 # Type-specific resource request requiredness (OpenAPI 3.1 JSON Schema if/then)
 try:
  from jsonschema import Draft202012Validator, FormatChecker
  body=oas['paths']['/organizations/{orgId}/resources']['post']['requestBody']['content']['application/json']['schema']
  resource_req=Draft202012Validator(body,format_checker=FormatChecker())
  U='00000000-0000-4000-8000-000000000004'
  resource_ok=(len(body.get('allOf',[]))==2 and len(sch['Resource'].get('allOf',[]))==2 and
   resource_req.is_valid({'type':'ROOM','displayName':'Studio','branchId':U}) and
   resource_req.is_valid({'type':'TRAINER','displayName':'Coach','trainerUserId':U}) and
   not resource_req.is_valid({'type':'ROOM','displayName':'Studio'}) and
   not resource_req.is_valid({'type':'TRAINER','displayName':'Coach'}) and
   not resource_req.is_valid({'type':'ROOM','displayName':'Studio','branchId':U,'trainerUserId':U}) and
   not resource_req.is_valid({'type':'TRAINER','displayName':'Coach','trainerUserId':U,'branchId':U}))
  check('Resource conditional required fields / no type confusion',resource_ok,'Draft2020-12 if/then on ROOM vs TRAINER request+response; 2 valid and 4 invalid fixtures')
 except Exception as e:check('Resource conditional required fields / no type confusion',False,str(e)[:240])
 # Temporal semantics static
 tperrors=[]
 for name,fields in {'StaffSession':['startAt','endAt'],'Booking':['createdAt'],'ScheduleException':['startAt','endAt'],'Occupancy':['from','to']}.items():
  for field in fields:
   ob=sch[name]['properties'][field]
   if ob.get('pattern')!='Z$':tperrors.append(f'{name}.{field} not UTC Z output')
 if sch['Booking']['properties']['cancelledAt']['anyOf'][0].get('pattern')!='Z$':tperrors.append('cancelledAt not UTC Z')
 if 'NOT an input schedule' not in sch['Booking']['properties']['createdAt']['description']:tperrors.append('createdAt semantic mismatch')
 for path in ['/organizations/{orgId}/sessions','/organizations/{orgId}/schedule-exceptions']:
  props=oas['paths'][path]['post']['requestBody']['content']['application/json']['schema']['properties']
  for f in ['startAt','endAt']:
   if 'Offset MUST be valid' not in props[f].get('description',''):tperrors.append(f'{path} {f} invalid input policy')
 if not all('NOT validated against organization scheduling timezone' in oas['components']['parameters'][p]['description'] for p in ['from','to']):tperrors.append('instant query policy missing')
 check('Scheduling input vs UTC event/output contracts',not tperrors,'Session+exceptions input offset/IANA; Booking createdAt, cancelledAt, all response instants UTC Z; errors='+json.dumps(tperrors))
 # Exact full operation matrix coverage
 matrix=(DOCS/'security/AUTHORIZATION_MATRIX.md').read_text()
 listed=re.findall(r'^\|\s*`(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS|TRACE)\s+(/[^`]+)`\s*\|',matrix,re.M)
 expected={(m.upper(),p) for p,m,o in ops};seen=collections.Counter((m,p) for m,p in listed)
 mat_ok=set(seen)==expected and len(seen)==len(expected) and all(n==1 for n in seen.values())
 check('Authorization matrix exactly matches all operation pairs',mat_ok,f'{sum(seen.values())} table rows, {len(expected)} API pairs; missing={list(expected-set(seen))[:3]}, extra={list(set(seen)-expected)[:3]}')
 # Cross-document and tests
 ds={x.name:x.read_text() for x in DOCS.rglob('*.md')}
 needed=['PRD_FA.md','DOMAIN_MODEL_FA.md','STATE_MACHINES_FA.md','ARCHITECTURE_FA.md','DATABASE_DESIGN_FA.md','THREAT_MODEL_FA.md','AUTHORIZATION_MATRIX.md','REQUIREMENTS_TRACEABILITY.md','OPEN_DECISIONS_FA.md','PHASE_01_FINAL_REPORT_FA.md']
 docerr=[]
 for fn in needed:
  if fn not in ds: docerr.append('missing '+fn)
 for fn in ['PRD_FA.md','DOMAIN_MODEL_FA.md','STATE_MACHINES_FA.md','ARCHITECTURE_FA.md','DATABASE_DESIGN_FA.md','THREAT_MODEL_FA.md','AUTHORIZATION_MATRIX.md','PHASE_01_FINAL_REPORT_FA.md']:
  s0=ds.get(fn,'')
  for token in ['PublicSession','StaffSession','PUBLISHED']:
   if token not in s0:docerr.append(fn+' missing '+token)
 for fn in ['PRD_FA.md','DOMAIN_MODEL_FA.md','ARCHITECTURE_FA.md','THREAT_MODEL_FA.md','PHASE_01_FINAL_REPORT_FA.md']:
  if 'ActiveMembership' not in ds.get(fn,'') and '/me' not in ds.get(fn,''):docerr.append(fn+' lacks /me policy')
 for fn in ['PRD_FA.md','DOMAIN_MODEL_FA.md','ARCHITECTURE_FA.md','DATABASE_DESIGN_FA.md','PHASE_01_FINAL_REPORT_FA.md']:
  if 'UTC' not in ds.get(fn,''):docerr.append(fn+' lacks UTC')
 for fn in ['PRD_FA.md','THREAT_MODEL_FA.md','ARCHITECTURE_FA.md']:
  if '/public/organizations' not in ds.get(fn,''):docerr.append(fn+' public route missing')
 check('Cross-document terminology, policies and state terms',not docerr,'checked 10 named documents; errors='+json.dumps(docerr[:8]))
 trace=ds.get('REQUIREMENTS_TRACEABILITY.md','');missing_ids=[]
 for prefix,end in [('FR',16),('INV',14),('NFR',10)]:
  for i in range(1,end+1):
   if f'{prefix}-{i:02d}' not in trace:missing_ids.append(f'{prefix}-{i:02d}')
 for i in range(1,48):
  if not re.search(r'^\|\s*T-'+f'{i:02d}'+r'\s*\|',trace,re.M):missing_ids.append(f'T-{i:02d}')
 check('FR/INV/NFR and T-01..T-47 traceability',not missing_ids,'FR-01..16, INV-01..14, NFR-01..10, 47 designated tests; missing='+repr(missing_ids))
 # Phase/independence hard boundary
 files=[f for f in ROOT.rglob('*') if f.is_file()]
 check('Phase 01 package scope excludes runtime app and secrets',not any(x.suffix in {'.env','.pem','.key','.p12','.pfx'} or x.name in {'node_modules','.env.local'} or any(part in {'node_modules','dist','build','.git','venv','.venv','__pycache__'} for part in x.parts) for x in files),'Design docs and static tool only; no execution/credentials claim')
# An additional independently published third-party OAS spec validator is unavailable in this environment.
unverified('Independent third-party OpenAPI meta-schema validator','openapi-spec-validator/prance unavailable; attempted installation before validation; FastAPI model + Draft2020-12 + strict checks executed instead')
unverified('Backend, API E2E, PostgreSQL, concurrency, security, restore, deployment','No application, database or server executed; T-01..T-47 are planned tests, all runtime NOT VERIFIED')
summary=collections.Counter(x[1] for x in checks)
lines=['# BookCore — Phase 01 Static Validation Report (executed)', '', '**Date:** 2026-11-22  ','**Scope:** Design file validation only. No backend, PostgreSQL, auth service, API E2E, integration, load, penetration, backup, infrastructure or stakeholder approval executed.  ','**Tools actually used:** ruamel.yaml '+v('ruamel.yaml')+' (strict duplicate keys), FastAPI '+v('fastapi')+' / Pydantic OpenAPI model, jsonschema '+v('jsonschema')+' (Draft 2020-12), Python custom reference/path/auth/DTO/cross-document assertions.  ',f'**Summary:** {summary["PASS"]} PASS; {summary["FAIL"]} FAIL; {summary["NOT VERIFIED"]} NOT VERIFIED.  ','', '| Executed/Unavailable check | Result | Evidence / limitations |','|---|---|---|']
for name,status,details in checks:
 lines.append('| '+name.replace('|','/')+' | '+status+' | '+details.replace('|','/').replace('\n',' ')+' |')
lines+=['','## Interpretation','- A PASS here means a specific static design assertion passed in the local working environment. It is NOT an OpenAPI implementation conformance certificate, security audit or database test.','- An independent external OpenAPI reference-validator run was not possible with available dependencies: it remains **NOT VERIFIED**; FastAPI OpenAPI model check and JSON Schema meta-validation were actually executed.','- Strict YAML parser rejects duplicate keys rather than silently accepting a last-value-wins contract.','- Public DTO JSON Schema negative fixtures reject internal staff fields and nonpublished status by construction; actual server projection/role enforcement is unexecuted.','- The original baseline SHA-256 is compared byte-for-byte to a pinned digest.','- Stakeholder approval and TS-01..TS-07 remain open.','', '**Design-validation aggregate:** '+('PASS (all locally executable static assertions passed).' if not summary['FAIL'] else 'FAIL (at least one executed assertion failed).'), '']
REPORT.write_text('\n'.join(lines),encoding='utf-8')
print('STATIC VALIDATION:',dict(summary))
for name,status,details in checks:print(f'[{status}] {name}: {details[:240]}')
if summary['FAIL']:
 sys.exit(1)
