# شرایط پذیرش Recovery و انتشار

جدول زیر وضعیت تاریخی Phase 16 است. نتایج این بازبینی در `BOOKCORE_BACKUP_RESTORE_VERIFICATION_FA.md` و `BOOKCORE_RELEASE_GATE_MATRIX.md` ثبت شده‌اند.

## ورودی گردش‌کار Recovery

محیط GitHub با نام `bookcore-disposable-recovery` باید بررسی‌کننده و محدودیت شاخهٔ تأییدشده داشته باشد. یک تولیدکنندهٔ جدا از همین مخزن، با دادهٔ مصنوعی و PostgreSQL 17، فایل `.dump.age` و Manifest متناظر را به‌عنوان artifact با نام `bookcore-synthetic-recovery-fixture` منتشر می‌کند. فایل باید دادهٔ دامنهٔ مصنوعی و ledger منطبق با نسخهٔ سورس داشته باشد. اپراتورٔ تولیدکننده digest فایل Manifest را پیش از تحویل در کانالی دارای کنترل دسترسی ثبت می‌کند.

اپراتور تأییدکننده در محیط محافظت‌شده شناسهٔ اجرای تولیدکننده را در `BOOKCORE_RECOVERY_ARTIFACT_RUN_ID`، digest مورد تأیید را در `BOOKCORE_TRUSTED_MANIFEST_SHA256` و هویت خصوصی آزمایش را در secret با نام `BOOKCORE_SYNTHETIC_AGE_IDENTITY` ثبت می‌کند. اجرای دستی تنها با `I_AUTHORIZE_DISPOSABLE_RECOVERY` مجاز است. عملیات روی سرویس PostgreSQL موقت گردش‌کار و مقصد علامت‌گذاری‌شده انجام می‌شود.

هیچ Backup یا Restore صرفاً با اجرای Mock PASS عملیاتی نمی‌شود. قبل از Pilot/Production موارد زیر باید با نام اپراتور، محیط، نسخهٔ PostgreSQL، زمان، Hash، خروجی فرمان و SQL نهایی قابل ممیزی باشند.

| Gate | معیار پذیرش | اکنون |
|---|---|---|
| G-DEP | npm ci + Typecheck + ESLint + Build روی Lockfile واقعی | FAIL — Lockfile موجود نیست |
| G-PG | Migrationهای 001–012 روی PostgreSQL 17، تکرار مجدد و Negative SQL | NOT VERIFIED |
| G-BACKUP | pg_dump واقعی با دادهٔ مصنوعی، Manifest و SHA، List | NOT VERIFIED |
| G-RESTORE | restore روی دیتابیس ایزوله و تطبیق Ledger/Rows/Booking history | NOT VERIFIED |
| G-SEC | Roleهای جدا و عدم دسترسی Runtime به Restore و Backup | NOT VERIFIED |
| G-PITR | Base Backup + WAL replay با Recovery Target | NOT VERIFIED |
| G-LOAD | ظرفیت 1/20 با 100 درخواست، 3 بار و 2 Process | NOT VERIFIED |
| G-WORKER | Crash، Lease expiry، دو Worker و Projection consistency | NOT VERIFIED |
| G-DR | خاموشی و از دست‌رفتن Host + بازگردانی روی Host جدید | NOT VERIFIED |
| G-HTTP | E2E Auth/RBAC/Consent/Booking/API + عدم نشت Tenant | NOT VERIFIED |
| G-CI | Run واقعی GitHub Actions با Artifact امضاشده | NOT VERIFIED |

تصمیم نهایی Owner/DBA/Security لازم است. Failure هر Gate بحرانی به معنای NO-GO انتشار است؛ فقط ادامهٔ توسعهٔ سورس مجاز است.
