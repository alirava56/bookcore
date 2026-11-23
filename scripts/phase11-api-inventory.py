#!/usr/bin/env python3
"""Source-derived NestJS controller inventory compared with Phase01 design OpenAPI.
Static discovery only; no claim of registration, DI success or runtime execution.
"""
import json,subprocess,re
from pathlib import Path
import yaml
from collections import Counter
root=Path('.')
controllers=json.loads(subprocess.check_output(['node','scripts/phase11-controller-inventory.cjs'],text=True))
spec=yaml.safe_load((root/'docs/api/openapi.yaml').read_text())
methods={'get','post','put','patch','delete','options','head'}
from_route={}
for p,item in spec['paths'].items():
 for meth,op in item.items():
  if meth in methods:from_route[(meth.upper(),p)]=op

def normalized(url):return re.sub(r':([A-Za-z_][A-Za-z0-9_]*)',r'{\1}',url)
actual=set()
rows=[]
for x in controllers:
 method=x['method']; route=normalized(x['route']); key=(method,route)
 actual.add(key);design=from_route.get(key)
 module=x['file'].split('/modules/')[1].split('/')[0]
 test_candidates={
  'identity':['identity-tenant-postgres.test.ts','http.test.ts','jwt.test.ts'],
  'organizations':['identity-tenant-postgres.test.ts','phase09-postgres.test.ts'],
  'governance':['phase09-postgres.test.ts','phase09-governance.test.ts'],
  'catalog':['catalog-postgres.test.ts','availability.test.ts'],
  'scheduling':['sessions-postgres.test.ts','session-domain.test.ts'],
  'booking':['booking-postgres.test.ts','booking-domain.test.ts'],
  'reporting':['phase08-postgres.test.ts','phase08-reporting.test.ts'],
  'health':['http.test.ts','database-ready.test.ts']
 }.get(module,[])
 code=Path(x['file']).parent
 service_candidates=list(code.glob('*.service.ts'))
 errors=set()
 for_path=''
 for f in service_candidates:
  for match in re.findall(r"ProblemException\s*\(\s*\d+\s*,\s*'([A-Z_]+)'",f.read_text()):errors.add(match)
 rows.append({'method':method,'path':'/api/v1'+route,
  'controller':x['controller'],'handler':x['handler'],'source':x['file'],
  'authentication':'PUBLIC' if x['public'] or x['classPublic'] else ('MONITOR' if x['monitoring'] else 'AUTHENTICATED_DEFAULT_DENY'),
  'authorization':'SERVICE_VERIFICATION_REQUIRED',
  'requestDto':x['requestDto'],'responseDtoEvidence':x['responseDecorators'],
  'errorCodeCandidatesForModule':sorted(errors),
  'idempotencyHeaderDeclared':x['idempotencyHeader'],
  'designOperationId':design.get('operationId') if design else None,
  'relatedTestFilesCandidates':test_candidates,'implementation':'SOURCE_CONTROLLER_PRESENT',
  'runtimeVerification':'NOT VERIFIED','apiContractMatch':'MATCHED_METHOD_PATH' if design else 'NO_MATCHING_DESIGN_OPERATION'})
missing=[{'method':k[0],'path':'/api/v1'+k[1],'operationId':v.get('operationId'),
 'implementation':'DESIGNED_NOT_IMPLEMENTED'} for k,v in from_route.items() if k not in actual]
extra=[f'{x[0]} {x[1]}' for x in actual if x not in from_route]
duplicate=[{'route':str(k),'count':v} for k,v in Counter((r['method'],r['path']) for r in rows).items() if v>1]
output={'scope':'STATIC TYPESCRIPT AST + DESIGN YAML; NOT RUNTIME ROUTE REGISTRATION',
 'designOperationCount':len(from_route),'sourceControllerRouteCount':len(rows),
 'sourceMatched':sum(r['apiContractMatch']=='MATCHED_METHOD_PATH' for r in rows),
 'designedNotImplemented':missing,'unexpectedSourceRoutes':extra,'duplicates':duplicate,
 'implementedSourceRoutes':rows}
(root/'docs/integration').mkdir(parents=True,exist_ok=True)
(root/'docs/integration/API_IMPLEMENTATION_MATRIX.json').write_text(json.dumps(output,indent=2,ensure_ascii=False)+'\n')
(root/'docs/integration/API_IMPLEMENTATION_MATRIX.md').write_text(
 '# فهرست مستقل APIهای BookCore — Phase 11\n\n'+
 '**این فهرست از AST سورس NestJS و قرارداد YAML استخراج شده است؛ نه از اجرای NestJS.** '+
 'وجود Controller به معنای حل‌شدن Dependency Injection یا عبور از آزمون HTTP نیست.\n\n'+
 f"- عملیات طراحی: {len(from_route)}\n- مسیرهای شناسایی‌شده در سورس: {len(rows)}\n"+
 f"- تطبیق روش و مسیر با قرارداد: {output['sourceMatched']}\n- طراحی‌شده اما بدون Controller: {len(missing)}\n"+
 f"- مسیر اضافه/ناسازگار: {len(extra)}\n\n"+
 '| Method | Path | Handler | operationId | Runtime |\n|---|---|---|---|---|\n'+
 ''.join(f"| {r['method']} | `{r['path']}` | `{r['controller']}.{r['handler']}` | `{r['designOperationId']}` | NOT VERIFIED |\n" for r in rows)+
 ('\n## Designed, not found in source\n'+''.join(f"- {m['method']} `{m['path']}`: {m['operationId']}\n" for m in missing) if missing else '')+
 ('\n## Source routes without matching design\n'+''.join(f'- {e}\n' for e in extra) if extra else '')+
 '\nجزئیات محدودیت اعتبارسنجی، کدهای خطای پیشنهادی در سطح ماژول، DTOها و فایل‌های تست در JSON هستند.\n')
print(json.dumps({k:output[k] for k in ['designOperationCount','sourceControllerRouteCount','sourceMatched','unexpectedSourceRoutes','duplicates']},indent=2))
if duplicate:raise SystemExit(1)
