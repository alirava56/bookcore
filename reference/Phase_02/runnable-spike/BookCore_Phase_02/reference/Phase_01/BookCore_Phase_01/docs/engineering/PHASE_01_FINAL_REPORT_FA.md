# BookCore — Phase 01 Final Engineering Report

**Report ID:** BC-P01-20261122  
**Target:** Software Architecture Finalization & Domain Specification  
**Input:** `BOOKCORE_SOFTWARE_ENGINEERING_BLUEPRINT_FA.md` (BC-SENG-001 v1.0, 2026-11-21)  
**Output:** Design Baseline 1.1.1 / 2026-11-22  
**Execution:** DOCUMENTATION ONLY; no application code, DB migration, server, integration tests, QA run, or deploy.

## 1. خلاصه مدیریتی
سند اصلی تصویر معماری درستی از BookCore می‌دهد: Modular Monolith، PostgreSQL به‌عنوان مرجع ظرفیت، GiST Exclusion برای منابع، Tenant Isolation و Outbox. برای سپردن به تیم پیاده‌سازی، چند ابهام بحرانی داشت: لغو کامل Session، Idempotency خطای ردشده، عضویت Customer، Trainer بین شعب، Lock Revocation، State transition حضور، و قراردادهای API حذف‌شده. این مسائل در طراحی 1.1 تا حد مناسب **برای شروع یک Technical Spike کنترل‌شده** تعیین شده‌اند؛ نه برای تولید تجاری.

## 2. ارزیابی طرح اصلی
- **قابل حفظ:** اهداف MVP، FR-01..FR-16، INV-01..INV-14، NFR-01..NFR-10، T-01..T-25، ADR-001..010، مرز PostgreSQL ACID، عدم Hold/Payment/Waitlist و معماری Outbox.
- **ناکافی در v1.0:** §15.3 تشخیص می‌دهد که rollback و ذخیره پاسخ ردشده باید تصمیم‌گیری شود، اما راهکار نهایی ندارد. §4.2 لغو Session را بدون اثر Bookingها گذاشته، §15.1 مسئولیت Customer/Staff را به هم نزدیک کرده، §15.4 مجوز حین تراکنش و مربی چندشعبه‌ای را مبهم گذاشته است.
- **بهبود مشخص:** حالت‌ها و انتقال‌ها، سیاست اولیه قابل‌آزمون، قفل و تراکنش، ستون‌ها و FKها، OpenAPI، Authorization Matrix، NFR measurement و Test Traceability مستند شدند. جزئیات در `01_BASELINE_AUDIT_FA.md` A-01..A-18.

## 3. شکاف‌ها و تناقضات تأییدشده
| Issue | Consequence without fix | Resolution |
|---|---|---|
| Commit vs rollback cached rejection | Idempotency false promise | cached domain 4xx committed in TX without mutation; unhandled failure rollback/no cache |
| Session cancellation with existing customers | orphan confirmed bookings / dirty Counter | one atomic cancel-all with 15 events, 16 outbox on 15-customer example |
| Trainer identity confused with branch resource | overbooking trainer across branches | tenant-wide Trainer Resource linked to global User; Room branch bound |
| Customer Membership coupling | legitimate external self-bookers denied | authenticated Customer independent of staff membership; Staff booking records separate actor |
| Revocation checked only at edge | successful write after revocation | Membership FOR SHARE in write TX, conflicts with revoke UPDATE |
| Attendance not tied to session lifecycle | attendance in future or cancelled Session | only `FINISHED`, no counter change |
| Direct resource/time edits | customer promise broken | Published Session immutable, cancel + recreate |
| Logical DB-only model | cross-tenant link, resource/counter drift | composite FKs, GiST, partial UNIQUE, protected mutations, trigger/reconciler Spike |
| API incomplete vs FRs | difficult client implementation | expanded `/api/v1` draft, 38 operations (31 path objects) with disjoint public/staff Session reads |

