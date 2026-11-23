# BookCore — Requirements Traceability & Test Design

**Source IDs preserved exactly:** FR-01..FR-16, INV-01..INV-14, NFR-01..NFR-10, and original T-01..T-25 of BC-SENG-001. T-26..T-47 are additions, not renumbering. **Status: 0 executed / 47 specified; all runtime tests NOT VERIFIED.** A design-level matrix does not count as a passing integration test.

## Primary Traceability Matrix
| Business requirement | Invariant / policy | ADR / design | API / DB | Acceptance tests |
|---|---|---|---|---|
| FR-01 Auth | active User/session + refresh replay; /me active membership contract | ADR-014/015 | `/auth/*`, `/me` → MeResponse, users/auth_sessions/refresh_tokens | T-21,T-37,T-40,T-45 |
| FR-02 Organizations, membership | INV-09, last Owner | ADR-014 | organizations/memberships/branches | T-12,T-24,T-31,T-34 |
| FR-03 Role policy | RBAC+ABAC, Customer no staff membership | ADR-014 | authz policy + Membership | T-13,T-29,T-34 |
| FR-04 Trainer/resources | INV-05, Tenant-local resource | ADR-013 | resources + `/resources` | T-08,T-30,T-32 |
| FR-05 Hours/closures | IANA scheduling input, UTC output, no retroactive cancel | ADR-015 | business_hours, schedule_exceptions | T-14,T-36,T-46 |
| FR-06 Session lifecycle | INV-06/07, before-start cancellation | ADR-011 | sessions, allocations, cancel/publish/finish | T-11,T-25,T-26,T-27 |
| FR-07 No overlapping exclusive resources | INV-05 | ADR-013 | GiST Exclusion `resource_allocations` | T-08,T-09,T-19,T-30,T-32 |
| FR-08 Availability projection | INV-14 | ADR-011/015 | Public GET sessions → PublicSession strict allowlist; staff GET sessions → StaffSession; sessions.seats_* | T-01,T-02,T-23,T-44 |
| FR-09 Atomic booking | INV-01/02/03/06 | ADR-011 | POST bookings, bookings+sessions | T-01,T-02,T-06,T-20,T-38 |
| FR-10 Idempotency/uniqueness | INV-04/11 | ADR-012 | idempotency_records+partial unique | T-03,T-04,T-05,T-28 |
| FR-11 Cancel Booking | INV-02/03/08 | ADR-011/012 | POST bookings/cancel + bookings | T-06,T-07,T-23 |
| FR-12 Attendance/Audit | INV-02/12 | ADR-011 | bookings/events + attendance | T-23,T-27,T-33 |
| FR-13 Calendars | Tenant staff scope, public published-only & stable page | ADR-014/015 | Public vs staff GET sessions, staff assigned Trainer scope | T-12,T-14,T-42,T-44* |
| FR-14 Occupancy Report | INV-02/09 | ADR-011/014 | GET reports/occupancy | T-23,T-43* |
| FR-15 Outbox | INV-03/10/12 | ADR-012 | outbox_events | T-15,T-16,T-35 |
| FR-16 Health/backup | NFR-04/07/09, monitorAuth for readiness | ADR-016/014 | /health/live public, /health/ready monitorAuth, PG backups | T-17,T-19,T-22,T-47 |

*Every test is currently **DESIGN-ONLY**; this matrix lists intended PASS conditions rather than observed results.*

