from pathlib import Path
import yaml,re,sys
root=Path(__file__).resolve().parent.parent
class StrictLoader(yaml.SafeLoader): pass
def mapping(loader,node):
 obj={}
 for k,v in node.value:
  key=loader.construct_object(k)
  if key in obj: raise ValueError(f'duplicate YAML key {key} at {k.start_mark}')
  obj[key]=loader.construct_object(v)
 return obj
StrictLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,mapping)
try:
 contract=yaml.load((root/'docs/api/openapi.yaml').read_text(),Loader=StrictLoader)
 assert contract['openapi'].startswith('3.1.')
 current=[('/auth/register','post'),('/auth/login','post'),('/auth/refresh','post'),('/auth/logout','post'),
 ('/me','get'),('/organizations','post'),('/organizations/{orgId}','get'),
 ('/organizations/{orgId}/members','get'),('/organizations/{orgId}/members','post'),
 ('/organizations/{orgId}/members/{userId}','patch'),('/health/live','get'),('/health/ready','get')]
 for path,method in current:
  assert method in contract['paths'][path],f'Missing {method} {path}'
  if path.startswith('/auth/') and method=='post' and path!='/auth/logout':
   assert contract['paths'][path][method].get('security')==[],f'{path} unexpectedly protected'
  elif path=='/health/live': assert contract['paths'][path][method].get('security')==[]
  else:assert contract['paths'][path][method].get('security',contract['security']) != [],f'{path} unexpectedly public'
 # OpenAPI refs limited to local component refs: all referenced pointers must resolve.
 refs=[]
 def recurse(node):
  if isinstance(node,dict):
   for k,v in node.items():
    if k=='$ref': refs.append(v)
    recurse(v)
  if isinstance(node,list):
   for v in node:recurse(v)
 recurse(contract)
 for ref in refs:
  assert ref.startswith('#/'),f'external or unsupported ref {ref}'
  o=contract
  for key in ref[2:].split('/'):
   o=o[key.replace('~1','/').replace('~0','~')]
 print(f'PASS OpenAPI strict YAML, {len(refs)} refs, {len(current)} implemented contract operation matches; design routes={len(contract["paths"])}')
except Exception as e:
 print('FAIL',type(e).__name__,e)
 sys.exit(1)
