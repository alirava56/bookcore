# BookCore — گزارش نهایی مهندسی Phase 07

**حکم:** `SOURCE IMPLEMENTATION CANDIDATE — POSTGRESQL/NESTJS RUNTIME NOT VERIFIED`

**مرز فاز:** Booking Engine واقعی در سطح سورس اضافه شده است؛ Phase 08 آغاز نشده و هیچ Push به GitHub انجام نشده است. این نسخه **نه آمادهٔ Production** است و نه اثبات‌شده برای هم‌زمانی چند Replica.

## ۱. مبنا و حفظ تاریخچه
بستهٔ ورودی `BookCore-Phase-06-Session-Scheduling.zip` با CRC سالم باز شد. Manifest اصلی: **۲۷۳/۲۷۳ هش معتبر**. هفت Migration قبلی 001–007 با ورودی byte-for-byte برابرند؛ کدها و مستندات فازهای قبلی باقی مانده‌اند. تمام تغییرات در Workspace مستقل انجام شد.

## ۲. موارد پیاده‌سازی‌شده در سورس
- `BookingModule/Controller/Service/DTO/domain` واقعی و اتصال به `AppModule`، بدون ساخت پروژهٔ نامرتبط.
- POST رزرو مشتری از Token، همراه با Key الزامی، Session lock، بررسی `PUBLISHED` و ظرفیت، ممنوعیت رزرو مؤثر تکراری، Booking + Counter + BookingEvent + Audit + Outbox در یک UnitOfWork و بازگشت HTTP 201 پس از Commit تأییدشده.
- GET تاریخچهٔ خود کاربر با Tenant/User/AuthSession در Query نهایی و Cursor نزولی CreatedAt+ID.
- لغو شخصی با Cutoff سازمان؛ لغو کارکنان OWNER/MANAGER/RECEPTIONIST قبل از شروع با دلیل اجباری؛ کاهش ظرفیت دقیقاً یک‌بار؛ ثبات وضعیت‌های انتهایی.
- ثبت `ATTENDED`/`NO_SHOW` فقط برای Session تمام‌شده، توسط کارکنان مجاز یا مربی همان Trainer Resource؛ شمارنده بدون تغییر.
- Idempotency دارای Fingerprint کاننیکال، Scope Tenant/Actor/Operation/Key، Replay و ثبت رد کسب‌وکاری در تراکنش نهایی؛ COMMIT نامعلوم به‌جای ادعای Rollback به 503 و Retry همان Key منجر می‌شود.
- Rate Limit روی Actor/Operation در PostgreSQL، مستقل از IP مشترک NAT؛ Edge Rate Limit همچنان لازم است.
- Migration افزایشی `008_booking_permissions.sql`: مجوز INSERT رزرو، رویدادها، Outbox و Sequence `event_order` و UPDATE محدود وضعیت‌ها.

## ۳. ممیزی سخت‌گیرانه و اصلاحات واقعی
| شناسه | یافته | اصلاح |
|---|---|---|
| P07-R01 | کد قدیمی Booking Spike با ترتیب Session-first با مدیریتی Organization-first ناسازگار بود | مسیر اجرایی جدید Org `FOR SHARE` → AuthSession → Membership در Staff → Idempotency → Session → Booking؛ کد Spike قدیمی صرفاً Reference باقی ماند |
| P07-R02 | `@IsOptional()` شناسهٔ اتاق، مقدار `null` را نیز مجاز می‌کرد | به `@ValidateIf(value !== undefined)` و `@IsUUID()` تغییر کرد، Unit Test اضافه شد |
| P07-R03 | درخواست CreateSession بدون Idempotency در COMMIT نامعلوم قابل بازیابی قطعی نیست | در دفتر ریسک به‌عنوان OPEN ثبت شد؛ ادعای رفع یا تغییر غیرمجاز OpenAPI انجام نشد |
| P07-R04 | نقش runtime فاقد INSERT Booking و USAGE sequence بود | Migration 008 افزایشی؛ اجرایی‌شدن آن هنوز اثبات نشده |
| P07-R05 | اشتباه گرفتن `cancellation_cutoff_min` با مهلت ایجاد Booking | ایجاد رزرو تا پیش از start مجاز، Cutoff فقط برای لغو مشتری |
| P07-R06 | fingerprint وابسته به ترتیب کلیدهای JSON بود | JSON کاننیکال مرتب‌سازی شده، Pure Regression Test |
| P07-R07 | قفل انحصاری Organization برای ۱۰۰ رزرو همان Tenant همه درخواست‌ها را بی‌دلیل سریالی می‌کرد | در Booking از `FOR SHARE` سازمان برای حفظ ترتیب و هم‌زمانی مشتریان استفاده شد |
| P07-R08 | اعتبارسنجی مجوز Staff در شاخه لغو می‌توانست بعد از قفل Session انجام شود | Preflight در همان Transaction پیش از Claim/Session؛ Membership lock و Scope قابل بررسی |
| P07-R09 | Reason اختیاری حضور ممکن بود بدون ثبت پذیرفته شود | Reason در Audit متادیتا نوشته می‌شود، بدون شکستن قاعدهٔ Event بدون Reason |
| P07-R10 | خطای Worker و مسدودشدن stdout امکان باقی‌ماندن فرایند داشت | اتصال خروجی، Timeout و `Promise.allSettled` برای خاتمهٔ هر دو Process افزوده شد |