## Original 25 Acceptance Scenarios — test taxonomy, infrastructure and criteria
| Test | Type | Infrastructure | Expected PASS (not observed) |
|---|---|---|---|
| T-01 | Concurrency, DB integration | Real PG + 2 APIs + 100 users | cap1: exactly 1 effective Booking; Counter=1; 99 fail safe (409/503 when timeouts) |
| T-02 | Concurrency | Real PG + 2 APIs + 100 users | cap20: exactly 20 effective, Counter=20 |
| T-03 | API E2E, idempotency | PG | same Key/hash → replay original 201, one Booking/event |
| T-04 | API E2E, security | PG | same Key/different fingerprint 409 IDEMPOTENCY_KEY_REUSED |
| T-05 | DB constraint, integration | PG | distinct keys same user/session leave max 1 effective |
| T-06 | Concurrency | PG + multiple API | cancel and booking contend same Session: no drift/negative count |
| T-07 | Concurrency, unit | PG | cancel concurrent/repeat frees at most 1 seat |
| T-08 | DB constraint | PG + btree_gist | simultaneous overlapping trainer allocations: one rejected 23P01 |
| T-09 | DB constraint | PG | touching `[end,start)` with zero buffer both accepted |
| T-10 | DB integration | PG | reduce capacity below committed rejected 409; unchanged DB |
| T-11 | API E2E | PG | direct time/trainer mutation on Published/with bookings unavailable/rejected |
| T-12 | Security, API E2E | PG 2 tenants | guessed tenant A resource using B path → 404, no data leak |
| T-13 | Security, API E2E | PG | Trainer cannot add OWNER or manage members, 403 |
| T-14 | Unit+integration | timezone library; PG | missing local time rejected, ambiguous requires matching offset, midnight correct |
| T-15 | Failure injection | PG + outbox dispatcher | worker crash does not lose committed booking/outbox; recovery retries |
| T-16 | Failure injection | PG + optional Redis | Redis outage never changes booking truth; outbox remains |
| T-17 | Failure injection | PG/proxy faults | DB down during TX → no false 201; unknown commit replay safe |
| T-18 | Integration, recovery | PG | 40P01/40001 bounded retry with jitter; no duplicate side-effect |
| T-19 | Database migration | fresh + populated PG | constraints installed; data & rollback/upgrade verified |
| T-20 | Multi-instance concurrency | 2 APIs + PG | repeats T-01/T-02 with no overbooking |
| T-21 | API E2E, security | running API | 400/422/413 or 429 as configured, RFC9457 sanitized, no stack/token |
| T-22 | Recovery | real backup to isolated PG | index/constraint and bookings restored; measured RPO/RTO recorded |
| T-23 | Integration, reporting | PG | after cancel/attendance counter and report follow INV-02 |
| T-24 | Security, concurrency | PG 2 transactions | member revoke commit precedes lock → denied; after lock operation may finish first |
| T-25 | Integration, failure injection | PG | cancel future Session with customers atomically; history/outbox consistent |

### Added scenarios (scope extension solely to test completeness)
| Test | Type | Infrastructure | PASS condition |
|---|---|---|---|
| T-26 | DB integration | PG | Cancel Session with 15 CONFIRMED yields Session CANCELLED, 15 CANCELLED bookings, zero Counter, 15 booking events, 16 outbox, zero active allocations |
| T-27 | State machine/unit+API E2E | Unit+PG | attendance before Finish rejected; after Finish counter constant; CANCELLED session cannot attendance |
| T-28 | Failure injection/idempotency | PG + connection loss | cached 409 only if successful COMMIT; rolled-back error uncached; unknown commit recovered using original Key |
| T-29 | Security/API E2E | PG | SELF body customerId override rejected; staff with existing customerId records separate actor/customer; foreign user scope cannot leak |
| T-30 | Database constraint | PG | same trainer resource in two branches of same org overlaps rejected; distinct organizations not falsely global-protected |
| T-31 | Concurrency/security | PG | membership FOR SHARE vs revoke UPDATE serializes; future writes blocked after revoke commit |
| T-32 | DB constraint | PG | invalid allocation interval, room branch or missing trainer allocation rejected by validated trigger/procedure or detected by reconciliation according Spike decision |
| T-33 | Security/DB | PG restricted DB role | DELETE booking/audit rejected; FK cross-tenant rejected; history retained |
| T-34 | Security/API E2E | PG | Manager cannot elevate self or Owner, last Owner not removable; Receptionist prohibited from admin; Trainer cannot enumerate Resources |
| T-35 | Failure injection/recovery | PG + mocked publisher | outbox SKIP LOCKED lease and event id dedup after crash/restore; no provider delivery claim |
| T-36 | Integration/schedule | PG + timezone fixtures | changing hours/exceptions does not silently mutate existing Sessions; new creation validated |
| T-37 | Security/E2E | PG | concurrent refresh uses session lock, reused consumed token revokes family, no token log |
| T-38 | Property-based, DB | PG | after arbitrary valid create/cancel/attendance sequence COUNT(effective)=seats_committed and bounds hold |
| T-39 | Spike/ORM integration | PG + Prisma/Drizzle | raw tx same connection; migration drift / exclusion / error mapping exactly tested |
| T-40 | Security/load | API + rate limit | brute-force attempts hit 429, no account enumeration |
| T-41 | Performance/failure injection | PG + API | lock saturation returns bounded safe errors, no overbooking and no endless queue |
| T-42 | API E2E | PG + 200 sessions | stable cursor order `(startAt,id)`, no misses/duplicates under static data, limit<=100 and range<=31d |
| T-43 | Security/integration | PG 2 tenants | report counts precise after cancels/attendance and excludes all foreign-tenant rows |