## 4. تصمیم‌های فنی نهایی‌شده در طراحی
1. Session lock نقطه serialization رزرو/cancel/capacity؛ `READ COMMITTED`, global lock order, DB time after lock.
2. Booking `CONFIRMED→CANCELLED/ATTENDED/NO_SHOW`; `ATTENDED` و `NO_SHOW` terminal، فقط پس از FINISHED، Counter تغییر نمی‌کند.
3. لغو کل Session قبل از شروع، تمام رزروهای CONFIRMED را لغو و Counter صفر و Allocation inactive می‌کند؛ تاریخچه پاک نمی‌شود.
4. Idempotency scoped + fingerprint، business rejection cached by COMMIT، unknown Commit client retry same Key، no caching 5xx، in-flight uniqueness wait.
5. Tenant composite FK و `tstzrange`/GiST partial exclusion؛ یک Trainer Resource per User per Tenant و Room per branch.
6. Public read فقط PUBLISHED، self booking بدون Membership، Staff با هویت Actor، همه دستورهای Write نیازمند membership lock مناسب.
7. RFC3339 offset-aware، UTC instants + IANA snapshot، نیمه‌باز و buffer، `CLOSED` precedence over `OPEN_OVERRIDE`، no silent retroactive deletion.
8. Outbox transactionally durable، dispatcher at-least-once، consumer idempotent، no external dependencies to confirm booking.
9. OpenAPI 3.1 design contract، status و error codes ثابت، stable cursor paging، public-safe projections.

## 5. تصمیم‌های موقت / نیازمند ذی‌نفع
`PD-01..PD-09` در OPEN_DECISIONS_FA.md: اجباری بودن ثبت‌نام، چندشعبه/مدل منابع، 120 دقیقه لغو، احراز رضایت Staff booking، عمر Draft، استثناهای تقویم، نگهداری PII، MFA و KPI/SLO. هنوز حتی یک مصاحبه مشتری یا approval ذی‌نفع انجام نشده. افراز محصول واقعی نیازمند این اعتبارسنجی است.

## 6. تغییر مدل دامنه
Customer از staff membership جدا شد، trainer resource در سازمان واحد است، `Booking.actor` مستقل از `Booking.customer`، Session cancellation دارای coordinator تراکنشی، Owner last-member protection، eventها explicit و Statusها terminal شدند. جزئیات، ownership و bounded context در `DOMAIN_MODEL_FA.md`؛ Transitionها در `STATE_MACHINES_FA.md`.

## 7. طراحی دیتابیس
`DATABASE_DESIGN_FA.md` همه جداول 17گانه (User/AuthSession/RefreshToken/Organization/Membership/Branch/Resource/Service/BusinessHours/ScheduleException/Session/ResourceAllocation/Booking/BookingEvent/AuditEvent/IdempotencyRecord/OutboxEvent) را با نوع، nullable، key/index، tenant scope، حذف و concurrency شرح می‌دهد. FK مرکب و uniqueness و CHECK و GiST exclusion اصلی‌اند. **محدودیت شناخته‌شده:** برابر بودن Counter با COUNT و Interval allocation با Session با CHECK ساده تضمین نمی‌شود؛ cross-row deferred trigger یا DB privileged procedure+reconciler باید در TS-06 آزموده و نهایی گردد.

## 8. طرح تراکنش و هم‌زمانی
Lock `auth_session → user → membership → idempotency key → sessions ordered → bookings ordered → allocations ordered`، خطاهای 40P01/40001 حداکثر دو retry bounded و 55P03 safe 503. Session create resource locks ordered، GiST layer final. انتظار طراحی: 100 request/1 seat→1 success، 100/20→20 success در آزمایش کنترل‌شده با مهلت lock کافی؛ این نتایج **اندازه‌گیری نشده‌اند**. از دست رفتن پاسخ COMMIT ناشناخته به replay همان Key هدایت می‌شود، نه success جعلی.

