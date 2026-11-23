# Phase 10 Verification Matrix

| ID | سناریو | Source | نوع | این محیط |
|---|---|---|---|---|
| P10-U01 | Scope و محدودیت Batch | phase10-operations.test.ts | Pure | PASS |
| P10-U02 | Counter Drift و Constraint errors | phase10-operations.test.ts | Pure | PASS |
| P10-U03 | Reason/Retention و Expiry | phase10-operations.test.ts | Pure | PASS |
| P10-I01 | Trainer fixture و non-TRAINER Trigger | phase09-postgres.test.ts | PostgreSQL | NOT VERIFIED |
| P10-I02 | Lost invitation token: revoke/reissue | phase09-postgres.test.ts | HTTP + PG | NOT VERIFIED |
| P10-I03 | Operator UUID spoof prevention / Privileges | phase10-postgres.test.ts | PostgreSQL | NOT VERIFIED |
| P10-I04 | Requeue and immutable audit | phase10-postgres.test.ts | PostgreSQL | NOT VERIFIED |
| P10-I05 | Cross-tenant inspector access denied | phase10-postgres.test.ts | PostgreSQL | NOT VERIFIED |
| P10-I06 | Bounded rate limit cleanup and audit | phase10-postgres.test.ts | PostgreSQL | NOT VERIFIED |
| P10-I07 | Consent/Idempotency cleanup races | inherited plus future | PostgreSQL | NOT VERIFIED |
| P10-I08 | Worker/Lease multi-process/Outbox projection | inherited Phase08/09 | PostgreSQL | NOT VERIFIED |
| P10-I09 | Cross-module revocation vs booking/session mutations | inherited/future | PostgreSQL | NOT VERIFIED |
| P10-CI | npm ci, typecheck, lint, build, all PG tests | backend-phase10.yml | CI | NOT VERIFIED |

Legacy Phase02–09 tests are retained. Test source does not count as executed PASS. The independent Phase09 audit R10-01..04 is addressed in source and proposed regression tests; PG tests remain unexecuted.
