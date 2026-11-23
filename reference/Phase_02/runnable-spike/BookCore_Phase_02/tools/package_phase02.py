#!/usr/bin/env python3
"""Reproducible inventory and integrity checks; excludes runtime dependencies and build output."""
from pathlib import Path
from hashlib import sha256
from zipfile import ZipFile,ZIP_DEFLATED
import os

root=Path(__file__).resolve().parents[1]
output=root.parent/'BookCore-Phase-02-Technical-Spike.zip'
exclude_dirs={'node_modules','dist','.git','__pycache__','.cache','coverage'}
exclude_files={'MANIFEST.md','.DS_Store','package-lock.json.tmp'}

def files():
    for path in sorted(root.rglob('*')):
        if not path.is_file() or any(k in exclude_dirs for k in path.relative_to(root).parts): continue
        if path.name in exclude_files or path.suffix in ('.pyc','.swp','.bak'): continue
        yield path

role_map={
'reference/Phase_01':'verified unchanged engineering baseline',
'spike/src':'TypeScript transaction/harness implementation',
'spike/migrations':'PostgreSQL native migrations (not executed here)',
'spike/tests':'automated tests (not run against PG here)',
'impl':'',
'infra/':'local Docker infrastructure definition (not started here)',
'evidence/':'actual command logs and observed blockers',
'docs/phase-02/':'technical analysis, ADR, final report',
'spike/':'node package/typecheck configuration and safe environment example',
'tools/':'verification, packaging and local execution scripts'
}
source=list(files())
lines=['# BookCore Phase 02 — MANIFEST', '',
       '**Date:** 2026-11-22',
       '**Claim:** Source created and statically checked; real PostgreSQL experiments NOT VERIFIED.',
       '**Phase 01:** Original 24 files inside `reference/Phase_01/BookCore_Phase_01/` with 23 SHA-256 matches verified against its manifest.',
       '**Packaging:** Excludes dependency directories, generated JS, .git, private credentials and unrelated temporary files.',
       '**Known blocker:** No trustworthy package-lock.json because dependency registry access was unavailable. Gate 8 FAIL.',
       '', '| Archive-relative file | SHA-256 | Bytes | Role |', '|---|---|---:|---|']
for path in source:
    r=str(path.relative_to(root))
    role=next((v for k,v in role_map.items() if r.startswith(k) and v),'package documentation/configuration')
    lines.append(f'| `{r}` | `{sha256(path.read_bytes()).hexdigest()}` | {path.stat().st_size} | {role} |')
lines+=['','**Manifest self-hash omitted (self-referential).** ZIP CRC is verified after assembly.',
       'Expected CI follow-up: install dependencies, generate and audit lockfile, start PostgreSQL, run migrations and tests. No passing PG results were invented.']
(root/'MANIFEST.md').write_text('\n'.join(lines)+'\n')
source=list(files())
with ZipFile(output,'w',compression=ZIP_DEFLATED,compresslevel=9) as z:
    for path in source:
        z.write(path,arcname=f'{root.name}/{path.relative_to(root).as_posix()}')
    z.write(root/'MANIFEST.md',arcname=f'{root.name}/MANIFEST.md')
with ZipFile(output) as z:
    assert z.testzip() is None,'CRC failure'
    names=set(z.namelist())
    assert len(names)==len(source)+1
    assert all('/node_modules/' not in n and '/dist/' not in n and '/.git/' not in n for n in names)
    assert f'{root.name}/docs/phase-02/PHASE_02_FINAL_REPORT_FA.md' in names
    for path in source:
        name=f'{root.name}/{path.relative_to(root).as_posix()}'
        assert sha256(z.read(name)).digest()==sha256(path.read_bytes()).digest(), name
print(f'ZIP_OK {output} files={len(names)} bytes={output.stat().st_size} sha256={sha256(output.read_bytes()).hexdigest()}')