## 9. بررسی امنیت
ماتریس دقیق تمام 38 عملیات با Auth/Role/Tenant/Object/State در `docs/security/AUTHORIZATION_MATRIX.md` و `x-authorized-actors` OpenAPI؛ جداسازی صریح PublicSession از StaffSession. BOLA/BFLA, tenant leakage, refresh token replay, mass assignment, staff escalation, late revocation, logging/secrets, provider duplication و denial tests طراحی شده‌اند. MFA و تست امنیت اجرایی قبل از Production الزامی است؛ هیچ تست نفوذی انجام نشده.

## 10. تغییرات قرارداد API
ریشه `/api/v1` حفظ شد. برای FR-05 و مدیریت واقعی، Business Hours و Schedule Exception CRUD محدود اضافه شد؛ برای Session cancel/finish/capacity endpoints، member revoke، on-behalf booking و attendance قرارداد دقیق تعریف شد. OpenAPI 3.1 دارای **31 path و 38 operation**، مسیرهای جداگانه عمومی/کارمندی و Problem Details RFC9457 است؛ URI server نمونه و deployment نیست. Payloadهای forbidden additional properties رد می‌شوند. قرارداد هنوز با هیچ کد اجراشده تطبیق داده نشده.

## 11. Traceability و Test Design
- Original T-01..T-25 بدون تغییر شناسه در جدول Tests؛ T-26..T-47 به عنوان 22 آزمون مکمل اضافه شد.
- FR-01..16 → Invariants → ADR → API/DB → Tests نگاشت شد؛ 10 NFR هدف سنجش‌پذیر دارند.
- `0/47` تست کاربردی/اجرایی شده؛ هیچ عدد Runtime برای Success/Latency/SLO/Restore گزارش نشده. OpenAPI با Strict YAML duplicate-key، FastAPI OpenAPI Pydantic و آزمون‌های سفارشی reference/security/DTO و cross-document استاتیک بررسی می‌شود؛ تنها نتیجهٔ ثبت‌شده در گزارش `STATIC_DESIGN_VALIDATION.md` معتبر است. اجرای API واقعی، تست‌های امنیت و PostgreSQL انجام نشده است.

## 12. فهرست خروجی‌ها
| Path | Purpose |
|---|---|
| `docs/engineering/01_BASELINE_AUDIT_FA.md` | 18 findings + corrections |
| `docs/product/PRD_FA.md` | scope/journeys/acceptance |
| `docs/domain/DOMAIN_MODEL_FA.md` | ownership/boundaries/invariants |
| `docs/domain/STATE_MACHINES_FA.md` | full transitions + Mermaid |
| `docs/architecture/ARCHITECTURE_FA.md` | UoW, locks, idempotency, scheduling, outbox |
| `docs/database/DATABASE_DESIGN_FA.md` | 17-table physical specification & SQL constraint examples |
| `docs/security/THREAT_MODEL_FA.md` | threats, negative tests, reference to authoritative Authorization Matrix |
| `docs/security/AUTHORIZATION_MATRIX.md` | 38 full method/path policies, role and tenant isolation |
| `docs/api/openapi.yaml` | 3.1 design contract; NOT implemented |
| `docs/verification/REQUIREMENTS_TRACEABILITY.md` | FR/INV/NFR→T-01..47 |
| `docs/verification/STATIC_DESIGN_VALIDATION.md` | strict YAML, FastAPI OpenAPI Pydantic validation, refs, auth, cross-doc/trace and projection checks (executed results) |
| `docs/engineering/OPEN_DECISIONS_FA.md` | PD and TS, risk register |
| `docs/architecture/ADR/README.md` and ADR-011..016 | supporting decision records |
| `docs/engineering/PHASE_01_FINAL_REPORT_FA.md` | this report |
| `BOOKCORE_SOFTWARE_ENGINEERING_BLUEPRINT_FA.md` | untouched baseline source included for traceability |
| `tools/validate_phase01.py` | reproducible static OpenAPI/traceability/authorization checks; not application code |
| `MANIFEST.md` | complete ZIP file inventory and per-file SHA-256 checksums |

