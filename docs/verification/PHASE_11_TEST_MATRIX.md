# Phase 11 — ماتریس آزمون و مرز شواهد

| دسته | فایل/دستور | هدف | وضعیت |
|---|---|---|---|
| Pure | `scripts/test-phase11-pure.cjs` | Cursor HMAC، Scope، سقف کار، EventOrder، زنجیرهٔ لغو/حضور | PASS 11/11 |
| Pure inherited | `test-availability-pure.cjs`, `test-session-domain-pure.cjs`, `test-booking-domain-pure.cjs`, `test-phase08-pure.cjs`, `test-phase09-pure.cjs`, `test-phase10-pure.cjs` | اعتبارسنجی قوانین قبلی | PASS 65/65 در صورت اجرای مجدد |
| Static API | `scripts/phase11-api-inventory.py` | شمارش Controllerها و عملیات OpenAPI، DTO و Auth metadata | PASS در سطح AST |
| Static migrations | `scripts/verify-migration-checksums.cjs` | ۱۲ هش با سورس | PASS |
| PostgreSQL 17 | `apps/api/test/integration/phase11-postgres.test.ts` | ۱۰۵ Consent، ادامهٔ Cursor، نقش نامعتبر، SET ROLE، GUC، تاریخچهٔ immutable | NOT VERIFIED |
| Full-stack HTTP | `apps/api/test/integration/phase11-mvp-http.test.ts` | A تا G: Auth/Org/Invitation/Scheduling/Booking/Consent/Reporting/Outbox | NOT VERIFIED |
| Existing E2E | Phase02–10 suites | Concurrency capacity 1/20 ×100 ×3، Worker، SQL triggers | NOT VERIFIED |
| Build | `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build` | Reproducibility and NestJS type correctness | FAIL / NOT VERIFIED: registry unavailable |
| CI | `.github/workflows/backend-phase11.yml` | PostgreSQL17 real GitHub run with npm lockfile | NOT VERIFIED |

**سیگنال شکست:** هیچ Mock یا AST را جانشین تست COMMIT/Lock/Grants نمی‌کنیم. تست‌های جدید بدون محیط disposable و Credentialهای مجزا Fail Closed می‌کنند. اجرای همهٔ موارد باید در CI و از ZIP استخراج‌شده تکرار شود.
