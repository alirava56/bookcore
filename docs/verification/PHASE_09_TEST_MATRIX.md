# Phase09 — Test Matrix and Evidence

## Test classes
| ID | Scenario | Source / script | Environment | Expected outcome | Execution |
|---|---|---|---|---|---|
| P09-U01 | Invitation policy, consent status, refresh recovery | `apps/api/test/unit/phase09-governance.test.ts`; `scripts/test-phase09-pure.cjs` | Node + global TS | deny invalid roles, expired consent, unsafe refresh replay | Executed: PASS 6/6 |
| P09-U02 | Event schemas, sensitive payloads, unknown versions | `apps/api/test/unit/phase09-outbox-security.test.ts`; `scripts/test-phase08-pure.cjs` | Node + TS | reject invalid BookingConfirmed `{}`, allow historical v1 cases | Executed: PASS combined suite 24/24 |
| P09-U03 | Booking TAP dynamic count and zero-test | `scripts/test-booking-domain-pure.cjs` | Node + TS | 6 successes exit 0; stale count removed | Executed: PASS 6/6; regression runner integrated |
| P09-PG01 | Invitation concurrent accept/decline/revoke | `apps/api/test/integration/phase09-postgres.test.ts` | PG17 + NestJS | at most one membership activation | NOT VERIFIED |
| P09-PG02 | Direct staff affiliation denied | same + Organization | PG17 + HTTP | legacy endpoint 409 without creating membership | NOT VERIFIED |
| P09-PG03 | Consent grant/revoke vs staff booking | same + Booking integration | PG17 + two connections | no booking after consent revoke committed | NOT VERIFIED |
| P09-PG04 | Refresh replay / lost response | prior Identity tests + Phase09 | PG17 + fault injection | no duplicate valid descendants; unknown → reauth | NOT VERIFIED |
| P09-PG05 | Session creation optional idempotency | Session source + prior integration | PG17 + network fault | same-key recovery, no duplicate Allocation/Outbox | NOT VERIFIED |
| P09-PG06 | Outbox 2 Worker lease/reclaim/fence | Phase08+09 integration | PG17 + 2 OS processes | one Receipt, projection at most once | NOT VERIFIED |
| P09-PG07 | Maintenance ops role, audit, requeue | migration 010 + CLI | PG17 with ops role | only tenant OWNER + ops role can retry quarantined event | NOT VERIFIED |
| P09-PG08 | 001–010 upgrade, integrity, constrained roles | all migrations | Fresh and populated PG17 | migrate twice and no drift; restricted app | NOT VERIFIED |
| P09-E2E | JWT/global guard, object scope, rate limiting | inherited HTTP tests + new Phase09 | NestJS + PG17 | 401/403/404 and no cross tenant disclosure | NOT VERIFIED |
| P09-OPS | Complete cleanroom npm ci/typecheck/lint/build/CI | package scripts, workflows | npm Registry + PG17 | no skipped tests, all PASS | FAILED installation / CI NOT VERIFIED |

**Critical note:** Count of pure test cases is not a number of PostgreSQL tests executed. No tests relying on real PG17 completed in this environment. Phase02–08 deferred registers remain authoritative and are not silently closed.
