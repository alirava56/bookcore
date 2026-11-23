# BookCore — Phase 01 Static Validation Report (executed)

**Date:** 2026-11-22  
**Scope:** Design file validation only. No backend, PostgreSQL, auth service, API E2E, integration, load, penetration, backup, infrastructure or stakeholder approval executed.  
**Tools actually used:** ruamel.yaml 0.18.17 (strict duplicate keys), FastAPI 0.128.2 / Pydantic OpenAPI model, jsonschema 4.26.0 (Draft 2020-12), Python custom reference/path/auth/DTO/cross-document assertions.  
**Summary:** 19 PASS; 0 FAIL; 2 NOT VERIFIED.  

| Executed/Unavailable check | Result | Evidence / limitations |
|---|---|---|
| Baseline original unchanged | PASS | BC-SENG-001 original SHA256=3eb10bbc6a2679db4f70b7ef574369a2bf8b315b9585cb3b504ed4cf46609da5 |
| Strict YAML parse + duplicate-key rejection | PASS | ruamel.yaml 0.18.17; allow_duplicate_keys=False; parsed full OpenAPI source |
| OpenAPI 3.1 root keys and method count | PASS | Found 38 operations in 31 path objects |
| OpenAPI structural model validation | PASS | FastAPI 0.128.2 OpenAPI Pydantic model validated entire document; not the official OpenAPI JSON meta-schema |
| Component JSON Schema meta-validation | PASS | 28 component schemas checked against JSON Schema Draft 2020-12 using jsonschema 4.26.0 |
| Complete internal $ref resolution | PASS | 423 references; missing=[] |
| Unique nonempty operationId | PASS | Distinct 38/38 |
| Path template parameters are required and consistent | PASS | 38 operations; mismatches=[] |
| Authentication requirements, no dual-anonymous staff read | PASS | 38 operations, 6 anonymous including token-body refresh, 1 monitorAuth, remaining bearer; errors=[] |
| Response coverage, RFC9457, request DTO shape | PASS | errors=[] |
| Public/staff Session response isolation | PASS | 4 distinct paths, 2 dedicated public DTOs; errors=[] |
| JSON Schema executable public-field + active /me fixtures | PASS | jsonschema 4.26.0: positive samples accepted, extra staff field, nonpublished status, revoked/omitted memberships rejected |
| Authoritative /me response matches ACTIVE-only schema | PASS | active membership enforced by schema; description explicitly includes it |
| Resource conditional required fields / no type confusion | PASS | Draft2020-12 if/then on ROOM vs TRAINER request+response; 2 valid and 4 invalid fixtures |
| Scheduling input vs UTC event/output contracts | PASS | Session+exceptions input offset/IANA; Booking createdAt, cancelledAt, all response instants UTC Z; errors=[] |
| Authorization matrix exactly matches all operation pairs | PASS | 38 table rows, 38 API pairs; missing=[], extra=[] |
| Cross-document terminology, policies and state terms | PASS | checked 10 named documents; errors=[] |
| FR/INV/NFR and T-01..T-47 traceability | PASS | FR-01..16, INV-01..14, NFR-01..10, 47 designated tests; missing=[] |
| Phase 01 package scope excludes runtime app and secrets | PASS | Design docs and static tool only; no execution/credentials claim |
| Independent third-party OpenAPI meta-schema validator | NOT VERIFIED | openapi-spec-validator/prance unavailable; attempted installation before validation; FastAPI model + Draft2020-12 + strict checks executed instead |
| Backend, API E2E, PostgreSQL, concurrency, security, restore, deployment | NOT VERIFIED | No application, database or server executed; T-01..T-47 are planned tests, all runtime NOT VERIFIED |

## Interpretation
- A PASS here means a specific static design assertion passed in the local working environment. It is NOT an OpenAPI implementation conformance certificate, security audit or database test.
- An independent external OpenAPI reference-validator run was not possible with available dependencies: it remains **NOT VERIFIED**; FastAPI OpenAPI model check and JSON Schema meta-validation were actually executed.
- Strict YAML parser rejects duplicate keys rather than silently accepting a last-value-wins contract.
- Public DTO JSON Schema negative fixtures reject internal staff fields and nonpublished status by construction; actual server projection/role enforcement is unexecuted.
- The original baseline SHA-256 is compared byte-for-byte to a pinned digest.
- Stakeholder approval and TS-01..TS-07 remain open.

**Design-validation aggregate:** PASS (all locally executable static assertions passed).
