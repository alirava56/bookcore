# Phase 08 — Test Matrix (definitions are not execution evidence)

| ID | Layer | Scenario / assertion | Source | Current status |
|---|---|---|---|---|
| R08-01 | Pure | UTC interval half-open, max 31 days, offset required | `phase08-reporting.test.ts` | PASS (executed) |
| R08-02 | Pure | Missing dates/reversed/invalid offset denied | `phase08-reporting.test.ts` | PASS (executed) |
| R08-03 | Pure | Cursor retains six PostgreSQL microsecond digits | `phase08-cursor.test.ts` | PASS (executed) |
| R08-04 | Pure | HMAC rejects changed payload/foreign scope | `phase08-cursor.test.ts` | PASS (executed) |
| R08-05 | Pure | 23505 only effective index -> BOOKING_ALREADY_EXISTS | `phase08-db-errors.test.ts` | PASS (executed) |
| R08-06 | Pure | Other SQLSTATE mapping sanitized | `phase08-db-errors.test.ts` | PASS (executed) |
| R08-07 | Pure | Outbox payload versions/type/aggregate | `phase08-outbox.test.ts` | PASS (executed) |
| R08-08 | Pure | Poison/secret payload refused | `phase08-outbox.test.ts` | PASS (executed) |
| R08-09 | Pure | Retry bounded and deterministic | `phase08-outbox.test.ts` | PASS (executed) |
| R08-10 | PostgreSQL | Occupancy includes right status counts & cancellation history | `phase08-postgres.test.ts` | NOT VERIFIED |
| R08-11 | PostgreSQL | Reporting denies foreign Tenant and restricted role | `phase08-postgres.test.ts` | NOT VERIFIED |
| R08-12 | PostgreSQL | Six rows inside same millisecond paginate without loss | `phase08-postgres.test.ts` | NOT VERIFIED |
| R08-13 | PostgreSQL | Two Workers never claim same event concurrently | `phase08-postgres.test.ts` | NOT VERIFIED |
| R08-14 | PostgreSQL | Lease expiry reclaimed by second worker | `phase08-postgres.test.ts` | NOT VERIFIED |
| R08-15 | PostgreSQL | Duplicate handle yields one durable Receipt | `phase08-postgres.test.ts` | NOT VERIFIED |
| R08-16 | PostgreSQL | Invalid event quarantined without published status | `phase08-postgres.test.ts` | NOT VERIFIED |
| R08-17 | PostgreSQL | Worker role cannot modify Users or delete Receipts | `phase08-postgres.test.ts` | NOT VERIFIED |
| R08-18 | PostgreSQL | Migration 009 fresh install and populated upgrade | migrations/CI | NOT VERIFIED |
| R08-19 | PostgreSQL | Two consecutive Migrations and verified checksums | `npm run migrate` twice | NOT VERIFIED |
| R08-20 | PostgreSQL | Fault after durable effect before commit rolls back | adversarial failure injection | NOT VERIFIED |
| R08-21 | PostgreSQL | Lost COMMIT acknowledgement recovers after Lease | failure injection | NOT VERIFIED |
| R08-22 | PostgreSQL | Concurrent booking vs report has a consistent statement snapshot | reporting integration | NOT VERIFIED |
| R08-23 | PostgreSQL | Attendance/No-show aggregation on FINISHED Sessions | reporting integration | NOT VERIFIED |
| R08-24 | PostgreSQL | Oldest Aggregate event blocks newer pending/failed event | outbox ordering | NOT VERIFIED |
| R08-25 | HTTP | OWNER/MANAGER see report, others denied and no PII | protected controller | NOT VERIFIED |
| R08-26 | HTTP | Error codes, pagination and correct Occupancy Schema | OpenAPI/HTTP | NOT VERIFIED |
| R08-27 | Runtime | Graceful shutdown with in-flight batch | worker SIGTERM | NOT VERIFIED |
| R08-28 | Runtime | Backlog, failed count, latency observation | Worker metrics | NOT VERIFIED |
| R08-29 | Security | API not using owner DB URL; separate worker principal | CI/Compose permissions | NOT VERIFIED |
| R08-30 | Regression | Duplicate customer on full Session -> BOOKING_ALREADY_EXISTS | API regression | NOT VERIFIED |
| R08-31 | Regression | Revoked AuthSession/membership mutation races | Phase 07 inherited tests | NOT VERIFIED |
| R08-32 | Regression | Session cancellation vs Booking cancellation | Phase 07 inherited tests | NOT VERIFIED |
| R08-33 | Regression | Phase 02 capacity 1/20 x100, 3 reps, two processes | inherited Phase 07 integration | NOT VERIFIED |

Static SHA, TypeScript AST parse and OpenAPI `$ref` checks are separate tooling evidence and do not count as PostgreSQL assertions. See `evidence/phase08/`.
