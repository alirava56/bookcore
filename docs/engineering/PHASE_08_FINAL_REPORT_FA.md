# BookCore — Phase 08 Final Engineering Report (FA)

**تاریخ:** ۲۰۲۶-۱۱-۲۲  
**حکم:** `SOURCE IMPLEMENTATION CANDIDATE — POSTGRESQL/NESTJS RUNTIME NOT VERIFIED`

## ۱. مبنای ممیزی

آرشیو `BookCore-Phase-07-Booking-Engine.zip` به‌عنوان سورس رسمی فاز قبل از حالت ZIP استخراج و کنترل شد. تمامی ۳۱۷ مدخل Manifest با SHA-256 و Inventory تطابق داشتند، CRC آرشیو موفق بود، و سورس کامل هشت Migration و Domain، OpenAPI، ADR، Test و Deferred Register بررسی شد. Original ZIP بدون تغییر باقی ماند.

## ۲. اصلاحات واقعی سورس فاز ۰۷

- **R-01:** Cursor قبلی زمان را با `Date.toISOString()` به میلی‌ثانیه گرد می‌کرد. SQL اکنون `to_char(..., 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` را برای Cursor می‌دهد؛ Parser دقت شش‌رقمی را حفظ می‌کند، Tuple مرتب‌شده `(created_at,id)` همان منطق Query است و HMAC وابسته به Tenant/User، دست‌کاری را رد می‌کند.
- **R-02:** دیگر تمام خطاهای `23505` به رزرو تکراری تبدیل نمی‌شوند؛ فقط Constraint با نام `unique_effective_booking` معادل `BOOKING_ALREADY_EXISTS` است. سایر خطاها به کد عمومی امن تبدیل می‌شوند. خطاهای COMMIT نامعلوم همچنان جداگانه با `UnknownCommitOutcome` شناخته می‌شوند.
- **R-03:** Check رزرو موجود قبل از برگرداندن `SESSION_FULL` انجام می‌شود؛ این اصلاح ضریب محافظتی PostgreSQL را کاهش نمی‌دهد.
- **R-04:** رگرسیون‌های Pure و یک Test Suite ادغامی PostgreSQL نوشته شد. اجرای Runtime به دلیل کمبود زیرساخت معوق است.
- **R-05:** Consent رزرو توسط کارمند همچنان Fail-closed است. خطرات Refresh Token، Session Creation unknown commit و Role Revocation از دفتر تست‌های معوق حذف نشده‌اند.

## ۳. قابلیت‌های جدید ساخته‌شده

- Endpoint اداری `GET /api/v1/organizations/{orgId}/reports/occupancy` با CTE تجمیعی و بازهٔ ۳۱ روز؛ دقیقاً Schema `Occupancy` اصلی را تولید می‌کند. `sessions` شامل PUBLISHED/FINISHED/CANCELLED و بدون DRAFT است؛ شمارش سایر ستون‌ها براساس وضعیت فعلی Bookingهاست.
- Worker واقعی PostgreSQL با Claim دارای Lease و `SKIP LOCKED`، Retry نمایی محدود، Permanent Failure/Quarantine، دو Worker بالقوه، کنترل Payload، تأیید مالکیت Aggregate، و Graceful Shutdown.
- Projection داخلی پایدار `processed_outbox_events` با `UNIQUE(event_id)` در همان تراکنش که Outbox را `published_at` می‌کند. این **اثبات ارسال بیرونی نیست**؛ Provider ایمیل/پیامک/Webhook وجود ندارد.
- Migration افزایشی `009_outbox_delivery.sql` با نقش محدود Worker، Schema-Version، Indexهای Poll و Aggregate Ordering، Constraintهای Claim، و Receipt append-only.
- Docker Compose، CI کاندیدا، Script Worker، مستندات عملیاتی، ADR، گزارش امنیت و منابع تست به‌روزرسانی شد. Migrationهای 001–008 تغییر نکردند.

## ۴. کنترل‌ها و شواهد واقعی

