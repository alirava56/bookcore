# Phase 12 — Test Matrix

| Test | Source | Execution evidence required | Actual status |
|---|---|---|---|
| Private backup paths, manifest, checksum, restore guard | `apps/api/test/unit/phase12-recovery.test.cjs` | Node22 test TAP | PASS on Node with synthetic mocks |
| Fail-closed subprocess error | same | Missing executable -> no artifact | PASS (mock-only) |
| Inspector selected-scope completion | `phase11-inspection.test.ts` | Pure transpiled test | PASS if execution log supplied |
| Restore on populated target | `scripts/recovery/restore.cjs` | PG17 fresh/dirty target | NOT VERIFIED |
| Actual pg_dump + pg_restore + Ledger | `phase12-backup-restore.test.ts` | disposable PG17 and official binaries | NOT VERIFIED |
| WAL replay/PITR | Runbook | base backup + WAL + separate target | NOT VERIFIED |
| Historical Booking/Outbox preservation | inherited suites | PG17 + load | NOT VERIFIED |
| Security operator & tenant isolation | inherited integration suites | individual LOGIN credentials | NOT VERIFIED |
| Backup encryption and restore | age + official tools | actual age key/ciphertext/restore | NOT VERIFIED |
| Infrastructure Compose and pipeline | infra/docker + CI | Docker+GitHub Actions run | NOT VERIFIED |

Tests using synthetic commands must never be reported as valid PostgreSQL backups. Failed runtime requirements remain blockers regardless of Pure test counts.