## Execution environment separation
**Without infrastructure:** domain transition unit tests, business policy unit tests, pure ISO/IANA conversion with pinned tzdata, fingerprint canonicalization test vectors, OpenAPI static validation. **With real PG:** foreign keys, GiST, unique partial, Session/Booking concurrency, membership locks, outbox, migrations, consistency triggers, transaction retries. **With at least 2 API replicas:** T-01,T-02,T-20,T-31; **with fault environment:** T-15..18,T-22,T-28,T-35; **with security harness:** T-12,T-13,T-24,T-29,T-34,T-37,T-40.

## Measurable NFR matrix (targets, NOT RESULTS)
| NFR | Measure / environment | Target and threshold | Phase & pass/fail |
|---|---|---|---|
| NFR-01 Correctness | 100+ worker contention at cap1/20 PG; property sequences | 0 overbook/counter drift, T-01,T-02,T-38 | Spike+CI: all must pass |
| NFR-02 API latency | k6 HTTP POST booking, warm DB, 2 API replicas, seeded 100k bookings, 50 RPS, pool 20 total (provisional) | p95 < 300 ms, excluding internet; **provisional** | Load phase: measured p95 under threshold |
| NFR-03 Availability | synthetic probe of successful ready service over 30 days, agreed maintenance window | 99.9% monthly **provisional** | Post-pilot SLO: missing data = NOT VERIFIED |
| NFR-04 Recovery | inject instance/DB failure and restore encrypted backup | proposed RPO<=15min, RTO<=60min | Ops drill: measured loss/elapsed meet targets |
| NFR-05 Security | OWASP BOLA/BFLA/tenant tests, refresh & MFA policy | 0 critical/high open findings, no data leak; MFA before sensitive production | Security gate: negative tests pass |
| NFR-06 Maintainability | CI Typecheck/lint/migration/test, architectural boundary checks | 100% mandatory pipeline passes; zero cross-module repository imports | CI gate: measured |
| NFR-07 Observability | inject 409/503, broken dispatcher, DB wait | traceId + error code all sampled requests, critical alerts fire within provisional 5min | Ops gate |
| NFR-08 Timezone | pinned tzdata timezone fixtures (Iran+DST test zone), midnight | 100% T-14/T-36 fixtures pass | Integration gate |
| NFR-09 Data protection | secret scan, encrypted backups, isolated restore | 0 leaked plaintext secrets; restore confirmed | Security/Ops |
| NFR-10 Modular scalability | 1 and 2 replicas, same PG, T-01/20 + domain evolution review | same correctness; no distributed booking transaction | Spike + architecture review |

Targets chosen as design baselines; no hardware measured, no real 50 RPS measured. Report must record actual PG version, CPU, storage IO, dataset shape, pool, network and failure conditions. If any requirement lacks environment evidence, mark `NOT VERIFIED`, not PASS.

