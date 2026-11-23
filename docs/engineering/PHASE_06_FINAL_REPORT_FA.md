# BookCore — گزارش نهایی مهندسی Phase 06

**مرحله:** Session Scheduling, Resource Allocation & Lifecycle — 2026-11-22

**حکم:** `SOURCE IMPLEMENTATION CANDIDATE — RUNTIME VERIFICATION DEFERRED`؛ سیستم Production-Ready نیست.

## ۱. ورودی و Provenance
آرشیو `BookCore-Phase-05-Catalog-Scheduling.zip` به‌عنوان مرجع معتبر دریافت شد. آزمون SHA-256 اولیه برای **۲۳۲ فایل** PASS بود. این بسته بدون دستکاری در بخش `reference/Phase_05/` نیز حفظ شده است. Migrationهای 001–006 با هش فایل‌های اولیه تطبیق دارند و هیچ‌یک تغییر نکرده‌اند. پنج فاز پیشین و Referenceهای آن‌ها در Workspace موجود هستند.

## ۲. سورس واقعاً اضافه/اصلاح‌شده
- ماژول `apps/api/src/modules/scheduling/` شامل DTO، کنترلر عمومی/کارکنان، سرویس تراکنشی و قوانین مستقل دامنه.
- ۹ عملیات REST فعلی از جمله Create DRAFT، Publish، Cancel، Finish، Capacity، تقویم و جزئیات Staff و Public.
- Atomic DRAFT + ResourceAllocationهای بافرشده و Audit/Outbox در یک تراکنش PostgreSQL؛ تنظیم‌پذیری از Catalog Phase05 استفاده می‌شود.
- محدودیت نقش کارمند: OWNER/MANAGER برای Mutation؛ RECEPTIONIST خواندن؛ TRAINER فقط جلسات Resource مربی خودش. WHERE نهایی نقش را دوباره بررسی می‌کند.
- PublicSession projection مستقل و فهرست امن، بدون ID داخلی و شمارندهٔ تعهد.
- Session Cancel همراه با ۱۵ Booking فرضی: مسیر کد برای لغو تمام CONFIRMEDها، صفرکردن Counter، درج BookingEvents/Outbox و آزادکردن Allocation در یک Transaction نوشته شد.
- Idempotency روی Cancel/Capacity با Same-key Replay, Payload Mismatch و Committed 4xxهای دامنه؛ خطای COMMIT نامعلوم به‌صورت 503 برگردانده می‌شود و به‌صورت موفقیت گزارش نمی‌شود.
- Migration افزایشی `007_session_permissions.sql`: مجوزهای حداقلی برای ROLE اجرایی، بدون تغییر Migrationهای تاریخی.
- اصلاح `CatalogService.mapDatabaseError` برای پرهیز از ترجمهٔ همهٔ SQLSTATE 23505 به Duplicate Resource و اصلاح ورود UTC ذخیره‌شده هنگام Publish.
- اصلاح Race در Staff List با اعمال محدودیت Trainer **داخل SELECT نهایی** و محدودسازی کلید RateLimit بر اساس Handler ثابت، نه UUID کاربر در Path.
- تست‌های دامنه، تست‌های Integration/PostgreSQL و CI Phase06 اضافه شدند. CI فاز پنجم به شکل فایل تاریخی ذخیره شد.

## ۳. اعتبارسنجی واقعی انجام‌شده
| Check | Result | Evidence |
|---|---|---|
| ZIP مرجع Phase05: 232/232 SHA-256 | PASS | ثبت ارزیابی ورودی |
| اجرای واقعی ۸ تست Pure Session Domain | PASS 8/8 | `evidence/phase06/pure_session_domain.log` |
| اجرای واقعی ۱۳ تست Pure Availability فاز پنجم | PASS 13/13 | `evidence/phase06/pure_availability.log` |
| بررسی Syntax AST سورس TS | PASS | `evidence/phase06/syntax_scan.log` |
| Static Source + Checksum هفت Migration | PASS | `evidence/phase06/static_checks.log` |
| Strict YAML + Duplicate Keys + $ref + عملیات Phase06 + Public Safety | PASS | `evidence/phase06/contract_check.log` |
| npm Registry | FAIL: EAI_AGAIN | `evidence/phase06/npm_registry_attempt.log` |
| npm Lockfile از Cache واقعی | FAIL: ENOTCACHED | `evidence/phase06/npm_lockfile_attempt.log` |
| `npm ci` | FAIL: فقدان Lockfile واقعی | `evidence/phase06/npm_ci_attempt.log` |
| Typecheck / Build / ESLint با Dependencyهای واقعی | FAIL (prerequisite unavailable) | لاگ‌های مربوطه |
| Node NestJS test runner | NOT VERIFIED: build موجود نیست | `unit_test_attempt.log` |
| PostgreSQL migration/Transaction/Concurrency/Integration | NOT VERIFIED: PostgreSQL/Docker موجود نیست | `environment.log` |
| GitHub Actions | NOT VERIFIED: هیچ Push یا Workflow اجرای واقعی نشده | Workflow source only |

