# BookCore — Deferred Verification Register, Phase04 update

The original Phase 02/03 obligations are **not waived**. They are summarized with Phase 04 additions below. Every item is `NOT VERIFIED` until real evidence exists.

| ID | Requirement / Risk | Related source | Test or probe | Environment | Evidence now | Acceptance criterion | Status |
|---|---|---|---|---|---|---|---|
| P2-G1 | Real PG migrations and checksums | db/migrations/001–005 | npm run migrate twice | PG17, npm | unavailable | both runs successful, checksums equal | NOT VERIFIED |
| P2-G2 | DB tenant and row integrity | db/migrations/001–004 | reference Phase02 PG tests | PG17 | code only | invalid SQL rejected | NOT VERIFIED |
| P2-G3 | 100 concurrent capacity 1/20 | Phase02 spike harness | 3× two processes each | PG17 / two processes | code only | exactly 1/20 committed, no workers leaked | NOT VERIFIED |
| P2-G4 | GiST resource exclusion | migrations 001–004 | reference Phase02 tests | PG17 | code only | overlap rejected, adjacent accepted | NOT VERIFIED |
| P2-G5 | Booking Idempotency & unknown outcome | Phase02 spike | Phase02 tests | PG17 | code only | 1 effect per key | NOT VERIFIED |
| P2-G6 | Booking/session cancellation atomicity | Phase02 spike | Phase02 tests | PG17 | code only | full 15-seat commit or rollback | NOT VERIFIED |
| P2-G7 | Committed-state counter drift | migrations 001–004 | Phase02 negative SQL | PG17 | code only | invalid writes rejected | NOT VERIFIED |
| P2-G8 | Clean npm install / reproducibility | package.json | npm ci | npm Registry | ENOTCACHED, no lockfile | clean install, typecheck, tests pass | NOT VERIFIED |
| P3-A | NestJS Bootstrap runtime | app.module.ts, bootstrap.ts | HTTP unit tests | npm Registry | TS AST | /live 200, /ready 503 when DB unready | NOT VERIFIED |
| P4-01 | Global APP_GUARD default deny | common/security, app.module | global-auth.test.ts + anonymous HTTP | npm Registry | source only | absent token 401 | NOT VERIFIED |
| P4-02 | Argon2id normalized registration | identity.service + 005 | PG registration/duplicate tests | npm + PG17 | source only | no plaintext, unique | NOT VERIFIED |
| P4-03 | JWT signature/expiry/aud/kid | token.service | jwt.test.ts | npm | source only | invalid claims rejected | NOT VERIFIED |
| P4-04 | Refresh replay race | identity.service + 005 | two Promise.all refresh | npm + PG17 | source only | one child maximum, replay revokes | NOT VERIFIED |
| P4-05 | Concurrent role and last Owner protection | organizations + 005 | real concurrent PATCH | npm + PG17 | source only | last active OWNER remains | NOT VERIFIED |
| P4-06 | Cross-tenant and privilege negative SQL | authorization + 005 | RBAC integration tests | npm + PG17 | source only | foreign 404, direct DML restricted | NOT VERIFIED |
| P4-07 | Reproducible implemented OpenAPI | scripts/generate-openapi.ts | npm run openapi:current | npm | source only | 12 routes, no future paths | NOT VERIFIED |
| P4-08 | Auth secrets/limit security under load | Argon2 / rate-limit guard | soak, brute/DoS | staging PG17 | none | bounded memory/latency | NOT VERIFIED |
| P4-09 | Refresh lost COMMIT UX | identity.service and UoW | fault injection | PG17 / proxy | none | recovery semantics agreed and verified | NOT VERIFIED |

**Release constraint:** Production release is blocked until Phase 02 gates, Phase04 critical auth/token/tenant gates, and cleanroom CI are demonstrably passing. Development deferral is not a release waiver.

## Phase 05 additional deferrals (2026-11-22)

