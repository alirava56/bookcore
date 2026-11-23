# BookCore — Phase 01 Design Deliverable

**Engineering Prompt 01 of 16 — DESIGN ONLY, NO IMPLEMENTATION.**

This package includes the original **unchanged** BC-SENG-001 v1.0 baseline and the Phase 01 implementation-oriented design documents beneath `docs/`. Explanations are mainly in Persian, with SQL / API identifiers in English. All runtime tests and deployments remain NOT VERIFIED.

Start with `docs/engineering/PHASE_01_FINAL_REPORT_FA.md`, then read `01_BASELINE_AUDIT_FA.md`, `DOMAIN_MODEL_FA.md`, `STATE_MACHINES_FA.md`, `ARCHITECTURE_FA.md`, `DATABASE_DESIGN_FA.md`, `THREAT_MODEL_FA.md`, `openapi.yaml`, and `REQUIREMENTS_TRACEABILITY.md`. ADRs and open decisions preserve rationale and outstanding constraints.

Use this `docs/` directory in a BookCore repository. No repository was mounted for this run, so **no live repository files or GitHub branches have been modified**. This is not a deployed service or a set of executable NestJS modules.

**Last design verdict:** `DESIGN-READY FOR TECHNICAL SPIKE`, not release-ready. Before the next implementation phase, execute TS-01..07 and get Product decisions PD-01..09 confirmed where required.

## Phase 01 final correction 2026-11-22
- Corrected OpenAPI **1.1.1-design**: 31 path objects, 38 operation pairs; anonymous published-only public Session paths and bearer-only staff Session paths use disjoint response DTO schemas.
- `/me` authoritative contract returns User + ACTIVE-only Membership array; timestamps distinguish IANA-offset-validated scheduling inputs vs UTC `Z` outputs and event times; readiness requires monitorAuth.
- `docs/security/AUTHORIZATION_MATRIX.md` is the authoritative full-operation access control table; `docs/verification/STATIC_DESIGN_VALIDATION.md` contains executed static checks, while T-01..T-47 remain **unexecuted** runtime test specifications.
- `MANIFEST.md` provides source roles and SHA-256 digest per packaged file. No backend, migrations, GitHub changes, credentials or dependencies have been generated.
