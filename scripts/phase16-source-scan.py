#!/usr/bin/env python3
"""Limited regex source scan; NOT a comprehensive secret scanner or pentest."""
from pathlib import Path
import json,re
root=Path('.')
patterns={'private_key_block':re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----'),
          'aws_access_key_shape':re.compile(r'AKIA[0-9A-Z]{16}'),
          'github_pat_shape':re.compile(r'ghp_[A-Za-z0-9]{36}'),
          'openai_secret_shape':re.compile(r'sk-proj-[A-Za-z0-9_-]{25,}')}
excluded={'node_modules','.git','dist'}
allowed={'.ts','.js','.cjs','.py','.sh','.md','.json','.yaml','.yml','.env','.txt','.sql'}
checked=0;hits=[]
for f in root.rglob('*'):
 if not f.is_file() or f.suffix not in allowed or any(x in excluded for x in f.parts) or 'evidence' in f.parts:continue
 checked+=1
 try:s=f.read_text(encoding='utf-8')
 except (UnicodeError,PermissionError):continue
 for name,pattern in patterns.items():
  for match in pattern.finditer(s):hits.append({'file':str(f),'category':name,'line':s[:match.start()].count('\n')+1})
result={'scope':'regex scan over source; no dependency CVE check or dynamic secret investigation',
        'files_checked':checked,'potential_pattern_hits':hits,'runtime_security_verified':False}
(root/'evidence/phase16').mkdir(parents=True,exist_ok=True)
(root/'evidence/phase16/source-scan-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'files_checked':checked,'potential_hits':len(hits)}))