| ID | Requirement / Risk | Related source | Test | Required environment | Evidence now | Future acceptance criterion | Status |
|---|---|---|---|---|---|---|---|
| P5-G1 | Branch CRUD & pagination / unauthorized cross-tenant | catalog.controller/service | catalog-postgres.test.ts #1 | npm + PostgreSQL 17 | source only | 201/200 scoped + 404 foreign, SQL rows confirmed | NOT VERIFIED |
| P5-G2 | Service validation | DTO + service | catalog-postgres.test.ts #1 | npm + PG17 | source only | Invalid duration rejected and valid persisted | NOT VERIFIED |
| P5-G3 | Resource duplicate/trainer membership | SQL006, service | catalog-postgres.test.ts #2 | npm + PG17 with 2 pools | source only | exactly one trainer Resource, revoked user rejected | NOT VERIFIED |
| P5-G4 | Weekly overlap and inactive history | SQL006, hours service | catalog-postgres.test.ts #3 | PG17 | source only | conflicting overlap rejected, deactivation retained | NOT VERIFIED |
| P5-G5 | Exception exclusion + outbox | SQL006, exceptions service | catalog-postgres.test.ts #3 | PG17 | source only | 23P01, API409, audit and outbox same transaction | NOT VERIFIED |
| P5-G6 | Zone/availability DB input | availability + CatalogService seam | pure tests + future transaction E2E | Node + PG17 | 13 pure checks PASS only | DST, buffers and local timezone match database timestamps | NOT VERIFIED (DB) |
| P5-G7 | RBAC Trainer visibility and membership revocation race | catalog list/writer | catalog-postgres.test.ts + controlled contention | PG17 / multi sessions | source only | blocked by immediate revocation, no foreign data | NOT VERIFIED |
| P5-G8 | Migration 006 additive on existing 005 data | SQL006 + checksum ledger | clean and upgrade migration twice | PostgreSQL 17 | checksum static | migration success, no drift, triggers reject bad SQL | NOT VERIFIED |
| P5-G9 | Generated implementation-only Swagger | catalog DTO + controller | npm run openapi:current | npm | design contract checked only | 24 implemented routes incl 12 Phase05 operations | NOT VERIFIED |
| P5-G10 | Build/test reproducibility | CI Phase05 workflow | npm ci + typecheck + lint + build + test | npm Registry + PG17 | `EAI_AGAIN`, pure tests only | zero skipped, all tests PASS, clean extraction | NOT VERIFIED |

### Carryover acceptance blockers

Phase02 G1–G8 and Phase04 refresh unknown COMMIT, staff-membership consent, credential security, real JWT/E2E and shared-proxy rate-limit calibration remain unresolved. Pure Availability checks do not close these gates.

## Phase 06 additional deferrals (2026-11-22)

| ID | Requirement/risk | Related source | Test/probe | Environment | Evidence | Acceptance | Status |
|---|---|---|---|---|---|---|---|
| P6-G1 | Session Draft atomicity | session.service.ts | I06-01/02 | Node/Nest + PG17 | source only | row and allocations commit together | NOT VERIFIED |
| P6-G2 | Buffer + resource exclusion | Migration001 + Catalog Engine | I06-02 + Phase02 | PG17 | source only | adjacent success/overlap failure, no drift | NOT VERIFIED |
| P6-G3 | Publish and recheck | session.service.ts | I06-01 | PG17 | source only | no inactive trainer/service or invalid time | NOT VERIFIED |
| P6-G4 | Staff listing scoped at query time | session.service.ts | I06-01 + revocation race | PG17 | source only | no trainer/tenant data exposure | NOT VERIFIED |
| P6-G5 | Public allowlist and rate limiting | session.controller/service.ts | I06-01 + rate-limit unit | PG17 | static contract pass | Published-only fields; auth remains fail-closed | NOT VERIFIED |
| P6-G6 | 15 Booking atomic cancel + idempotency | session.service.ts | I06-03/04 | PG17 | source only | all or none; 15 events/outbox | NOT VERIFIED |
| P6-G7 | Finish after end | session.service.ts | delayed-clock integration | PG17 | source only | only PUBLISHED after end, no attendance writes | NOT VERIFIED |
| P6-G8 | Capacity vs Booking concurrency | session.service.ts / Phase02 adapter | Phase02 harness + new test | PG17/two processes | source only | no overbooking/counter drift | NOT VERIFIED |
| P6-G9 | Revoked actor & tenant role races | authorization.service.ts | revocation integration | PG17 | source only | no unauthorized committed mutation | NOT VERIFIED |
| P6-G10 | Migration007 grants, checksum, PG constraints | SQL007/checksums | 2× migrations, negative SQL | PG17 | static hash pass | all PG constraints and grants work | NOT VERIFIED |
| P6-G11 | Package cleanroom, full Node/Nest tests, CI | CI / scripts | npm ci + build + tests | npm Registry / PG17 | `EAI_AGAIN` and `ENOTCACHED` | no skipped/zero tests, all green | NOT VERIFIED |