**توجه:** شمارش ۲۱ PASS فقط تست‌های Pure است، نه اجرای NestJS، PostgreSQL یا HTTP.

## ۴. وضعیت Gateهای فاز ششم
| Gate | Implementation | Verification |
|---|---|---|
| G1 — Session Creation | IMPLEMENTED | NOT VERIFIED |
| G2 — Atomic Resource Allocation | IMPLEMENTED | NOT VERIFIED |
| G3 — Session Publication | IMPLEMENTED | NOT VERIFIED |
| G4 — Staff Session Calendar | IMPLEMENTED | NOT VERIFIED |
| G5 — Public Session Discovery | IMPLEMENTED | NOT VERIFIED |
| G6 — Session Cancellation / Idempotency | PARTIAL (uncertainty recovery pending real faults) | NOT VERIFIED |
| G7 — Session Completion | IMPLEMENTED | NOT VERIFIED |
| G8 — Capacity Adjustment | IMPLEMENTED | NOT VERIFIED |
| G9 — Authorization / Tenant Isolation | PARTIAL (race tests pending) | NOT VERIFIED |
| G10 — DB Integrity & API Contract | PARTIAL (SQL unexecuted) | NOT VERIFIED |
| G11 — Tests / Reproducibility | PARTIAL | FAIL (no real npm install) |

## ۵. مشاهده‌ها، اشکال‌های تأییدشده و ریسک‌های باز
**اصلاحات سورسی:** خطای SQLSTATE 23505 عمومی Catalog، UTC ورودی به rule evaluator هنگام Publish، ACL خواندن Trainer پس از تغییر نقش، و RateLimit کلید متغیر روی URL. هر یک مستند و با آزمون جدید یا بررسی استاتیک پوشش داده شده‌اند؛ تأیید End-to-End هنوز وجود ندارد.

**باقی‌ماندهٔ مهم:** امکان Deadlock در ترکیب Lock سازمان با مسیر Phase02 Booking (الگوی Session-first سابق)، SQL deferred trigger و ترتیب قفل‌ها، اجرای SQL 007 و Grantها، اثر Runtime تغییر Membership/Resource/BusinessHours هم‌زمان، سناریوهای Finish بعد از زمان واقعی، ظرفیت در رقابت با Booking و Unknown COMMIT واقعی. بخشی از تست‌های Integration این موارد صرفاً نوشته شده‌اند و بخش دیگری در Test Matrix برای تکمیل صریح مانده است. همچنین `package-lock.json` واقعی موجود نیست. خطاهای TypeScript ناشی از وابستگی‌های نصب‌نشده‌اند و پاس‌بودن Typecheck تایید نشده است.

**ریسک‌های ارثی:** Phase02 capacity-1/20 با ۱۰۰ مشتری، سه تکرار و دو Process همچنان اجرا نشده‌اند؛ Phase04 Refresh Unknown-COMMIT و مسئلهٔ Consent کارکنان نیز باز هستند. این‌ها مانع انتشار واقعی‌اند، نه لزوماً مانع ادامهٔ توسعهٔ سورس.

## ۶. دستورات اجرایی موردنیاز برای مستقل‌سازی شواهد
از ریشهٔ پروژه در محیط دارای Node.js 22، npm Registry و PostgreSQL 17: 

```bash
npm install --package-lock-only --ignore-scripts
npm ci
npm run verify:reference
npm run verify:static
npm run test:availability:isolated
npm run test:session-domain:isolated
npm run typecheck
npm run lint
npm run build
# پس از ساخت role امن bookcore_app، تنظیم متغیرهای توسعه و دیتابیس تازه:
npm run migrate
npm run migrate
npm run test:unit
npm run test:integration
npm run openapi:current
python3 scripts/phase06_contract_check.py
```

ایجاد Roleها و اطلاعات اتصال باید مطابق `infra/` و README با credentialهای تستی خود اپراتور انجام شود. Migration باید با حساب Owner جدا از Runtime اجرا شود. این دستورات در محیط حاضر **موفق اجرا نشده‌اند**. بعد از همهٔ PASSها، تست‌های Transaction و Fake Lost ACK / Process Kill با واقعی‌ترین Fault Injection ممکن اجرا و نتایج از Rows ثبت‌شده استخراج شود.

## ۷. نتیجه و مرز Scope
کدهای Session Scheduling و فایل‌های پذیرش آمادهٔ اجرای بعدی‌اند؛ اما اثبات امنیت عملی، Concurrency و Migration فراهم نشده است. هیچ Booking HTTP API، پرداخت، Billing یا Waitlist ساخته نشده و Phase07 آغاز نشده است. هیچ Push به GitHub صورت نگرفته است.
