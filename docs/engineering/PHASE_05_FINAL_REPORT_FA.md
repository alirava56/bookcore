# BookCore — گزارش نهایی مهندسی فاز ۰۵

**تاریخ:** ۲۰۲۶-۱۱-۲۲  
**خروجی:** `BookCore-Phase-05-Catalog-Scheduling.zip`  
**حکم:** `SOURCE IMPLEMENTATION CANDIDATE — DATABASE/NESTJS RUNTIME NOT VERIFIED` (نه Production-Ready).

## ۱. بررسی ورودی و Provenance

- بستهٔ ارسالی Phase04 با SHA-256 کنترل شد: ۱۹۳ فایل مندرج در Manifest اصلی با هش دقیق هم‌خوانی داشتند. نسخهٔ قدیمی به صورت تغییرنکرده در `reference/Phase_04` نیز نگهداری می‌شود.
- Migrationهای ۰۰۱ تا ۰۰۵ از بستهٔ مرجع به‌صورت byte-for-byte حفظ شدند. تنها `006_catalog_availability.sql` افزوده شد.
- Design OpenAPI 3.1، ماتریس مجوز، گزارش امنیتی و Deferred Test Register فاز چهارم مبنای ساخت هستند. هیچ Endpoint رزرو، Session creation، پرداخت یا لیست انتظار ایجاد نشده است.

## ۲. پیاده‌سازی واقعی سورس

- ماژول جدید `modules/catalog`: Branch Create/List، Service Create/List، Resource Create/List، BusinessHours Create/List/Deactivate، ScheduleExceptions Create/List/Deactivate (جمعاً **۱۲ عملیات HTTP** تحت prefix `/api/v1`).
- اعتبارسنجی DTO با class-validator، Pagination کلید UUID و Limit ۱ تا ۱۰۰، Response DTO بدون فیلدهای غیرمرتبط با Resource Type.
- `CatalogService.writer`: Transaction واقعی در سورس با قفل Tenant، Recheck نشست/عضویت و دسترسی فقط OWNER/MANAGER؛ ثبت Audit و Outbox در همان Transaction.
- GET داده‌ها دارای Tenant و Role predicate در خود Query و محدودیت نمای داخلی مربی هستند. TRAINER اجازهٔ فهرست‌کردن Directory منابع را ندارد.
- Migration 006: Branch address، قواعد جدید طول نام/عنوان برای نوشته‌های آینده، دو جدول تقویم با FK مرکب، Trigger جلوگیری از هم‌پوشانی هفتگی، دو GiST Exclusion Constraint روی Exceptions، Trigger فعال‌بودن Membership مربی و شعبهٔ اتاق، Grant نقش محدود Runtime.
- موتور Pure Availability با Timezone IANA، ISO weekday، Hours/Exception precedence، DST gap/fold، بازهٔ half-open و Buffer، به‌علاوهٔ مسیر داخلی DB transaction adapter برای فاز ۰۶؛ **بدون رزرو یا کنترل ظرفیت نهایی**.
- Database Readiness برای شش Migration و جداول Hours/Exceptions اصلاح شد؛ Checksum 006 از فایل واقعی محاسبه شده است.
- اسکریپت Maintenance برای پاک‌سازی Bucketهای قدیمی Rate Limit ایجاد شد (دستی با Migration credential).

## ۳. رفع ناسازگاری‌های تأییدشده