## Phase 07 — الزامات باز مانده (آزمایش‌های PostgreSQL بدون اجرای واقعی)

| ID | ریسک/سناریو | فایل آزمون یا منبع | معیار پذیرش | وضعیت |
|---|---|---|---|---|
| P7-01 | ظرفیت ۱/۲۰ در ۱۰۰ درخواست × سه بار × دو Process واقعی | `booking-postgres.test.ts` | ۱/۲۰ رزرو مؤثر و رویداد اولیه برابر، Worker shutdown پاک | NOT VERIFIED |
| P7-02 | Replay و کلید متفاوت، لغو دوگانه و 409 پایدار | همان + `booking.service.ts` | یک اثر جانبی، Reply پایدار | NOT VERIFIED |
| P7-03 | لغو کامل Session با ۱۵ رزرو | همان + `session.service.ts` | Counter صفر، ۱۵ Event، Allocation غیرفعال | NOT VERIFIED |
| P7-04 | Drift ناشی از SQL مستقیم و Cross-tenant FKs | همان + Migrationهای 001–008 | COMMIT نامعتبر با SQLSTATE مناسب رد شود | NOT VERIFIED |
| P7-05 | کاهش ظرفیت و ایجاد رزرو موازی | همان | هیچ `seats_committed>capacity_total` پایدار نباشد | NOT VERIFIED |
| P7-06 | ثبت حضور با FINISHED و Assigned Trainer | تست تکمیلی موردنیاز | عضویت و Resource صحیح، Counter بدون تغییر | NOT VERIFIED |
| P7-07 | Revocation رقابتی و وضعیت COMMIT نامعلوم | تست Fault Injection تکمیلی | پذیرش فقط با مجوز زنده و بازیابی با همان Key | NOT VERIFIED |
| P7-08 | Consent رزرو به نمایندگی از مشتری | تصمیم محصول/امنیت | مجوز معتبر و ثبت دلیل/mandate؛ فعلاً Fail-closed | OPEN |
| P7-09 | CORS و Rate Limit با Replica/Reverse Proxy | HTTP/Edge load test | محدودیت منصفانه NAT، XFF غیراصیل پذیرفته نشود | NOT VERIFIED |
| P7-10 | npm ci، lint، typecheck، Build، NestJS tests، migrations/CI | package scripts / CI | Lockfile واقعی + تمام تست‌ها PASS | NOT VERIFIED |
| P7-11 | Recovery ایجاد Session از COMMIT نامعلوم | SessionService و ADR-007 | Idempotency یا Recovery اثبات‌شده؛ فعلاً ریسک باز | OPEN |

هشت Gate معوق فاز دوم و ریسک‌های فازهای چهارم تا ششم همچنان مستقل باز هستند. در این محیط فقط آزمون‌های Pure و کنترل‌های استاتیک اجرا شده‌اند.

## Phase 08 additions (2026-11-22)

The full inherited register above remains authoritative. New unresolved obligations:

| ID | Risk | Code / DB | Required environment | Proof required | Status |
|---|---|---|---|---|---|
| P08-R01 | Microsecond cursor can silently omit rows | `booking.domain.ts`, `booking.service.ts` | PostgreSQL 17, API | Six intra-ms rows across two pages with no omission or duplicates | NOT VERIFIED |
| P08-R02 | Wrong code for unrelated unique error | `booking-error.ts` | PostgreSQL | Real different constraint names and error response | NOT VERIFIED |
| P08-R03 | Duplicate-vs-full precedence | `booking.service.ts` | PostgreSQL + NestJS HTTP | Already-booked customer receives `BOOKING_ALREADY_EXISTS` on full Session | NOT VERIFIED |
| P08-R04 | Aggregate status/count semantics | `reporting.service.ts` | Real DB with historical statuses | Counts for FINISHED/CANCELLED and rebooking; accurate snapshot under writes | NOT VERIFIED |
| P08-R05 | Reporting BOLA/BFLA | `reporting.service.ts` | JWT, PG, multi-tenant fixtures | OWNER/MANAGER only and no foreign data/PII | NOT VERIFIED |
| P08-R06 | Worker concurrency | `outbox.worker.ts` | Two Worker processes + PostgreSQL | One claim per available event; no duplicate durable Receipt | NOT VERIFIED |
| P08-R07 | Claim expiration and crash | `outbox.worker.ts` | PG + fault injection | expired lease reclaim; no lost event | NOT VERIFIED |
| P08-R08 | Poison payload and quarantine | `outbox.domain.ts`, worker | PG | malformed event fails permanently; no false published_at | NOT VERIFIED |
| P08-R09 | Database grants/trigger compatibility | `009_outbox_delivery.sql` | PG17 migration-owner + restricted worker | Fresh and populated migrations, permission denial on forbidden writes | NOT VERIFIED |
| P08-R10 | Startup/clean source reproducibility | package.json, Docker/CI | npm Registry, PostgreSQL 17 | npm ci/typecheck/lint/build/unit/integration/CI all pass | NOT VERIFIED |
| P08-R11 | Aggregate causal ordering | `outbox.worker.ts` | Concurrent producer/worker processes | Correct order under concurrent COMMIT or new sequence strategy | NOT VERIFIED |
| P08-R12 | External delivery | no provider configured | Future provider with idempotency | Provider response and failure replay, not internal receipt alone | NOT IMPLEMENTED |


## Phase 09 — Security Governance carryovers (2026-11-23)

Previous Phase 02–08 entries above remain OPEN unless independently verified by actual PostgreSQL/NestJS execution. Static and Pure test successes never close a database gate.

| ID | Risk / acceptance requirement | Code and test source | Runtime evidence required | Current status |
|---|---|---|---|---|
| P09-01 | Real npm reproducibility | `package.json`, workflow Phase09 | Authentic `package-lock.json`, successful `npm ci`, Typecheck, ESLint, Build | FAIL: registry/cache unavailable |
| P09-02 | Staff invitation acceptance/revocation races | governance.service.ts, `phase09-postgres.test.ts` | Two concurrent DB connections; one ACTIVE membership; cross-tenant denial | NOT VERIFIED |
| P09-03 | Invitation token theft/expiry and delivery | governance.service.ts | HTTP E2E, time control, controlled token delivery, no raw token logs | NOT VERIFIED |
| P09-04 | Consent/revocation vs staff Booking | booking.service.ts, governance.service.ts | PG17 2 workers; no new Booking after revoke Commit; audit correct | NOT VERIFIED |
| P09-05 | Refresh token unknown COMMIT and replay | identity.service.ts, ADR-028 | Real fault injection; single valid descendant; logout/re-auth | NOT VERIFIED |
| P09-06 | Session creation idempotency | session.service.ts, docs/api/openapi.yaml | HTTP lost ACK, same-key replay, same payload/different payload | NOT VERIFIED |
| P09-07 | Outbox event v1 historical compatibility | outbox.domain.ts | Compare against real corpus of old committed events; poison quarantined, no benign false failures | NOT VERIFIED |
| P09-08 | Outbox lease fencing and 2-worker race | outbox.worker.ts | PG17, two independent processes, slow handler, lease expiry; one receipt/projection per event | NOT VERIFIED |
| P09-09 | CLI quarantine recovery safety | migration 010, scripts/outbox-recovery.ts | Restrict `bookcore_ops`; only authorized current owner + reason; event history retained | NOT VERIFIED |
| P09-10 | Migration 010 with pre-existing data | 001–010 SQL, migration checksums | Fresh and populated PG17 install twice; invalid SQL mutations rejected | NOT VERIFIED |
| P09-11 | Cross-tenant/role HTTP authorization matrix | governance.controller/service, original modules | JWT, live session, revoked role, protected paths, no PII leakage | NOT VERIFIED |
| P09-12 | Abuse-rate limits behind ingress | governance-rate.guard.ts, proxy config | NAT fairness, multiple replicas, XFF spoof test, TTL/cleanup | NOT VERIFIED |
| P09-13 | Baseline core capacity/security races | Phase 02–08 harness and registers | Two PostgreSQL processes × capacity 1/20 with 3 runs each; full E2E | NOT VERIFIED |
| P09-14 | CI pipeline execution | `.github/workflows/backend-phase09.yml` | Actual GitHub Actions run on authorized repo and stored result | NOT VERIFIED (not run) |
| P09-15 | Authorization and consent product policy | ADR-027, PHASE_09_SECURITY_MODEL_FA.md | Owner confirmation of consent scope, duration, invitation channel/UX | OPEN PRODUCT DECISION |

