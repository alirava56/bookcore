# Phase 04 — Test Matrix and Real Execution Status

**لاگ‌های مشاهده‌شده:** `evidence/phase04/*` و `evidence/phase04/test-summary.json`. فایل تست به معنای PASS نیست.

| Area | Test source | Expected | Execution status |
|---|---|---|---|
| Global default-deny | `unit/global-auth.test.ts` | undecorated anonymous rejected | NOT VERIFIED |
| JWT and claims | `unit/jwt.test.ts` | signature/expiry/aud/iss/alg valid | NOT VERIFIED |
| Role access | `unit/phase04-policy.test.ts` | manager promotion and anonymous denied | NOT VERIFIED |
| Existing Config/Health | `unit/*.test.ts` | safe startup/health/config/errors | NOT VERIFIED |
| Register and Duplicate | `integration/identity-tenant-postgres.test.ts` | SQL normalized unique + real Argon2 | NOT VERIFIED |
| Multi-Tenant and RBAC | same | foreign 404, role 403, revoke | NOT VERIFIED |
| Concurrent Refresh | same | 1 rotation, 1 deny, family revoked | NOT VERIFIED |
| Logout Session | same | DB session revoked, old token 401 | NOT VERIFIED |
| Concurrent Last Owner | same | 1 OWNER remains | NOT VERIFIED |
| Suspended and Audit | same | 401 and append-only SQLSTATE | NOT VERIFIED |
| Phase02 Booking invariants | reference Phase02 source | real PG concurrency and constraints | NOT VERIFIED |
| Runner zero-tests | `scripts/selftest-zero-runner.cjs` | zero test fails | execution evidenced separately |
| TypeScript parse | global TS AST (`evidence/phase04/syntax_scan.log`) | no parser errors | execution evidenced separately |

**Important:** هیچ آزمون PostgreSQL، NestJS HTTP یا Integration در این محیط به نتیجهٔ PASS نرسیده است. اعتبارسنجی Syntax مستقل از Typecheck است.
