# Phase 06 — Test Matrix

| ID | Scenario | Source | Actual verification |
|---|---|---|---|
| U06-01..08 | State graph, bounds, buffers, cursor | `test/unit/session-domain.test.ts` | **8 PASS** isolated real TS transpilation/execution |
| U05-01..13 | Timezone, DST, schedule rules | `scripts/test-availability-pure.cjs` | **13 PASS** actual execution |
| I06-01 | Draft, publish, public allowlist, foreign tenant | `sessions-postgres.test.ts` | NOT VERIFIED |
| I06-02 | Parallel overlapping Drafts, rollback of loser | same | NOT VERIFIED |
| I06-03 | 15 Booking cancellation, Idempotency, outbox | same | NOT VERIFIED |
| I06-04 | Injected SQL error leads rollback | same | NOT VERIFIED (SQL TX only) |
| I06-05 | Counter drift, invalid cross-tenant allocation | same | NOT VERIFIED |
| I06-06 | Session terminal immutability | same | NOT VERIFIED |
| U06-09 | Stable route-based rate-limit keys | `test/unit/phase06-rate-limit.test.ts` | NOT VERIFIED (NestJS dependency absent) |
| I02-XX | 100 concurrent booking attempts capacity 1 and 20, 3 runs, 2 workers | inherited Phase02 reference | NOT VERIFIED |
| I06-07 | Adjacent allocations / half-open interval | `sessions-postgres.test.ts` | NOT VERIFIED |
| I06-08 | CLOSED exception and revoked trainer before Publish | `sessions-postgres.test.ts` | NOT VERIFIED |
| I06-09 | Different rooms, resource buffer overlap, capacity-versus-booking and 2-process contention | future integration extensions | NOT VERIFIED — requires additional test implementation |
| R06-01 | npm clean install / tsc / lint / build / real tests | scripts / CI | FAILED / NOT VERIFIED (no npm Registry) |
| R06-02 | PG17 migration 001–007 twice, history and role grants | `npm run migrate` | NOT VERIFIED (no PostgreSQL) |

Executed tests must never be conflated with PostgreSQL verification. A defined test does not count as run. The full cleanroom CI and actual PostgreSQL migration test remain release blockers.