### Phase09 observed static checks

- `npm run verify:reference`, `npm run verify:static`: PASS at source/Manifest level.
- 57 Pure tests from `npm run test:*:isolated`: PASS (no PostgreSQL involvement).
- `python tools/phase09_validate_openapi.py`: PASS, 46 operations and 507 local refs.
- `npm install --package-lock-only`, `npm ci`, Typecheck, Lint and Build: unsuccessful; raw logs in `evidence/phase09/`.
- No real PostgreSQL or GitHub Actions was executed.

## Phase 10 operational integrity additions (2026-11-23)

| ID | Risk | Source | Acceptance | Status |
|---|---|---|---|---|
| P10-01 | Apply migration 011 on populated PG17, rollback of failed schema | db/migrations/011_operational_integrity.sql | Fresh + populated upgrade, twice apply, checksum, schema and grants | NOT VERIFIED |
| P10-02 | Operator identity cannot be forged by Actor UUID, SET ROLE, custom GUC or another tenant | outbox-recovery.ts, bound function, phase10-postgres.test.ts | session_user bound, deny unrelated tenant, audited identity | NOT VERIFIED |
| P10-03 | Read-only inspector comprehensive coverage | operational-integrity.ts | Bounded, no data changes, full pagination/known sample limits | PARTIAL: source implements bounded subset |
| P10-04 | ID retention and unknown COMMIT recovery | operations.domain.ts | Policy signed off, no premature deletion, safe multi-process cleanup | OPEN PRODUCT POLICY; purge disabled |
| P10-05 | Rate bucket bounded cleanup/maintenance races | lifecycle-maintenance.ts, SQL011 | ≤100 rows, ≥48h, immutable audit, parallel API no corruption | NOT VERIFIED |
| P10-06 | Invitation lost HTTP response recovery | phase09-postgres.test.ts | pending list no secret; revoke/issue new; old token fails | NOT VERIFIED |
| P10-07 | Full history chain, missing outbox business events, cross-module audit | bookcore_inspect_tenant | Complete scanner and validated findings | PARTIAL: sample diagnostics only |
| P10-08 | Cross-module lock ordering under races | organization/booking/outbox/invite, Phase02–09 tests | no deadlocks/invalid state under contention | NOT VERIFIED |
| P10-09 | Real clean npm + PostgreSQL17 CI | .github/workflows/backend-phase10.yml | npm ci/typecheck/lint/build/migrate/tests all PASS | NOT VERIFIED, no lockfile |


## Phase 11 — MVP Integration / Inspector runtime deferrals (2026-11-23)