## 13. ریسک‌های فنی باقی‌مانده
**P0:** trigger/reconciler consistency of committed Counter, two-replica lock correctness, role revocation race, ORM custom SQL drift, idempotency commit loss. **P1:** staff consent, Draft blocking, restore outbox duplication, timezone calendar edge, unresolved MFA and data retention. Risk acceptance before technical spikes requires an explicit engineering owner, and before release actual evidence.

## 14. Stakeholder validation
Product Owner + two gym managers should confirm PD-01..06 with sample real schedules and cancellations; Security/Ops/legal confirm PD-07..09. No fabricated user interviews or formal approval recorded. All provisional policies are deliberately reversible through ADR + OpenAPI + tests update.

## 15. Gate-by-gate assessment
This table distinguishes a paper **DESIGN** review from runtime tests. A design PASS is **not** a release PASS.
| Gate | Status | Evidence / limitation |
|---|---|---|
| 1 — Product scope | PASS | MVP vs post-MVP boundaries, 9 open Product decisions explicit |
| 2 — Domain consistency | PASS | state tables, actor/customer separation, ownership/invariants |
| 3 — Database design | PASS | detailed 17-table schema and enforceable SQL primitives; cross-row trigger and ORM behavior NOT VERIFIED, TS-02/06 |
| 4 — Concurrency design | PASS | fixed locking protocol/idempotency/rollback and 1/20 seat planned tests; actual results NOT VERIFIED |
| 5 — Security design | PASS | per-operation authorization matrix, negative tests; live security NOT VERIFIED |
| 6 — API contract | PASS | Strict YAML, FastAPI OpenAPI Pydantic structure, local refs, unique operation IDs, path params, auth and public-only schema checks; official third-party schema validator NOT VERIFIED; no runtime conformance |
| 7 — Test traceability | PASS | original T-01..25 and added T-26..47, FR mapping and NFR pass criteria |
| 8 — Documentation consistency | PASS | Cross-document terminology/state/route and exact 38-operation authorization coverage checked, supplemented by static assertions; runtime behavior NOT VERIFIED |

**Runtime/Releases:** baseline release gates G1..G8 = `NOT VERIFIED` (G1 also requires actual stakeholder interviews). Application, Migration, Authentication implementation, Booking API, Notification worker and Deployment = **NOT IMPLEMENTED**.

### Adversarial second pass (logical, not executable)
| Attack/contradiction | Prevention | Residual test |
|---|---|---|
| Negative Counter / double-free / Overbooking | Session row lock + counter CHECK + partial unique + one TX | T-01,06,07,38 |
| Cross-tenant session & booking references | composite FK + object-scope 404 | T-12,33 |
| Trainer/Room overlap, forced override | GiST EXCLUDE active allocations | T-08,09,30,32 |
| Revoked employee completes write after revocation | conflict-aware lock, defined ordering | T-24,31 |
| Cancelling Session leaves confirmed Customers | 15-booking atomic cancellation with 15 history + outbox rows | T-25,26 |
| Duplicate side effects from retry/consumer | one-TX terminal idempotency + event ID | T-03,28,35 |
| Unknown Commit incorrectly returns 201 | no success until ACK; same-key recovery | T-17,28 |
| Invalid local time / midnight | IANA offset validation, UTC half-open range | T-14,36 |
| Worker failure corrupts core bookings | commit outbox in PG; Worker outside TX | T-15,16 |
| Cascading delete destroys history | RESTRICT FK and append-only audit | T-33 |
| Cross-document status mismatch | explicit Session/Booking mapping, OpenAPI operation policies | static checks + future contract tests |

