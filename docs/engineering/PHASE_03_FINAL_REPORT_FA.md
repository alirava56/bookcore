# BookCore — گزارش مهندسی فاز سوم: Backend Foundation

**تاریخ:** ۲۰۲۶-۱۱-۲۲  
**خروجی:** `BookCore-Phase-03-Backend-Foundation.zip`  
**ارزیابی کلی:** **PARTIALLY IMPLEMENTED — RUNTIME VERIFICATION DEFERRED**  
**وضعیت انتشار:** `NOT PRODUCTION READY`

## ۱. ورودی و مبنای قابل اعتماد

آرشیو `BookCore-Phase-02-Technical-Spike-Final-Verified.zip` بررسی و هش SHA256 آن با مقدار `3da3f894ff4a55c20ef3ff1ae666169c1461f6fb7f0230dee55be8a22e8efcab` تأیید شد. همهٔ **۹۱ مورد Manifest اصلی** مطابقت داشتند. چهار SQL Migration (`001_core.sql` تا `004_history_consistency.sql`) بدون تغییر بایتی منتقل شده‌اند. مستندات اصلی Phase 01 از Package قبلی حفظ شدند و سورس اصلی Phase 02 به‌صورت آرشیو و پوشهٔ جداگانه برای آزمون‌های آینده نگهداری شد. **هیچ کد تستی Phase 02 حذف نشده است.**

مطابق دستور صریح کارفرما در Phase 03، توسعه با وجود فقدان PostgreSQL ادامه پیدا کرده است. این تغییر سیاست، نتیجهٔ شکست Release Gates فاز دوم را پاک نمی‌کند و تأیید تولیدی نیست.

## ۲. کد واقعاً نوشته‌شده

- ساختار Modular Monolith مبتنی بر NestJS 12.6.0 و TypeScript strict؛ هنوز نصب و سازگاری اجرایی این نسخه‌ها تأیید نشده است.
- `main.ts` و `bootstrap.ts` برای Startup، تشخیص تنظیمات غلط، محدودسازی JSON body، Helmet، CORS، ValidationPipe، مدیریت Exception و Shutdown.
- `AppConfigModule` با تنظیمات قابل اعتبارسنجی، بدون Default برای DATABASE_URL و کلید مانیتورینگ، و رد مقادیر نمونه در Production.
- `DatabaseService` با Connection Pool، بررسی واقعیِ موردنظر برای پایگاه داده و حداقل Schema، Cleanup و Timeout.
- `UnitOfWork` با `READ COMMITTED`، قفل/Statement Timeout، COMMIT/ROLLBACK روی یک Connection، Retry محدود SQLSTATE و تفکیک Unknown Commit Outcome.
- `BookingSqlAdapter` فقط برای فراخوانی داخلی از تراکنش؛ شامل Session `FOR UPDATE` و Outbox INSERT؛ **Endpoint رزرو پیاده نشده است**.
- `GET /api/v1/health/live` عمومی و `GET /api/v1/health/ready` دارای کنترل IP مستقیم + `X-BookCore-Monitor-Key` و پاسخ 503 هنگام Down بودن دیتابیس.
- مدل Authorization و `DefaultDenyGuard` بدون Bypass؛ Identity/JWT و Tenant-level authorization هنوز پیاده‌سازی نشده‌اند.
- ثبت Request ID سمت سرور و JSON Log بدون Request Body و توکن؛ خطاهای `application/problem+json` با جزئیات امن.
- Dockerfile و Docker Compose با PostgreSQL 17.6، GitHub Actions، اسکریپت Migration با Ledger SHA، تولید OpenAPI فقط برای دو Endpoint و Runner مقاوم به صفر تست.

## ۳. هماهنگی با Phase 01 و Phase 02

قرارداد اصلی `docs/api/openapi.yaml` همچنان قرارداد طراحی Phase 01 با ۳۸ عملیات است؛ **در Runtime فقط دو Health endpoint موجود هستند**. Swagger UI در Production ممنوع و در Dev نیز پیش‌فرض غیرفعال است. ۴ SQL Migration از Phase 02 دقیقاً حفظ شده‌اند و کد آن‌ها فعلاً provisional است. ADR-020 مرز بین توسعهٔ مجاز و اعتبارسنجیِ معوق را مشخص می‌کند. هیچ Microservice، Frontend، پرداخت، Waitlist یا Booking HTTP API ایجاد نشده است.

## ۴. تست‌های نوشته‌شده و واقعاً اجراشده

تست‌های TypeScript برای Config، Security، Error Sanitization، Transaction Wrapper، Readiness، DTO Validation، HTTP Liveness/Readiness و PostgreSQL version/migration ledger نوشته شده‌اند. آزمون HTTP دارای Database Test Double است و حتی در صورت اجرای موفق، **اثبات PostgreSQL نیست**.