| ID | Requirement | Source / executable test | Environment | Current evidence | Acceptance | Status |
|---|---|---|---|---|---|---|
| P11-01 | Migration 012 on fresh and populated database | SQL012, `phase11-postgres.test.ts` | PostgreSQL17 with owner+inspector LOGIN | SHA/static only | migrate twice, no drift, 011 data intact, SQL valid | NOT VERIFIED |
| P11-02 | BookingEvent `event_order` with same timestamps/UUID inversion | SQL012, `phase11-inspection.test.ts` + PostgreSQL fixture | PostgreSQL17 | ۵ Pure cases PASS only | DB check finds missing/duplicate/invalid/terminal events, legacy provenance | NOT VERIFIED (PG) |
| P11-03 | Complete bounded inspection >100 objects/resume | `operational-inspection-v2.ts`, `phase11-postgres.test.ts` | PG17 / distinct inspector login | HMAC/bounds Pure PASS | 105 records enumerated without duplication, watermark stable, no cross-tenant | NOT VERIFIED (PG) |
| P11-04 | Operator negative privileges | `phase11-postgres.test.ts` | separate real PG LOGINs | source tests written | unbound, disabled, suspended, role mismatch, SET ROLE and GUC cannot bypass | NOT VERIFIED |
| P11-05 | Full MVP HTTP workflow A–G | `phase11-mvp-http.test.ts` | NestJS/PG17 | source test written | all assertions, DB rows, independent AuthSession, no PII leakage | NOT VERIFIED |
| P11-06 | CI/npm lock reproducibility | `package.json`, phase11 workflow | npm registry + GitHub authorized repo | EAI_AGAIN, no lockfile | authentic npm ci/typecheck/lint/build + all tests | FAIL / NOT VERIFIED |
| P11-07 | Cross-module races, 100-request booking, Outbox multiworker | inherited phase02–10 tests | two processes, PostgreSQL17 | no runtime | all 2-process 3x contention; no counter drift, no deadlocks | NOT VERIFIED |
| P11-08 | Operational registry provisioning audit and unique physical operator | `bookcore_operator_identities`, ADR031 | production IAM policy, DBA | account binding only | unique operator credential, provisioning and revocation auditable | OPEN POLICY |
| P11-09 | Unbounded historical Outbox gaps and booking aggregate history consistency | SQL012 | populated PG17 | bounded reader only | inspect all historical chain, missing Outbox record diagnosis | PARTIAL / NOT VERIFIED |
| P11-10 | Snapshot consistency across inspector pages | SQL012 / CLI | PG17 under concurrent mutations | watermark not full snapshot | reconcile repeatable runs, define operational quiescence or exported snapshot | OPEN POLICY |
| P11-11 | Idempotency purge, retention and uncertain COMMIT | prior ADRs/services | real DB faults | purge disabled | retention policy with no duplicate business effects | OPEN POLICY |

## Phase 12 — Data Protection / Backup and Disaster Recovery (2026-11-23)

All Phase 02–11 obligations above **remain OPEN**. Source checks do not close runtime obligations.

