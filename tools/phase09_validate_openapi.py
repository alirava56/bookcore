#!/usr/bin/env python3
"""Static, duplicate-key-strict OpenAPI 3.1 structural/reference/policy checker.
Not a replacement for a full OpenAPI meta-schema validator or an HTTP contract test.
Requires PyYAML; no network access or dynamic API code.
"""
from pathlib import Path
from collections import Counter
import re,yaml,json,sys
class UniqueSafeLoader(yaml.SafeLoader):pass
def unique_mapping(loader,node):
    result={}
    for key_node,value_node in node.value:
        key=loader.construct_object(key_node)
        if key in result: raise ValueError(f'Duplicate YAML key: {key}')
        result[key]=loader.construct_object(value_node)
    return result
UniqueSafeLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,unique_mapping)
errors=[]
spec=yaml.load(Path('docs/api/openapi.yaml').read_text(),Loader=UniqueSafeLoader)
assert spec.get('openapi')=='3.1.0'
ops=[];refs=[]
def walk(obj):
    if isinstance(obj,dict):
        if '$ref' in obj: refs.append(obj['$ref'])
        for v in obj.values():walk(v)
    elif isinstance(obj,list):
        for v in obj:walk(v)
walk(spec)
for ref in refs:
    if not isinstance(ref,str) or not ref.startswith('#/'):errors.append('external_ref:'+str(ref));continue
    node=spec
    for item in ref[2:].split('/'):
        item=item.replace('~1','/').replace('~0','~')
        if not isinstance(node,dict) or item not in node:
            errors.append('broken_ref:'+ref);break
        node=node[item]
for route,item in spec['paths'].items():
    parameters=item.get('parameters',[])
    for verb,operation in item.items():
        if verb not in {'get','post','put','patch','delete','options','head'}:continue
        oid=operation.get('operationId');ops.append(oid)
        if not oid or not isinstance(oid,str):errors.append('missing_operationId:'+route)
        used=set(re.findall(r'{([^}]+)}',route))
        declared=set()
        for p in parameters+operation.get('parameters',[]):
            if '$ref' in p:
                r=p['$ref'];resolved=spec
                for part in r[2:].split('/'):resolved=resolved[part]
                p=resolved
            if p.get('in')=='path':declared.add(p['name']);
            if p.get('in')=='path' and p.get('required')!=True:errors.append('path_not_required:'+route)
        if used!=declared:errors.append(f'path_mismatch:{route}:{used}:{declared}')
        if 'responses' not in operation or not operation['responses']:errors.append('missing_responses:'+route)
        if operation.get('security')==[] and not route.startswith(('/auth/register','/auth/login','/auth/refresh','/public/','/health/live')):
            errors.append('unexpected_public_route:'+route)
        if route.startswith('/organizations/') and operation.get('security')==[]:
            errors.append('unguarded_org_route:'+route)
    # No leaking by importing staff model in public GET responses.
    if route.startswith('/public/'):
        for verb,op in item.items():
            if verb!='get':continue
            if any('StaffSession' in str(x) for x in op.get('responses',{}).values()):
                errors.append('public_schema_leak:'+route)
counts=Counter(ops)
errors.extend('duplicate_operationId:'+str(x) for x,n in counts.items() if n>1)
for field in ['trainerResourceId','roomResourceId','seatsCommitted','createdBy','auditEvents']:
    if field in spec['components']['schemas']['PublicSession'].get('properties',{}):
        errors.append('public_reserved_field:'+field)
for route in ['/organizations/{orgId}/staff-invitations','/me/staff-invitations/accept',
 '/organizations/{orgId}/booking-consents','/organizations/{orgId}/booking-consents/me']:
    if route not in spec['paths']:errors.append('phase09_route_missing:'+route)
if len(sys.argv)>1:
    verbs={'get','post','put','patch','delete','options','head'}
    def operations(document,prefix=''):
        return {(verb,prefix+route) for route,methods in document['paths'].items()
                for verb in methods if verb in verbs}
    implemented=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    expected=operations(spec,'/api/v1')
    actual=operations(implemented)
    if expected!=actual:
        errors.append(f'operation_drift:missing={sorted(expected-actual)}:extra={sorted(actual-expected)}')
print(json.dumps({'static_yaml':'FAIL' if errors else 'PASS','operations':len(ops),'unique_operation_ids':len(counts),
 'internal_refs_resolved':len(refs),'errors':errors},ensure_ascii=False,indent=2))
if errors:raise SystemExit(1)
