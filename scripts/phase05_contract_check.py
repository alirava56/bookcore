from pathlib import Path
import re,yaml
root=Path(__file__).resolve().parent.parent
class Strict(yaml.SafeLoader):pass
def unique(loader,node):
    r={}
    for k,v in node.value:
        key=loader.construct_object(k)
        if key in r:raise ValueError(f'duplicate YAML key: {key}')
        r[key]=loader.construct_object(v)
    return r
Strict.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,unique)
doc=yaml.load((root/'docs/api/openapi.yaml').read_text(),Loader=Strict)
assert doc['openapi'].startswith('3.1')
paths=doc['paths']
ops=[('/organizations/{orgId}/branches','post','Branch'),('/organizations/{orgId}/branches','get','BranchList'),
('/organizations/{orgId}/services','post','Service'),('/organizations/{orgId}/services','get','ServiceList'),
('/organizations/{orgId}/resources','post','Resource'),('/organizations/{orgId}/resources','get','ResourceList'),
('/organizations/{orgId}/business-hours','post','BusinessHour'),('/organizations/{orgId}/business-hours','get','BusinessHourList'),
('/organizations/{orgId}/business-hours/{hourId}','patch','BusinessHour'),
('/organizations/{orgId}/schedule-exceptions','post','ScheduleException'),('/organizations/{orgId}/schedule-exceptions','get','ScheduleExceptionList'),
('/organizations/{orgId}/schedule-exceptions/{exceptionId}','patch','ScheduleException')]
seen=set(); refs=[]
def scan(node):
 if isinstance(node,dict):
  for k,v in node.items():
   if k=='$ref':refs.append(v)
   scan(v)
 elif isinstance(node,list):
  for v in node:scan(v)
scan(doc)
for ref in refs:
 assert ref.startswith('#/'),ref
 x=doc
 for part in ref[2:].split('/'):
  x=x[part.replace('~1','/').replace('~0','~')]
for path,method,schema in ops:
 obj=paths[path][method]
 oid=obj['operationId'];assert oid not in seen,oid;seen.add(oid)
 assert obj.get('security',doc['security']) != [],(path,method,'unexpectedly public')
 assert obj['x-authorized-actors'],(path,method,'missing role policy')
 names=set(re.findall(r'\{([^}]+)\}',path))
 paramrefs=[p['$ref'] for p in obj['parameters'] if '$ref' in p]
 paramnames={doc['components']['parameters'][r.split('/')[-1]]['name'] for r in paramrefs}
 assert names<=paramnames,(path,method,'missing path parameter')
 code='201' if method=='post' else '200'
 response=obj['responses'][code]['content']['application/json']['schema']
 assert response=={'$ref':f'#/components/schemas/{schema}'},(path,method,response)
 if method in ('post','patch'):
  b=obj['requestBody']['content']['application/json']['schema']
  assert b['additionalProperties'] is False
  if path.endswith('/business-hours') or path.endswith('/schedule-exceptions'):
   assert len(b['oneOf'])==2
assert len(ops)==12
for name in ('Branch','Service','Resource','BusinessHour','ScheduleException'):
 assert doc['components']['schemas'][name]['additionalProperties'] is False
assert doc['components']['schemas']['Resource']['allOf']
print(f'PASS Phase05 contract: {len(ops)} operations, {len(refs)} resolved refs, strict YAML, type scopes, path params')
