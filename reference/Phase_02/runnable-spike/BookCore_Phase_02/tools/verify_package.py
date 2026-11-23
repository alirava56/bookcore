#!/usr/bin/env python3
"""Verify every file in the extracted workspace against its own SHA-256 inventory.
This does not claim that SQL or TypeScript executed successfully."""
from pathlib import Path
import hashlib,re,sys
root=Path(__file__).resolve().parents[1]
m=root/'MANIFEST.md'
if not m.is_file():raise SystemExit('FAIL manifest missing')
records=re.findall(r'^\| `([^`]+)` \| `([a-f0-9]{64})` \| ([0-9]+) \|',m.read_text(),re.M)
if not records:raise SystemExit('FAIL empty inventory')
known=set();bad=[]
for rel,digest,size in records:
 if rel.startswith('/') or '..' in Path(rel).parts:bad.append((rel,'unsafe path'));continue
 f=root/rel
 if rel in known or not f.is_file():bad.append((rel,'missing/duplicated'));continue
 known.add(rel)
 if f.stat().st_size!=int(size):bad.append((rel,'size mismatch'));continue
 if hashlib.sha256(f.read_bytes()).hexdigest()!=digest:bad.append((rel,'sha mismatch'))
actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p!=m}
if known!=actual:bad.append(('inventory','unexpected '+str(sorted(actual-known))+' / missing '+str(sorted(known-actual))))
if bad:
 for item in bad:print('FAIL',item)
 raise SystemExit(1)
print(f'PASS manifest SHA256 and exact inventory: {len(records)} non-manifest files')