| بررسی | نتیجه | شواهد |
|---|---|---|
| CRC و Manifest مرجع فاز هفتم | PASS | `scripts/verify-manifest.cjs` روی ZIP اولیه |
| تست‌های Pure اجراشده | **19 PASS / 0 FAIL** | `evidence/phase08/pure_tests.log` |
| AST نحوی TypeScript | PASS، ۸۴ فایل | `evidence/phase08/ts_ast.log` |
| Static source و Migration hashes | PASS، ۹ Migration | `evidence/phase08/migration_checksum.log` و `static_inherited.log` |
| مرجع فاز دوم | PASS، SHA منبع | `evidence/phase08/reference.log` |
| OpenAPI 3.1 YAML و ۴۲۳ `$ref` داخلی | PASS، ۰ ارجاع خراب | `evidence/phase08/openapi_static.log` |
| npm Registry و Lockfile واقعی | FAIL (`ENOTCACHED`) | `evidence/phase08/npm_lock_attempt.log` |
| `npm ci` | FAIL (فاقد Lockfile معتبر) | `evidence/phase08/npm_ci_attempt.log` |
| PostgreSQL 17 / Docker | NOT AVAILABLE | `evidence/phase08/environment.log` |
| NestJS HTTP و PostgreSQL Integration | NOT VERIFIED (۰ تست اجرا) | محیط بدون وابستگی‌ها و PostgreSQL |
| GitHub Actions | NOT VERIFIED | Workflow اضافه شد اما Push/Run نشده است |

**توجه:** AST Syntax جایگزین Typecheck با Dependency واقعی نیست و Unit/Pure Test جایگزین اثبات Transactionهای PostgreSQL نیست.

## ۵. ارزیابی ۱۱ Gate (پیاده‌سازی مستقل از صحت Runtime)

| Gate | Implementation | Verification | مانع/شاهد |
|---|---|---|---|
| G1 — Phase07 fixes | IMPLEMENTED | NOT VERIFIED | Pure PASS؛ SQL Cursor/HTTP معوق |
| G2 — Occupancy correctness | IMPLEMENTED | NOT VERIFIED | Query و Test source؛ PG معوق |
| G3 — Reporting tenant/RBAC | IMPLEMENTED | NOT VERIFIED | Scope داخل Query؛ HTTP/PG معوق |
| G4 — Worker implementation | IMPLEMENTED | NOT VERIFIED | Source؛ PG معوق |
| G5 — Concurrent claiming | IMPLEMENTED | NOT VERIFIED | SKIP LOCKED؛ دو Worker واقعی معوق |
| G6 — Retry/crash | IMPLEMENTED | NOT VERIFIED | Pure retry PASS؛ crash/lease SQL معوق |
| G7 — Idempotent consumption | IMPLEMENTED | NOT VERIFIED | Unique Receipt/Transaction؛ SQL معوق |
| G8 — Worker security/observability | PARTIAL | NOT VERIFIED | Role/metrics منبع؛ محیط معوق |
| G9 — Migration/grants | PARTIAL | NOT VERIFIED | Migration hash PASS؛ اجرای SQL معوق |
| G10 — API contract | IMPLEMENTED | NOT VERIFIED | Static refs PASS؛ HTTP response معوق |
| G11 — Tests/reproducibility | PARTIAL | FAIL | npm ci و PostgreSQL در دسترس نیستند |

## ۶. نواقص، ریسک‌ها و تصمیمات باز

تست‌های پایان فاز دوم و امنیت JWT/RBAC فاز چهارم همچنان اجرای واقعی ندارند؛ Migrationهای پیشین با وجود تطابق SHA هنوز توسط این بسته روی PostgreSQL تست نشده‌اند. Stage/Release Production **مجاز نیست**. تست Snapshot در حضور رزرو هم‌زمان، ترتیب واقعی رویدادهای Aggregate، Unknown Commit، Batch Shutdown، Retryهای مضاعف و Policyهای Quarantine معوق هستند. Event Processor هیچ Delivery خارجی انجام نمی‌دهد. تعریف دقیق Occupancy و درج Session لغوشده در Count نیازمند تصمیم محصول است. HMAC Cursor در صورت تغییر کلید JWT فعال نامعتبر می‌شود و کاربر باید صفحه‌بندی را دوباره آغاز کند.

## ۷. گام لازم برای Release Gate بعدی

در ماشین دارای PostgreSQL 17، Node 22 و npm Registry ابتدا یک `package-lock.json` اصیل تولید کنید، `npm ci`, Typecheck/Lint/Build را اجرا کنید؛ Owner، Runtime و Worker Login را به صورت مستقل ایجاد کنید؛ Migrationها را دوبار اعمال کنید؛ Unit/HTTP/Integration و دو Worker مستقل را اجرا و لاگ‌های واقعی PostgreSQL را ثبت کنید. نتایج Phantom/Mock نباید به‌عنوان PASS گزارش شوند. CI فقط وقتی `PASS` است که روی Repository واقعی اجرا و مشاهده شده باشد.

**نتیجهٔ نهایی:** توسعهٔ فاز ۰۸ در سورس انجام شده است؛ قابلیت‌های DB-dependent و کل سامانه هنوز Production-Ready نیستند. فاز ۰۹ آغاز نشده و هیچ GitHub Push صورت نگرفته است.
