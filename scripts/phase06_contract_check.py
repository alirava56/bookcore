#!/usr/bin/env python3
"""Strict static validation of authoritative design contract; not runtime API verification."""
import pathlib,re,yaml,sys
p=pathlib.Path('docs/api/openapi.yaml')
class Unique(yaml.SafeLoader): pass
def no_duplicates(loader,node):
 result={}
 for k,v in node.value:
  key=loader.construct_object(k)
  if key in result:raise ValueError('Duplicate YAML key: '+str(key))
  result[key]=loader.construct_object(v)
 return result
Unique.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,no_duplicates)
api=yaml.load(p.read_text(),Loader=Unique)
paths=api['paths'];components=api['components'];total=0;ops=[]
for path,definition in paths.items():
 for method,operation in definition.items():
  if method not in ('get','post','put','patch','delete','head','options'):continue
  ops.append(operation['operationId']);total+=1
  for ref in re.findall(r'\$ref:\s*[^\n]+',str(operation)):
   pass
assert len(ops)==len(set(ops)), 'duplicate operationId'
for ref in re.findall(r"\$ref:\s*['\"]?(#/components/[^\s'\"]+)",p.read_text()):
 obj=api
 for token in ref[2:].split('/'):
  assert token in obj, 'unresolved '+ref
  obj=obj[token]
endpoints={
 '/organizations/{orgId}/sessions':{'get','post'},
 '/organizations/{orgId}/sessions/{sessionId}':{'get'},
 '/organizations/{orgId}/sessions/{sessionId}/publish':{'post'},
 '/organizations/{orgId}/sessions/{sessionId}/cancel':{'post'},
 '/organizations/{orgId}/sessions/{sessionId}/finish':{'post'},
 '/organizations/{orgId}/sessions/{sessionId}/capacity':{'patch'},
 '/public/organizations/{orgId}/sessions':{'get'},
 '/public/organizations/{orgId}/sessions/{sessionId}':{'get'}
}
for path,methods in endpoints.items():
 assert methods.issubset(paths[path]),path
 for method in methods:
  o=paths[path][method]
  r=o['responses']['200' if method=='get' or method=='patch' or path.endswith(('/publish','/cancel','/finish')) else '201']['content']['application/json']['schema']
  assert r['$ref']==('#/components/schemas/PublicSessionList' if path=='/public/organizations/{orgId}/sessions' else
          '#/components/schemas/PublicSession' if path.startswith('/public/') else
          '#/components/schemas/StaffSessionList' if method=='get' and path.endswith('/sessions') else
          '#/components/schemas/StaffSession')
  if path.startswith('/public/'):
   assert o.get('security')==[]
  else:
   assert o.get('security',[{'bearerAuth':[]}]) != []
public=components['schemas']['PublicSession']
assert public['additionalProperties'] is False
for field in ['tenantId','trainerResourceId','roomResourceId','seatsCommitted','capacityTotal','version']:
 assert field not in public['properties'],field
for path in ['/organizations/{orgId}/sessions/{sessionId}/cancel', '/organizations/{orgId}/sessions/{sessionId}/capacity']:
 assert any(par.get('$ref')=='#/components/parameters/key' for par in paths[path][next(m for m in endpoints[path])]['parameters'])
print('PASS strict YAML, duplicate keys, internal refs, unique operationIds, 9 Phase06 methods, public schema and idem header; total',total,'operations')