| ID | Requirement / residual risk | Implemented artifact | Runtime environment | Acceptance evidence | Status |
|---|---|---|---|---|---|
| P12-01 | Restore after successful real pg_dump | `scripts/recovery/backup.cjs`, `restore.cjs`, `phase12-backup-restore.test.ts` | PG17 binaries, backup and restore separate disposable DBs | Real snapshot, SHA, SQL ledger, data counts, restore exit=0 | NOT VERIFIED |
| P12-02 | Backup encryption and secure offsite retention | `backup.cjs`, age optional | age and private key vault, offline storage | Decrypt/archive list + restore, independent hash, key recovery | NOT VERIFIED |
| P12-03 | False positive Restore success prevented | `restore.cjs` target/role/ledger checks | PG17 with distinct LOGINs | Empty/comment-marked target succeeds, non-empty and remote denied | NOT VERIFIED |
| P12-04 | Last-owner fixture and trigger compatibility | `phase11-postgres.test.ts` | Disposable PG17 | 2-owner revoke allowed; last-owner revoke 23514 | NOT VERIFIED |
| P12-05 | Single-kind vs complete inspection exit semantics | `inspection.domain.ts`, `operational-inspection-v2.ts` | Node + PG17 CLI | Unit outcomes + actual CLI process exit for scoped and six-kind | SOURCE TESTED; PG NOT VERIFIED |
| P12-06 | Retention and Idempotency duplicate safety | `retention-preview.cjs`, existing maintenance | PG17, parallel Booking, signed product retention policy | No duplicate committed mutation across expired-key window | OPEN POLICY; destructive delete DISABLED |
| P12-07 | PITR WAL replay | `docs/reliability/PITR_STRATEGY_FA.md` | Base Backup + continuous WAL archive + isolated PG | A present/B absent with recovery_target_time; signed exercise | NOT IMPLEMENTED / NOT VERIFIED |
| P12-08 | Storage growth and alert accuracy | `storage-growth.cjs` | Approved monitoring LOGIN + PG17 | Estimate vs known fixtures, low overhead under load | NOT VERIFIED |
| P12-09 | API/Worker hardening under Compose | `infra/docker/compose.yml` | Docker Engine, real volumes | Running unprivileged, health, restart, no unintended writes | NOT VERIFIED |
| P12-10 | Security audit of backup access and restore operator | phase12 docs/runbooks | Managed secrets and operator authentication | No secret leakage, denied unrelated LOGIN/target, role ACL verified | NOT VERIFIED |
| P12-11 | npm reproducibility and CI | package scripts, backend-phase12.yml | Public npm registry / GitHub authorized repo | Authentic lockfile + npm ci + typecheck + lint + build + tests | FAIL / NOT VERIFIED |
| P12-12 | Host-loss DR exercise | DISASTER_RECOVERY_FA.md | Separate host and isolated network | restore + checks + objective RPO/RTO measured and approved | NOT VERIFIED |
| P12-13 | Data set integrity after recovery | inherited Booking/Outbox/Identity tests | PG17 with synthetic real data | Counters/History/Receipt/Consent/auth stable after restore | NOT VERIFIED |


## Phase 13 — الزامات اضافه‌شده (بدون حذف تعهدات قبلی)

| موضوع | ریسک | معیار پذیرش | وضعیت |
|---|---|---|---|
| Metrics HTTP امن | دسترسی عمومی یا Label پرکاردینال | HTTP واقعی 401/403 + 200 با IP مجاز؛ Scrape بدون PII | NOT VERIFIED |
| Query/Pool performance | کندی و Lock تحت بار | EXPLAIN و p95/p99 واقعی با دادهٔ مصنوعی | NOT VERIFIED |
| Capacity 100×2×3 | overbooking / lost event | 6 اجرای واقعی، شمارش persisted، دو پروسه و لاگ خام | NOT VERIFIED |
| Backup source/server 17 | نسخهٔ ناسازگار/مبدأ اشتباه | psql و pg_dump واقعی + ثبت هویت | NOT VERIFIED |
| Restore 17 isolated | حذف یا تغییر دادهٔ مقصد | نقش مستقل، isolation، RESTORE، Ledger و Data Integrity | NOT VERIFIED |
| age key separation | سرقت Decryption Identity | Producer بدون کلید خصوصی + Verifier جدا با Decrypt/Restore واقعی | NOT VERIFIED |
| Manifest provenance | جعل مشترک فایل و Manifest | Hash/Signature در محل مستقلاً کنترل‌شده | NOT VERIFIED |
| Writer race in Restore | تغییر مقصد پس از preflight | نمونهٔ ایزوله بدون Writer و تست Race واقعی | NOT VERIFIED |
| npm reproducibility | نصب/Build غیرقابل بازتولید | package-lock واقعی + npm ci + Typecheck + Lint + Build | NOT VERIFIED |


## Phase 14 — Release blockers (2026-11-23)