## Phase 01 final correction — source-derived delta and validation status
- **C-01 (public contract leak):** optional-auth `GET /organizations/{orgId}/sessions` and detail previously advertised staff `Session` responses to anonymous consumers. Now public paths are `/public/organizations/{orgId}/sessions` and detail, returning **only** `PublicSession` / `PublicSessionList` with `additionalProperties: false`, `status=PUBLISHED`, restricted fields. Original `/organizations/.../sessions` reads are **staff-only**, with `StaffSession` / `StaffSessionList` and assigned-Trainer filtering. No ambiguous dual-auth success response remains.
- **C-02 (/me):** authoritative 200 schema is exactly `MeResponse` = global `User` and `memberships: ActiveMembership[]`; no deferred memberships, no revoked membership and no secrets.
- **C-03 (time):** scheduling inputs require valid RFC3339 explicit offset matched to IANA organization timezone. Persisted/response instants and server-created `createdAt` / `cancelledAt` return UTC `Z`; event timestamps and `from/to` instant filters have no scheduling offset-match rule.
- **C-04 (readiness auth):** internal readiness requires monitorAuth API key *and* network restriction; `/health/live` remains public. This policy is design-only: no key is generated or stored.
- **Additional least-privilege correction:** `GET /resources` excludes TRAINER because its response includes internal `trainerUserId`, and the `Booking` response omits audit-only `createdByActorId`. DB/audit identities remain intact.
- **C-05 (static validation):** `tools/validate_phase01.py` reruns strict YAML, duplicate keys, OpenAPI structural model (FastAPI Pydantic), ref resolution, operationId/path param/response/security/schema/authorization matrix and cross-doc/test trace checks. Actual results, PASS/FAIL and tool limitations are in `docs/verification/STATIC_DESIGN_VALIDATION.md`; no claim of official external-validator conformance or running an app. `0/47` runtime tests executed.

The addition of these two public endpoints is a *design-contract change* from the original ambiguous optional-auth GET; it is not a production migration. No backend or deployment exists. No change was made to the baseline blueprint or approval state.

## Final static verification and packaging declaration
- **Executed on 2026-11-22:** 19 separate local static design checks **PASS**, zero **FAIL**; see `STATIC_DESIGN_VALIDATION.md` for the exact commands/tools and evidence. These include strict duplicate-key YAML, FastAPI OpenAPI Pydantic structure, Draft 2020-12 components and positive/negative DTO fixtures, 423 local `$ref` resolutions, 38 unique `operationId`, path/parameter matching, public/staff security/projections, resource subtype requiredness, 38 exact authorization-matrix entries, cross-document wording and FR/INV/NFR/T coverage.
- **NOT VERIFIED:** an independent third-party OpenAPI meta-schema validator (not installed/obtainable in this environment), and ALL API/DB/concurrency/security/recovery/runtime tests. FastAPI's OpenAPI model is a structural validator but not a substitute for every official OAS semantic rule; no false certificate is given. All T-01..T-47 are **design-only** test cases and 0 have run as runtime acceptance tests.
- **Package:** `BookCore-Phase-01-Engineering-Final.zip` includes the unchanged v1.0 baseline, corrected 1.1.1 design, the authoritative 38-operation Authorization Matrix, static validation code/report and the checksum `MANIFEST.md`. No secrets, real credentials, node_modules, venv, old generator, application code, DB migration or GitHub changes are included. ZIP's CRC and manifest SHA-256 are verified separately at package creation.

## 16. Final recommendation / phase boundary
**Technical next phase:** run TS-01..TS-07 against real PostgreSQL and at least two API replicas where specified. If failed, revise ADR and design before foundation work; do not mark any runtime gate PASS. No permission to push to GitHub was provided; the supplied package is repository-ready but not committed.

`DESIGN-READY FOR TECHNICAL SPIKE`

**This verdict authorizes only controlled validation of design assumptions. It does NOT indicate software readiness, production readiness, commercial approval or completion of any of the remaining 15 prompts.**
