#!/usr/bin/env python3
"""Build a reproducible project ZIP with per-file hashes, verify clean extraction.
Every invoked check is static and explicitly NOT database proof."""
from pathlib import Path
import subprocess,hashlib,zipfile,tempfile,shutil,sys
root=Path(__file__).resolve().parents[1]
out=Path(sys.argv[1]) if len(sys.argv)>1 else root.parent/'BookCore-Phase-02-Technical-Spike-Verified.zip'
if out.is_relative_to(root):raise SystemExit('Do not package ZIP inside source tree')
excluded={'MANIFEST.md'}
all_files=sorted([p for p in root.rglob('*') if p.is_file() and not set(p.parts).intersection({'node_modules','.git','dist','.cache'})
 and p.relative_to(root).as_posix() not in excluded],key=lambda p:p.relative_to(root).as_posix())
lines=['# BookCore Phase 02 FINAL execution candidate — SHA-256 MANIFEST','',
 '**Generated:** 2026-11-22. **Provenance:** authoritative Verified Phase 02 ZIP preserved under `reference/original_phase02_verified/`; Phase 01 baseline unchanged.',
 '**Status:** No PostgreSQL runtime experiment executed; NOT validated. Authentic npm lockfile missing due to EAI_AGAIN DNS failure. See PHASE_02_FINAL_REPORT_FA.md.',
 '**Hashing rule:** Every packaged project file except this `MANIFEST.md` is listed below. Self-hashing the manifest would be recursive.',
 '', '| Relative path | SHA-256 | Bytes | Role |', '|---|---|---:|---|']
for path in all_files:
 rel=path.relative_to(root).as_posix()
 digest=hashlib.sha256(path.read_bytes()).hexdigest()
 role=('original immutable engineering reference' if rel.startswith('reference/') else 'test/verification evidence' if rel.startswith('evidence/') else 'runtime spike or regression source' if rel.startswith('spike/') else 'engineering report or ADR' if rel.startswith('docs/') else 'CI workflow' if rel.startswith('.github/') else 'configuration/runbook/verification')
 lines.append(f'| `{rel}` | `{digest}` | {path.stat().st_size} | {role} |')
(root/'MANIFEST.md').write_text('\n'.join(lines)+'\n')
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=8) as z:
 for p in sorted([*all_files,root/'MANIFEST.md'],key=lambda x:x.relative_to(root).as_posix()):
  z.write(p,arcname='BookCore_Phase_02/'+p.relative_to(root).as_posix())
with zipfile.ZipFile(out) as z:
 assert z.testzip() is None,'ZIP CRC integrity failed'
 with tempfile.TemporaryDirectory(prefix='bookcore-clean-') as t:
  z.extractall(t)
  extracted=Path(t)/'BookCore_Phase_02'
  checks=[['python','tools/verify_package.py'],['python','tools/verify_reference.py'],
          ['node','tools/static_checks.mjs'],['node','tools/run_tests.mjs','--self-test']]
  for argv in checks:
   r=subprocess.run(argv,cwd=extracted,text=True,capture_output=True,timeout=35)
   print('CHECK', ' '.join(argv),'EXIT',r.returncode, r.stdout.strip()[:500],r.stderr.strip()[:500])
   if r.returncode:raise RuntimeError(f'clean-extraction verification failed {argv}')
  r=subprocess.run(['npm','test'],cwd=extracted/'spike',text=True,capture_output=True,timeout=35)
  if r.returncode==0:raise RuntimeError('npm test must not succeed without compiled test artifacts')
  print('CHECK npm test EXIT',r.returncode,'(expected nonzero: compiled tests absent)')
  if 'compiled test directory missing' not in (r.stdout+r.stderr):
    raise RuntimeError('test runner did not explain missing build from clean extraction')
print('FINAL ZIP CRC CLEAN, SHA256 INVENTORY VERIFIED, CLEAN STATIC CHECKS PASS')
print('PATH',out,'BYTES',out.stat().st_size)
