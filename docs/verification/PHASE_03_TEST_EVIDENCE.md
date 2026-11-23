# Phase 03 — actual verification evidence

**Environment:** Node `v22.16.0`, npm `10.9.2`; neither PostgreSQL nor Docker available. No real DB host was contacted. No npm-based NestJS test was executed. `evidence/phase03_test_summary.json` provides machine-readable results.

| Check run | Observed result | Raw evidence |
|---|---|---|
| `node scripts/verify-reference.cjs` | PASS: authoritative Phase 02 ZIP SHA-256 matched | `evidence/reference_check.log` |
| `node scripts/static-verify.cjs` | PASS: 12 required paths, migrated source present | `evidence/static_check.log` |
| Bytewise compare migration 001–004 to original ZIP | PASS: 4/4 equal, per-file SHA recorded | `evidence/phase02_migration_provenance.log` |
| TypeScript v5.8.3 compiler API parse of project files / local import resolution | PASS: 27 `.ts` files, 0 parse/path errors | `evidence/typescript_syntax.log` |
| `node scripts/selftest-zero-runner.cjs` | PASS: missing, zero, phantom declarations, actual success/failure tests verified | `evidence/zero_test_runner_selftest.log` |
| Python YAML parsing of Phase 01 OpenAPI | PASS: parse only, 38 design operations | `evidence/phase01_yaml_parse.log` |
| Python YAML parsing of workflow/Compose | PASS: parse only, neither service executed | `evidence/ci_yaml_parse.log` |
| `npm install --package-lock-only ...` | FAIL/TIMEOUT; no legitimate lockfile produced | `evidence/npm_lockfile_attempt.log` |
| `npm ci --ignore-scripts --offline` | FAIL: authentic lockfile missing | `evidence/npm_ci_attempt.log` |
| `npm run typecheck` | FAIL: missing `@nestjs/*`, `pg`, Node type declarations | `evidence/typecheck_attempt.log` |
| `npm run lint` | Unavailable: `eslint` executable missing | `evidence/lint_attempt.log` |
| `npm run build` | FAIL: required modules/types not installed | `evidence/build_attempt_final.log` |
| `npm run test:unit` | Blocked: compiled test directory absent; runner exits nonzero | `evidence/unit_test_attempt.log` |
| PostgreSQL migrations, constraints, concurrency, test runner, `docker compose up`, GitHub Actions | NOT VERIFIED: prerequisites absent or not authorized | `evidence/node_npm_environment.log` |

## Evidence interpretation

- **Passing source AST and test-runner regressions do not imply that NestJS application runtime tests passed.** Unit definitions are authored but discovered runtime counts remain zero/unknown, not PASSED.
- The final TS parse only assesses syntax and local project-relative imports. Type declarations and peer-dependency compatibility were **not verified**.
- The older Phase 02 spike's multiple-process concurrency tests remain preserved, not executed. G1–G7 remain `NOT VERIFIED` and G8 remains `FAIL`.
- `evidence` contains no invented SQLSTATE, latency or worker throughput observations.
- The current CI workflow and Docker setup must be executed by an operator after resolving dependency registration; syntactically valid YAML is not proof of functioning CI.
