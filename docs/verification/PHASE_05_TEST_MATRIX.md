# BookCore — Phase 05 Test & Traceability Matrix

**Scope:** tests defined in source are not presumed executed. Real PostgreSQL tests require Migration 006 applied by migration-owner; HTTP uses a different restricted Runtime role.

| Requirement | Source/test | Target acceptance | Evidence in this environment | Status |
|---|---|---|---|---|
| P5-BR-01 Branch create/list and cursor | `CatalogService`, `catalog-postgres.test.ts` first test | Tenant and role-checked, 201/200; cursor stable max100 | source only | NOT VERIFIED |
| P5-SV-01 Service duration & tenant ID | `CreateServiceDto`, first PG test | 5..1440, own org only | source only | NOT VERIFIED |
| P5-RS-01 TRAINER unique under concurrency | `006`, second PG test | 2 parallel requests -> 1x201 + 1x409, SQL count=1 | source only | NOT VERIFIED |
| P5-RS-02 ROOM/Trainer same-tenant references | `006`, PG tests | cross-tenant FK rejected, active membership in trigger | source only | NOT VERIFIED |
| P5-HR-01 Overnight/weekly boundary | `availability.test.ts`, `test-availability-pure.cjs` | no Sunday/Monday drift, adjacent ranges allowed | 13 independent pure checks PASS | PASS (pure only) |
| P5-HR-02 Weekly active overlap | `006`, third PG test | overlapping Sunday→Monday 409; deactivated rule retained | no PG | NOT VERIFIED |
| P5-EX-01 Exception precedence | `availability.test.ts` | CLOSED wins over OPEN_OVERRIDE | pure checks PASS | PASS (pure only) |
| P5-EX-02 DB exclusion and audit | `006`, third PG test | overlapping active exception 409; deactivation saved; Audit+Outbox | no PG | NOT VERIFIED |
| P5-TZ-01 Explicit UTC offset and DST | `availability.test.ts`, pure script | Tehran valid, Berlin missing/ambiguous rejected | pure checks PASS | PASS (pure only) |
| P5-AV-01 No counterfeit final availability | `availability.ts` | never indicates capacity/resource conflict checked | pure checks PASS | PASS (pure only) |
| P5-AU-01 Privileged writes/revoked membership | `CatalogService.writer`, PG tests | original AuthSession + Membership active under TX lock | code only | NOT VERIFIED |
| P5-AU-02 Trainer view restrictions | `CatalogService.list`, PG tests | resources GET 403; schedule only own trainer Resource | code only | NOT VERIFIED |
| P5-DTO-01 Nullable optional fields rejected | `catalog-dto.test.ts` | null branchId/resourceId/address rejected by DTO instead of reaching SQL or TypeError | Source added, not executed | NOT VERIFIED |
| P5-CON-01 OpenAPI 12 CRUD endpoints | `phase05_contract_check.py` | YAML strictly parsed, no bad refs, schema/param/role mapped | static script run | PASS (static only) |
| P5-BLD-01 npm clean reproducibility | package.json/CI | npm ci + typecheck + build + lint + all tests | registry `EAI_AGAIN`; lock absent | NOT VERIFIED |
| P2-P4 | All inherited Phase02–04 security/capacity tests | original Acceptance Matrix unchanged | reports in `reference` and deferred register | NOT VERIFIED |

Re-run P5 tests after `npm ci`, migrate twice, `npm run test:unit`, `npm run test:integration`, direct reconciliations, then inspect final DB rows independently. Test existence is not PASS.
