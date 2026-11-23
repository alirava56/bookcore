# Phase 14 — اجرای آزمون‌ها و معیار پذیرش

| بررسی | فرمان یا فایل | نتیجهٔ این نشست | معیار پذیرش واقعی |
|---|---|---|---|
| Manifest منبع | `node scripts/verify-manifest.cjs` روی ورودی | PASS، 545 فایل | هش و Inventory مطابق |
| آزمون‌های Pure/Mock | اسکریپت‌های Phase05–14 | PASS، 115 آزمون | بدون Skip/Fail/Zero |
| R14-01 تا R14-04 | `test:phase14:isolated` | PASS در سطح Pure/Mock | اجرای ابزار واقعی با Credential جدا |
| Harness Booking | `booking-postgres.test.ts` | NOT VERIFIED (PG unavailable) | 2 Process × 100 × 3 × 2 ظرفیت، بدون 5xx |
| Typecheck مستقل دامنه | `tsc --strict ... contention-result.ts` | PASS | Strict بدون خطای Type |
| Full Typecheck/Build/Lint | `npm run typecheck/lint/build` | FAIL/BLOCKED | نصب اصیل و صفر خطا |
| npm ci | `npm ci --offline` | FAIL | Lockfile معتبر و نصب تمیز |
| PG17 و Migration دوباره | `npm run migrate` ۲ بار | NOT RUN | Apply و Checksum Verified |
| Nest Bootstrap & HTTP | `phase14-runtime-smoke.test.ts` | NOT RUN | واقعی و منفی‌های 401/403 |
| Outbox 2 Workers | test integration inherited | NOT RUN | یک Claim و Receipt پایدار |
| Backup/Restore/PITR | ابزارهای Recovery + Drill | NOT RUN | بازگردانی و Ledger/Data Consistency |
| GitHub Actions | `.github/workflows/backend-phase14.yml` | NOT RUN | خروجی CI حقیقی و سبز |

خروجی و Exit Code هر فرمان واقعاً اجراشده در `evidence/phase14` نگهداری شده است. Source-only PASS به معنی PostgreSQL Gate PASS نیست.