## ۴. محدودیت‌های آشکار و تصمیم‌های باز
1. **Staff on-behalf booking: PARTIAL / FAIL-CLOSED.** قرارداد Phase 01 اجازهٔ `customerId` در بدنه را می‌دهد، اما چون Consent/Mandate معتبر نداریم، درخواست در سورس با 403 `BOOKING_CONSENT_REQUIRED` رد می‌شود. این بخش کامل نیست و نباید با عنوان قابلیت عملیاتی معرفی شود.
2. **Unknown COMMIT / Idempotency:** UoW نتیجهٔ نامعلوم را با `UNKNOWN_COMMIT_OUTCOME` تفکیک می‌کند؛ بازیابی واقعی شبکه/PG آزمایش نشده است. Session Create فاز ۰۶ هنوز بدون Recovery مشخص است.
3. **Refresh lost-ACK**، رضایت Membership کارکنان، Proxy/RateLimit، SQL Triggerها، Drift، PostgreSQL Role Permissions، و همهٔ Gateهای باز فاز دوم باقی‌اند.
4. **تست تکمیلی لازم:** حضور پس از Finished با Trainer، Interleaving ابطال Membership/AuthSession، Fault Injection واقعی و Cross-Tenant SQL منفی باید در محیط PostgreSQL به ماتریس اضافه و اجرا شوند.

## ۵. شواهد واقعی اجرای کنترل‌ها
| کنترل | نتیجهٔ واقعی | شواهد |
|---|---|---|
| Pure Availability Phase05 | ۱۳ PASS، صفر FAIL | `evidence/phase07/test-availability-pure.log` |
| Pure Session Domain Phase06 | ۸ PASS، صفر FAIL | `test-session-domain-pure.log` |
| Pure Booking Domain Phase07 | ۵ PASS، صفر FAIL | `test-booking-domain-pure.log` |
| Original Package SHA256 + migrations 001–007 | ۲۷۳ هش و ۷ Migration برابر | `phase06_provenance.log` |
| TypeScript syntax only | ۷۱ فایل، صفر Parse Error | `typescript_syntax_scan.log` |
| YAML strict + duplicate keys + $ref + operations | PASS: ۴۲۳ ref، ۳۸ operation | `phase07_contract_check.log` |
| Source static, reference, ۸ checksum | PASS | سایر لاگ‌های `evidence/phase07` |
| Zero-test Runner regression | PASS | `runner_selftest.log` |
| npm lockfile | FAIL: `ENOTCACHED` | `npm_lock_attempt.log` |
| `npm ci` | FAIL: Lockfile وجود ندارد | `npm_ci_attempt.log` |
| Real Typecheck | FAIL: وابستگی و Typeهای واقعی نصب نیستند | `typecheck_attempt.log` |
| ESLint | FAIL: `eslint` نصب نیست | `lint_attempt.log` |
| Build | FAIL: وابستگی‌ها نصب نیستند | `build_attempt.log` |
| PostgreSQL/Migration 008/NestJS HTTP/دو Process | **۰ آزمون اجراشده؛ NOT VERIFIED** | محیط: PostgreSQL و Docker موجود نیستند |
| GitHub Actions | NOT VERIFIED | هیچ Workflow واقعی اجرا نشده |

**شمارنده‌ها:** ۲۶ آزمون Pure واقعاً اجرا شد؛ ۲۶ PASS، ۰ FAIL، ۰ SKIPPED. تعداد تست‌های دیتابیسی اجراشده: **۰**. تعداد اجرای تست HTTP/NestJS: **۰**. هیچ Benchmark ساختگی ثبت نشده است.

## ۶. Gateهای مستقل فاز هفتم
| Gate | موضوع | پیاده‌سازی | اعتبارسنجی |
|---|---|---|---|
| G1 | Booking Creation | IMPLEMENTED | NOT VERIFIED |
| G2 | Atomic Capacity Enforcement | IMPLEMENTED | NOT VERIFIED |
| G3 | Effective Booking Uniqueness | IMPLEMENTED | NOT VERIFIED |
| G4 | Idempotency | IMPLEMENTED | NOT VERIFIED |
| G5 | Customer Booking History | IMPLEMENTED | NOT VERIFIED |
| G6 | Customer Cancellation | IMPLEMENTED | NOT VERIFIED |
| G7 | Staff Cancellation | IMPLEMENTED | NOT VERIFIED |
| G8 | Attendance / No-show | IMPLEMENTED | NOT VERIFIED |
| G9 | Cross-operation Concurrency | PARTIAL | NOT VERIFIED |
| G10 | Tenant Authorization/Security/Consent | PARTIAL | NOT VERIFIED |
| G11 | Database/API Contract Integrity | PARTIAL | NOT VERIFIED |
| G12 | Tests/Reproducibility | PARTIAL | FAIL |

این Gateهای Source-level به معنی تأیید SQL یا HTTP نیستند. نصب وابستگی و Test Execution نهایی Release Blocker قطعی است.

## ۷. دستورات گام بعدی، بدون آغاز Phase08
در محیط مجاز با PostgreSQL 17 و دسترسی npm، ابتدا با `npm install --package-lock-only` یک Lockfile **واقعی** بسازید؛ سپس `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`، Migration 001–008 دوبار، `npm run test:unit`, `npm run test:integration` و Reconciliation را اجرا کنید. ظرفیت ۱/۲۰ با ۱۰۰ مشتری × سه تکرار و دو Process باید روی ردیف‌های Commitشده بررسی شود. اگر SQL یا Typecheck خطا داشت سورس اصلاح و همهٔ تست‌ها مجدداً اجرا شوند؛ CI تا تهیهٔ Lockfile قابل قبول نیست.

**حکم نهایی:** `SOURCE IMPLEMENTATION CANDIDATE — POSTGRESQL/NESTJS RUNTIME NOT VERIFIED`.