1. Contract `Resource` با `not required` نوع‌محور سازگار شد: `ROOM` فقط `branchId` و `TRAINER` فقط `trainerUserId` را نمایش می‌دهد.
2. DTOهای اختیاریِ Phase05 حالا `null` صریح را هم رد می‌کنند (قبلاً ممکن بود نامعتبر را وارد سرویس کنند)؛ دو تست رگرسیون برای جلوگیری از خطا و ناسازگاری قرارداد افزوده شد.
3. حداقل طول نام شعبه/عنوان خدمت/نام Resource در OpenAPI با DTO و Persistence به ۲ حرف همسان شد؛ Requestهای Hours و Exceptions الزام XOR target دارند.
4. Ruleهای محلی هرگز به UTC ثابتِ هفتگی تبدیل نمی‌شوند؛ تهران، Berlin DST و عبور نیمه‌شب در تست‌های Pure پوشش داده شده است.
5. برای `CREATE TRAINER/ROOM` کنترل عضویت/شعبهٔ ACTIVE به Trigger افزوده شده تا Direct SQL تغییر نقش/شعبه را دور نزند (رفتار تراکنشی هنوز قابل‌اثبات نیست).
6. Trigger هم‌پوشانی یکشنبه→دوشنبه را با جابه‌جایی ± یک هفته بررسی می‌کند.
7. تاریخچهٔ Rules فقط غیرفعال می‌شود؛ `DELETE` و ویرایش مؤلفه‌های تاریخی ممنوعند.

## ۴. بررسی مستقل خطرات Phase04

- Refresh Token: از حیث سرقت/Replay، Policy «Consumed token → revoke family» حفظ شده؛ Concurrent Retry یا پاسخ گمشده می‌تواند نشست سالم را باطل کند. **این ریسک برطرف نشده** و Client Single-Flight / Reauthentication لازم است.
- Membership Consent: افزودن کاربر با UUID رضایت خودکار او را ثابت نمی‌کند؛ برنامهٔ Invitation/Acceptance پیش از تجاری‌سازی باید مصوب و اجرا شود.
- Auth rate limit: Direct Peer به جای Trust آزاد به X-Forwarded-For استفاده می‌شود؛ اثر NAT/Proxy و تراکم Rate Bucket باقی است. اسکریپت نگهداری ساخته شد، اما Ingress-level defense هنوز راه‌اندازی نشده.
- Global `APP_GUARD` و Default Deny تغییر نکرده؛ هیچ مسیر جدید Public نشده است.

## ۵. آزمایش‌های واقعاً اجراشده

| کنترل | نتیجهٔ واقعی | شواهد |
|---|---|---|
| Manifest مرجع ۱۹۳ فایل | PASS | ابزار verify-manifest قبل از تغییر |
| TypeScript Pure Availability transpile + execution | **۱۳ اجرا / ۱۳ PASS / ۰ FAIL** | `evidence/phase05/availability_execution.log` |
| TypeScript AST parse | PASS، ۵۴ فایل پس از افزودن تست سخت‌گیرانه DTO | `evidence/phase05/typescript_ast.log` |
| OpenAPI YAML strict/duplicate key + ۴۲۳ Ref و ۱۲ عملیات | PASS (static) | `evidence/phase05/openapi_contract.log` |
| Static source presence / migration hashes ۰۰۱–۰۰۶ | PASS | `source_static.log`, `migration_hashes.log` |
| Runner fail-on-zero self-test | PASS | `zero_runner.log` |
| npm Registry | FAIL: `EAI_AGAIN` | `registry.log` |
| Lockfile creation | TIMEOUT؛ تولید Lockfile معتبر انجام نشد | `npm_lockfile_attempt.log` |
| npm ci | FAIL: Lockfile موجود نیست | `npm_ci.log` |
| Typecheck و Build واقعی | FAIL: type packages نصب نشده‌اند | `typecheck_attempt.log`, `build_attempt.log` |
| ESLint | FAIL: package نصب نشده | `lint_attempt.log` |
| NestJS Unit/HTTP | NOT VERIFIED؛ Build موجود نیست، runner خروج ناموفق دارد | `unit_attempt.log` |
| PostgreSQL 17 / Migration 006 / HTTP E2E / دوپردازشی / CI | NOT VERIFIED؛ Docker، psql و PostgreSQL اجرایی نیستند | `environment.log` |

وجود تست‌های TypeScript در سورس، **هیچ پاسخی دربارهٔ صحت SQL/تراکنش‌ها یا امنیت HTTP بدون اجرا نمی‌دهد**.

