from pathlib import Path
import hashlib,re,sys
root=Path(__file__).resolve().parents[1]/'reference'/'Phase_01'/'BookCore_Phase_01'
manifest=(root/'MANIFEST.md').read_text()
pattern=r'^\| `([^`]+)` \| `([a-f0-9]{64})` \|'
records=re.findall(pattern,manifest,re.M)
bad=[]
for name,expected in records:
 p=root/name
 if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=expected:bad.append(name)
actual={str(x.relative_to(root)) for x in root.rglob('*') if x.is_file() and x.name!='MANIFEST.md'}
assert len(records)==23,(len(records),records)
assert actual=={n for n,_ in records},(actual-{n for n,_ in records})
assert not bad,bad
print(f'PASS Phase01 SHA256 {len(records)}/{len(records)}; original manifest remains unchanged')