| ID | Risk / Requirement | Exact evidence now | Acceptance criterion | Status |
|---|---|---|---|---|
| P14-01 | Restore trusted executable selection | Pure negative tests in `test:phase14:isolated` PASS | Isolated actual restore uses trusted pinned binaries and verified operator | NOT VERIFIED (runtime) |
| P14-02 | Private age identity and readable CA | Source tests PASS, no actual encrypted restore | Private key secure, CA verify-full, real decrypt-and-restore | NOT VERIFIED (runtime) |
| P14-03 | Booking 5xx acceptance bug | Source regression `503` rejected | Two-process PG17 concurrency 3× capacity1/20, no unexpected 5xx/timeout | NOT VERIFIED (runtime) |
| P14-04 | Authentic npm lockfile and clean Build | npm lock resolution Exit124 timeout; npm ci Exit1; typecheck/build fail | Real npm registry and `npm ci`, typecheck, lint, build succeed | BLOCKED |
| P14-05 | All historical PG migrations and role grants | 12 checksum source matches; no PG execution | Two fresh migrations + populated upgrade + negative SQL with role separation | NOT VERIFIED |
| P14-06 | End-to-end NestJS HTTP | Smoke test source exists | Real boot and 46-route contract / authenticated & anonymous HTTP | NOT VERIFIED |
| P14-07 | Worker lease/fencing/Outbox receipts | Prior tests retained | Two Worker processes and persisted receipt reconciliation | NOT VERIFIED |
| P14-08 | Backup/Restore/PITR | Mock tests pass only | Real PG17 custom dump/age decrypt/restore/WAL replay and data checks | NOT VERIFIED |
| P14-09 | CI execution | YAML file present, no repository run | Real GitHub Actions run with saved logs | NOT VERIFIED |

Historical Phase02–13 risks above remain open independently. No release clearance.


## Phase 15 — checkpoint obligations (2026-11-23)

- P15-01: authentic npm lockfile, clean `npm ci`, strict typecheck, lint, build, unit tests — BLOCKED (registry not reachable; `package-lock.json` absent).
- P15-02: PostgreSQL17 001–012 migrations/role grants/security triggers — NOT VERIFIED (PostgreSQL unavailable).
- P15-03: Full MVP NestJS HTTP, 100×2×3 booking, negative security and cross-operation races — NOT VERIFIED.
- P15-04: Two-Worker lease/retry/receipt audit — NOT VERIFIED.
- P15-05: Real restore, age decryption, separate trusted provenance, PITR — NOT VERIFIED.
- P15-06: Actual CI jobs, manual separated destructive recovery environment and deep post-restore integrity — NOT RUN.
- P15-07: Deployment secrets, operational isolation, independent operator identities and approval — POLICY OPEN.

All Phase02–14 obligations remain open until independently supported by runtime evidence.


## Phase 16 — final NO-GO obligations (2026-11-23)

- F16-01: Full successful Node22 npm ci/typecheck/lint/build and artifact SBOM — NOT VERIFIED.
- F16-02: PostgreSQL17 001–012 migration ledger, ownership and privilege negative SQL — NOT VERIFIED.
- F16-03: Complete 46-domain + private Metrics HTTP contract and OWASP-aligned negative tests — NOT VERIFIED.
- F16-04: 100×2×3 capacity, cross-operation lock races, Idempotency and unknown COMMIT — NOT VERIFIED.
- F16-05: Outbox 2-worker fencing, crash and replay — NOT VERIFIED.
- F16-06: Real independently verified Backup/Restore/PITR and host-loss DR — NOT VERIFIED.
- F16-07: GitHub Actions CI, deployment/rollback/incident drills, approved business RPO/RTO — NOT RUN / NOT APPROVED.
- F16-08: Reliable supply-chain CVE and production secret scans and signed artifact provenance — BLOCKED.

Final release decision is NO-GO until all mandatory release checks genuinely execute and pass.

## به‌روزرسانی ۲۰۲۶-۱۱-۲۴

جدول بالا سابقهٔ فاز ۱۶ است. نتایج جدید در BOOKCORE_RELEASE_GATE_MATRIX.md و گزارش‌های فارسی بسته آمده‌اند. نصب قفل‌شده، strict typecheck، lint، build، ۱۵ مهاجرت، ۴۶ عملیات دامنه و Metrics، هر شش سناریوی ظرفیت، رقابت‌های اصلی، دو Worker، Restore منطقی و PITR در محیط مصنوعی اجرا شدند. باقی‌ماندهٔ انتشار شامل مقصد احراز‌شدهٔ GitHub، GitHub Actions واقعی، تأیید مستقل، محیط محافظت‌شدهٔ بازیابی، خرابی میزبان در محیط هدف و RPO/RTO عملیاتی است.
