#!/usr/bin/env python3
"""Strict static checks for Phase07 design contract, no PostgreSQL/runtime implications."""
import yaml,re,pathlib
class Unique(yaml.SafeLoader): pass
def unique(loader,node):
 d={}
 for k,v in node.value:
  key=loader.construct_object(k)
  if key in d:raise ValueError('duplicate YAML key '+str(key))
  d[key]=loader.construct_object(v)
 return d
Unique.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,unique)
api=yaml.load(pathlib.Path('docs/api/openapi.yaml').read_text(),Loader=Unique)
assert api['openapi'].startswith('3.1.')
paths=api['paths'];components=api['components'];operation_ids=[];refs=[]
BOOK={
 '/organizations/{orgId}/sessions/{sessionId}/bookings':('post','201','Booking'),
 '/organizations/{orgId}/bookings/me':('get','200','BookingList'),
 '/organizations/{orgId}/bookings/{bookingId}/cancel':('post','200','Booking'),
 '/organizations/{orgId}/bookings/{bookingId}/attendance':('post','200','Booking')}
def visit(x):
 if isinstance(x,dict):
  if '$ref' in x:refs.append(x['$ref'])
  for v in x.values():visit(v)
 elif isinstance(x,list):
  for v in x:visit(v)
visit(api)
for ref in refs:
 if not ref.startswith('#/'):continue
 obj=api
 for token in ref[2:].split('/'):
  token=token.replace('~1','/').replace('~0','~')
  assert isinstance(obj,dict) and token in obj,ref
  obj=obj[token]
for path,defs in paths.items():
 for method,op in defs.items():
  if method not in ('get','post','patch','put','delete','head'):continue
  operation_ids.append(op['operationId'])
  for name in re.findall(r'\{([^{}]+)\}',path):
   params=[api['components']['parameters'][p['$ref'].split('/')[-1]] if '$ref' in p else p for p in op.get('parameters',[])]
   assert any(p.get('name')==name and p.get('in')=='path' and p.get('required') for p in params),(path,name)
assert len(operation_ids)==len(set(operation_ids))
for path,(method,status,schema) in BOOK.items():
 op=paths[path][method]
 assert op.get('security',[{'bearerAuth':[]}])!=[]
 assert op['responses'][status]['content']['application/json']['schema']=={'$ref':'#/components/schemas/'+schema}
 if method=='post':
  assert {'$ref':'#/components/parameters/key'} in op.get('parameters',[])
  assert op.get('requestBody',{}).get('required')
receipt=components['schemas']['Booking'];assert receipt['additionalProperties'] is False
for private in ('createdByActorId','passwordHash','cancelReason','auditEvents','idempotencyKey'):
 assert private not in receipt['properties']
assert 'customerId' not in paths['/organizations/{orgId}/sessions/{sessionId}/bookings']['post']['requestBody']['content']['application/json']['schema'].get('required',[])
print(f'PASS YAML strict/duplicate keys, {len(refs)} refs, {len(operation_ids)} unique operations, path params, four Phase07 contracts, safe receipt')