## ۶. پذیرش مستقل هر Gate

| Gate | Implementation | Verification | دلیل |
|---|---|---|---|
| G1 — Branch | IMPLEMENTED | NOT VERIFIED | HTTP و DB اجرا نشد |
| G2 — Service | IMPLEMENTED | NOT VERIFIED | Constraints و API اجرا نشد |
| G3 — Resource Ownership | IMPLEMENTED | NOT VERIFIED | Unique Race و Trigger اجرا نشد |
| G4 — Business Hours | IMPLEMENTED | NOT VERIFIED | Weekly exclusion در PG اجرا نشد |
| G5 — Schedule Exceptions | IMPLEMENTED | NOT VERIFIED | GiST/role/audit در PG اجرا نشد |
| G6 — Timezone & Availability | IMPLEMENTED | NOT VERIFIED | تست Pure = PASS، DB seam و HTTP اجرا نشده |
| G7 — Tenant Authorization | IMPLEMENTED | NOT VERIFIED | RBAC و Revocation Race تست اجرایی ندارند |
| G8 — Database Integration | PARTIAL | NOT VERIFIED | SQL 006 و Migration Ledger اجرا نشده |
| G9 — API Contract | IMPLEMENTED | NOT VERIFIED | YAML static PASS؛ Generated Swagger/HTTP E2E نیست |
| G10 — Tests/Reproducibility | PARTIAL | FAIL | عدم Lockfile/NestJS/PG مانع clean build |

## ۷. تصمیم‌های باز و ریسک‌های واقعی

`PD-06` ساعات کار منابع در مقابل شعبه نیازمند تأیید Stakeholder است؛ این فاز سیاست Fail Closed را برگزیده است. سخت‌گیری DST روی Boundary مبهم/ناموجود، محدودیت ۲۴ساعته Rule و ۳۱ روزه Exception نیز باید با کسب‌وکار تأیید شوند. سیاست Role-driven Visibility مربی و Consent برای درج عضویت نیز نیازمند پذیرش Product است.

**ریسک اجرا:** SQL 006، Functionهای SECURITY DEFINER، Lock Order و EF/ORM integration هنوز آزمایش واقعی ندارند. Triggerهای نامعتبر ممکن است Migration را در مرحلهٔ اجرا متوقف کنند؛ هیچ گزارش ایمنی کاذب صادر نشده است. آزمون‌های باقی‌ماندهٔ فازهای ۰۲–۰۴ هم کماکان بازند.

## ۸. فرمان‌های بازتولید پس از نصب زیرساخت

```bash
cd bookcore
# Node 22, PostgreSQL 17 و npm registry واقعی باید فعال باشند.
npm install --package-lock-only --ignore-scripts --no-audit
npm ci
npm run verify:reference && npm run verify:static
npm run test:availability:isolated
npm run typecheck && npm run lint && npm run build
# مهاجرت فقط با MIGRATION_DATABASE_URL متعلق به نقش Migration Owner
npm run migrate && npm run migrate
# اجرای API با DATABASE_URL نقش محدود bookcore_app
npm run test:unit && npm run test:integration
npm run openapi:current
```

پس از این مرحله، لاگ‌های PostgreSQL واقعی و نتیجهٔ Reconciliation فاز دوم، Negative SQL، Conflict Race، Tenant visibility، Test Discovery و Rollback کامل باید به گزارش افزوده شوند. GitHub Actions فقط پس از اجرای واقعی CI قابل PASS است؛ فایل Workflow به معنی اجرای آن نیست.

## ۹. تصمیم نهایی

`SOURCE IMPLEMENTATION CANDIDATE — DATABASE/NESTJS RUNTIME NOT VERIFIED`

توسعهٔ سورس فاز ۰۵ انجام شده اما قابل تأیید به‌عنوان کاندیدای Release یا Production نیست. توسعهٔ Session/Booking فاز ۰۶ در این تحویل شروع نشده و تغییری در GitHub انجام نشده است.