**انجام‌شده و PASS:** هش مرجع ۹۱ فایل، یکسان‌بودن ۴ Migration، بررسی مسیرهای موجود، Parse Syntax فایل‌های TypeScript و Importهای داخلی (۲۷ فایل بدون خطای Syntax)، آزمون مستقل Runner و تشخیص شکست/صفر تست، Parse YAML قرارداد اصلی و CI/Compose. ابزارهای Parse، جای Typecheck/ESLint/Compose واقعی را نمی‌گیرند.

**ناموفق یا ناموجود:** تولید npm lockfile به Timeout خورد (Registry در دسترس نیست)، `npm ci` به‌دلیل نبود Lockfile شکست خورد، Typecheck و Build به‌دلیل نبود NestJS و `@types/node` شکست خوردند، ESLint نصب نبود، تست‌های NestJS در Runtime اجرا نشدند. هیچ PostgreSQL/Docker در این محیط وجود نداشت و هیچ Migration یا تست تراکنش/هم‌زمانی اجرا نشد. GitHub Actions اجرا نشده است. جزئیات دقیق در `docs/verification/PHASE_03_TEST_EVIDENCE.md` و `evidence/*.log` است.

## ۵. ارزیابی هشت محور پذیرش

| محور | Implementation | Verification |
|---|---|---|
| 1. ساختار مخزن | IMPLEMENTED | PASS — فهرست واقعی فایل‌ها |
| 2. پایهٔ NestJS | IMPLEMENTED | NOT VERIFIED — نصب/اجرای واقعی ممکن نشد |
| 3. طراحی اتصال DB | IMPLEMENTED | NOT VERIFIED — PostgreSQL اجرا نشد |
| 4. تنظیمات و امنیت پیش‌فرض | IMPLEMENTED | NOT VERIFIED — تست HTTP/Nest اجرا نشد |
| 5. قرارداد خطا | IMPLEMENTED | NOT VERIFIED — فقط بررسی منبع |
| 6. Observability | IMPLEMENTED | NOT VERIFIED — Runtime اجرا نشد |
| 7. زیرساخت توسعه | PARTIALLY IMPLEMENTED | NOT VERIFIED — فاقد Lockfile و اجرای Docker/CI |
| 8. مستندات و نگهداری تست‌ها | IMPLEMENTED | PASS — حفظ مرجع و Source |

**Gateهای Phase 02 بدون تغییر:** G1–G7=`NOT VERIFIED`، G8=`FAIL`.

## ۶. ریسک‌ها و تصمیم‌های باز

1. مهم‌ترین مانع فنی این خروجی، نبود **Lockfile واقعی** و نصب‌نشدن Dependencyهاست. ساخت دستی هش npm ممنوع بوده و انجام نشده است.
2. Migrationهای Phase 02 شامل Triggerهای پیچیده، Exclusion و سیاست‌های تاریخی هستند که هیچ آزمون PostgreSQL 17 ندارند؛ اعمال روی Production مجاز نیست.
3. Connection/Unknown Commit و Retry هنوز فقط پیاده‌سازی Source هستند و باید با Fault Injection واقعی بررسی شوند.
4. Role runtime برای نوشتن جدول‌ها مجوزدهی نشده و به‌عمد محدود مانده است؛ بدون طراحی Least Privilege و RBAC قابل استفاده برای عملیات رزرو نیست.
5. لایهٔ Auth و Authorization آینده باید Global User، Membership فعال، Object Scope و Revocation هم‌زمان را اجرا کند؛ Placeholderهای فعلی آن را اجرا نمی‌کنند.
6. Readiness فقط اتصال/وجود اسکیمای پایه را تأیید خواهد کرد، نه تکمیل تمام Migrationها یا صحت Business Invariants.
7. تست‌های فعلی آزمایشِ «قابلیت اجرا» نشده‌اند و ممکن است نصب واقعی NestJS ایرادهای Typecheck یا Runtime دیگری آشکار کند.

## ۷. اقدامات بعدی

در یک محیط متصل، از استخراج تمیز ZIP: تولید Lockfile از npm Registry، `npm ci`، Typecheck، ESLint، Build، Test Suite و تولید OpenAPI اجرایی. سپس PostgreSQL 17 با `docker compose` و Migrationهای اصلی/تکراری را بالا آورده، تمام G1–G8 فاز دوم و تست‌های Phase 03 را با شواهد رکوردهای Commit شده اجرا کنید. تست Zero-Test Runner و Clean-room را تکرار کنید؛ سپس ریسک‌های واقعی را رفع کنید و فقط پس از آن Security/Booking API مراحل بعد توسعه یابند.

**هیچ فایل GitHub منتشر/Push نشده و Phase 04 آغاز نشده است.** با وجود Source تحویلی، Foundation هنوز Production-Verified یا Implementation-Complete تأییدشده نیست.
