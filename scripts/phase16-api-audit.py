#!/usr/bin/env python3
"""Independent static controller audit including private non-domain routes."""
import json, subprocess
from pathlib import Path
import yaml
root=Path('.')
source=json.loads(subprocess.check_output(['node','scripts/phase16-controller-inventory.cjs'],text=True))
spec=yaml.safe_load((root/'docs/api/openapi.yaml').read_text())
expected={(method.upper(),'/api/v1'+path):op['operationId'] for path,item in spec['paths'].items()
 for method,op in item.items() if method.lower() in ('get','post','patch','put','delete','options','head')}
rows=[];hits=set();extra=[]
for s in source:
 route='/api/v1'+s['route'].replace(':orgId','{orgId}').replace(':userId','{userId}').replace(':sessionId','{sessionId}').replace(':bookingId','{bookingId}').replace(':hourId','{hourId}').replace(':exceptionId','{exceptionId}').replace(':consentId','{consentId}').replace(':invitationId','{invitationId}')
 key=(s['method'],route);found=expected.get(key)
 private=s['file'].endswith('/observability/metrics.controller.ts') and route=='/api/v1/internal/metrics' and s['monitoring'] and s['hasRoleGuard']
 if found: hits.add(key)
 else: extra.append({'method':s['method'],'path':route,'privateMonitoring':private})
 rows.append({'method':s['method'],'path':route,'controller':s['controller'],'handler':s['handler'],
  'requestDto':s['requestDto'],'apiResponseDecoratorEvidence':s['responseDecorators'],
  'authentication':'MONITORING_GUARD' if private else ('EXPLICIT_PUBLIC' if s['public'] or s['classPublic'] else 'DEFAULT_DENY'),
  'designOperationId':found,'implementedInSource':True,'runtimeVerified':False,'source':s['file']})
missing=sorted((method,path,op) for (method,path),op in expected.items() if (method,path) not in hits)
result={'scope':'ALL controllers incl. common/observability, AST static only, not Nest runtime proof',
 'sourceRoutes':len(rows),'designOperations':len(expected),'matched':len(hits),'missing':missing,'extra':extra,'routes':rows}
(root/'docs/api/PHASE_16_IMPLEMENTED_ENDPOINTS.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['sourceRoutes','designOperations','matched','missing','extra']},ensure_ascii=False))
if missing or len(rows)!=47 or len(hits)!=46 or len(extra)!=1 or not extra[0]['privateMonitoring']:
 raise SystemExit('FAILED API SOURCE AUDIT: unexpected or insecure route')