### Database latency measurement addendum (NFR-02 component)
Per-query DB service latency `p95` and Session-lock wait `p95` must be measured independently using OpenTelemetry/pg_stat_statements where available under the same seeded 100k-booking, 50 RPS, two-replica provisional workload. **Threshold TBD pending TS-01 / hardware calibration**; explicit PASS/FAIL may not be claimed before the team records an accepted threshold and reproducible environment. Separating lock-wait from total HTTP response time is required to diagnose hot sessions rather than attributing all latency to SQL execution.

## Phase 01 correction — contract and authorization acceptance additions
**These are design-only test definitions. Tests T-44..T-47 have NOT been run against an API or PostgreSQL.** Their limited static analogues, if executed, are identified separately in `STATIC_DESIGN_VALIDATION.md`.

| Test | Type | Infrastructure | Expected PASS (not observed) |
|---|---|---|---|
| T-44 | OpenAPI static + security API E2E | static script now; future API + 2 tenants | Anonymous public list/detail return only PublicSession allowlist, never `tenantId`, `capacityTotal`, `seatsCommitted`, `trainerResourceId`, `roomResourceId` or `version`; DRAFT/CANCELLED/FINISHED hidden; staff GET without active Membership denied; assigned trainer cannot see other sessions |
| T-45 | OpenAPI static + API E2E | static now; future API + PG | `/me` exactly `{user,memberships:ActiveMembership[]}`; only ACTIVE staff Memberships, empty for customer without staff; REVOKED excluded, no secrets |
| T-46 | OpenAPI static + timezone unit/API E2E | static now; future timezone fixtures + API | scheduling-input offset mismatches rejected, persisted/wire outputs `Z`, `createdAt` independent of IANA scheduling validation, `from/to` offset-aware filters normalize to UTC |
| T-47 | OpenAPI static + security API E2E | static now; future proxy + internal monitor | `/health/ready` rejects no/invalid monitorAuth and public network access; `/health/live` remains generic anonymous |

**Static automated checks** do not count as E2E execution of T-44..T-47; test-case execution remains `0 / 47`.

## Exact source invariant coverage (INV-01 through INV-14)
This is a DESIGN-to-test link, not execution evidence. Source meanings preserved from BC-SENG-001.

| Invariant | Enforced design contract | Planned acceptance / negative tests |
|---|---|---|
| INV-01 | Session capacity bounds, PG CHECK + locked writes | T-01,T-02,T-10,T-38 |
| INV-02 | committed seats equal effective CONFIRMED/ATTENDED/NO_SHOW; cancel -1, attendance 0 | T-06,T-07,T-23,T-27,T-38 |
| INV-03 | Booking+Counter+Event transactional atomicity | T-01,T-06,T-15,T-25,T-26 |
| INV-04 | at most one effective Booking for customer and Session | T-03,T-05,T-28 |
| INV-05 | exclusive resource allocations half-open, buffers | T-08,T-09,T-30,T-32 |
| INV-06 | only PUBLISHED and before start bookable | T-21,T-25,T-27,T-44 |
| INV-07 | no inconsistent direct edits to active Session; capacity floor | T-10,T-11,T-25 |
| INV-08 | customer cutoff and audited staff exception | T-06,T-07,T-23 |
| INV-09 | composite tenant FK and tenant/object auth | T-12,T-29,T-33,T-34,T-43,T-44 |
| INV-10 | HTTP receipt only after Commit; external notification via Outbox | T-15,T-16,T-17,T-28,T-35 |
| INV-11 | same Idempotency Key/hash one effect, mismatch detectable | T-03,T-04,T-05,T-28 |
| INV-12 | preserve Booking/BookingEvent history, no destructive DELETE | T-25,T-26,T-33 |
| INV-13 | DB clock governs deadline; zone for schedule computation, UTC output | T-14,T-24,T-36,T-46 |
| INV-14 | availability GET is non-guaranteed snapshot, POST transaction authoritative | T-01,T-02,T-23,T-44 |
