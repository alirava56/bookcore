#!/usr/bin/env python3
"""Validate every file listed in BookCore's SHA-256 manifest and reject missing/unlisted entries."""
from pathlib import Path
import hashlib,re,sys
root=Path(__file__).resolve().parent.parent
manifest=root/'MANIFEST.md'
entries={}
for line in manifest.read_text(encoding='utf-8').splitlines():
 m=re.match(r'^\| `([^`]+)` \| `([0-9a-f]{64})` \| (\d+) \|$',line)
 if m:
  name,digest,size=m.group(1),m.group(2),int(m.group(3))
  if name in entries:raise SystemExit(f'DUPLICATE_MANIFEST_PATH: {name}')
  entries[name]=(digest,size)
actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p.name!='MANIFEST.md'}
if actual!=entries.keys():
 print('missing entries:', sorted(actual-entries.keys()))
 print('stale entries:', sorted(entries.keys()-actual))
 raise SystemExit('MANIFEST_INVENTORY_MISMATCH')
for name,(digest,size) in entries.items():
 f=root/name
 if f.stat().st_size!=size or hashlib.sha256(f.read_bytes()).hexdigest()!=digest:
  raise SystemExit('MANIFEST_SHA_MISMATCH:'+name)
print(f'PASS Phase09 SHA-256 inventory: {len(entries)} files, no missing/unlisted files')
