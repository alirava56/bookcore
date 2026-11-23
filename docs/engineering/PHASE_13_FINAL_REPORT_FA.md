# BookCore — گزارش نهایی مهندسی فاز ۱۳ (فارسی)

**حکم نهایی:** `SOURCE IMPLEMENTATION CANDIDATE — OBSERVABILITY/RECOVERY RUNTIME NOT VERIFIED`.

## ۱. مبنا و روش کار

سورس رسمی فاز ۱۲ از `BookCore-Phase-12-Data-Protection-Recovery.zip` استخراج شد و ورودی `496/496` Manifest، CRC و فایل‌های واقعی بررسی شدند. گزارش `PHASE_12_FINAL_REPORT_FA.md` و ممیزی مستقل `BookCore_Phase12_Independent_Source_Audit_FA.md` با کدهای Recovery، NestJS و Worker تطبیق داده شدند. تغییرات بر همان مخزن اعمال شد؛ مخزن جداگانه ساخته نشد. Migrationهای ۰۰۱ تا ۰۱۲ بدون تغییر نگه داشته شدند. به دلیل نبود Plan دیتابیسی، ۰۱۳ ساخته نشد.

## ۲. اصلاحات امنیتی موروثی

- **R13-01:** `restorePolicy()` وجود `BOOKCORE_RESTORE_ALLOWED_LOGIN` و انطباق آن با PGUSER را الزامی می‌کند؛ در حالت Execute، `session_user`، `current_database()` و `server_version_num` از PostgreSQL مقصد واقعاً استعلام می‌شود و هویت ناشناس رد می‌گردد. از Env تنها به‌عنوان Claim اولیه استفاده می‌شود.
- **R13-02:** `pg_dump` و `pg_restore` Client Major 17 بررسی می‌شوند؛ از مبدأ `SHOW server_version_num` و نام دیتابیس خوانده می‌شود؛ Restore نسخهٔ سرور مقصد 17 و Database Identity را بررسی می‌کند. Server واقعی در این محیط اجرا نشده است.
- **R13-03:** Producer رمز‌شده فقط age Recipient عمومی می‌خواهد؛ Private Identity فقط در Recovery Verifier است. خروجی Producer صریحاً `DECRYPTION_UNVERIFIED` است.
- **R13-04:** remote TCP به `PGSSLMODE=verify-full` و CA معتبر نیاز دارد، و Override فریبندۀ `PGHOSTADDR` مسدود است. Local Socket/Loopback طبق سیاست محلی جداگانه بررسی می‌شود.
- **R13-05:** اجرای Restore نیازمند اعلام نمونهٔ ایزوله، مقصد Allowlist، نشانگر Disposable، عدم Session رقیب در Preflight، Login و نسخهٔ صحیح و هش Manifest از Trust Store مستقل است. **بررسی لحظه‌ای Sessionها قفل کامل علیه نویسندهٔ آینده نیست**؛ کنترل Network/Host خارج از Source، مسدودکنندهٔ Release باقی می‌ماند.
- **R13-06:** تست Source Mock برای مسیر Execute مثبت، شکست Ledger و Login جعلی نوشته و اجرا شد. **Restore حقیقی هنوز انجام نشده است.**
- **R13-07:** در محیط Production مسیرهای مطلق Executable، عدم Symlink و ممنوعیت Write گروه/عموم اعمال می‌شود. SHA فایل و Manifest بدون Trust خارجی، اثبات Authenticity نیست.

## ۳. پیاده‌سازی Observability و Performance

- `ObservabilityModule` همراه با `MetricsService` و `LifecycleState` در AppModule ثبت شد. مسیر `GET /api/v1/internal/metrics` فقط با MonitorGuard و Allowlist مستقیم/IP/Key در دسترس است؛ در OpenAPI عمومی طراحی نمایش داده نمی‌شود.
- HTTP شمارش پاسخ و Histogram تا پایان درخواست، شمارندهٔ درخواست‌های فعال و برچسب ثابت Template Route/Status Class دارند. تعداد سری‌ها محدود می‌شود؛ UUID و PII برچسب نمی‌شوند.
- Database Pool (`total`, `idle`, `waiting`)، مدت اخذ اتصال، مدت تراکنش، Retry و Unknown Commit شمارش می‌شوند. Query-level tracing روی همهٔ مسیرهای SQL **پیاده‌سازی نشده است**.
- `JsonLogger.event()` پیش از Serialize، فقط فیلدهای Allowlist را نگه می‌دارد و Token، Payload مشتری و Secret را حذف می‌کند.
- Middleware قبل از Controller با سقف `MAX_INFLIGHT_REQUESTS` فشار اضافی را با `503 SERVER_OVERLOADED` و `Retry-After: 1` رد می‌کند؛ درخواست ردشده وارد تراکنش نمی‌شود. محدودیت per-Replica است.
- `LifecycleState` در Shutdown، Readiness را از مدار خارج می‌کند؛ Liveness همچنان ارزان و مستقل از PostgreSQL است.
- Outbox Tick، Lease Lost و Backlog با شمارش‌های استخراج‌شده از دیتابیس یا رخداد Tick گزارش می‌شوند؛ Internal processing با External delivery یکی فرض نمی‌شود.
- Harness موروثی PostgreSQL 100×2×3 گسترش یافت تا توزیع Status، `p50/p95/p99` و شمارش نهایی Event/Outbox/Booking و Duplicate را فقط پس از اجرای واقعی ثبت کند. در این محیط اجرا نشده است.
- Ruleهای اولیهٔ هشدار در `infra/observability/prometheus-alerts.yml` و Runbook مرتبط نوشته شدند. این Thresholdها **پیشنهادی‌اند و baseline عملی اندازه‌گیری نشده** است.

## ۴. کنترل‌هایی که واقعاً اجرا شده‌اند

| فرمان یا مجموعه | نتیجه | مدرک |
|---|---|---|
| Nine Pure/Mock suites (Phase05–13) | **103 PASS / 0 FAIL**؛ Availability=13 و بقیه TAP | `evidence/phase13/pure_*.log` |
| Phase13 Recovery + Metrics Pure/Mock | **16 PASS / 0 FAIL**؛ جزو ۱۰۳ تست فوق | `pure_phase13.log` |
| Typecheck مستقل فایل `metrics.domain.ts` | PASS با TypeScript global؛ Typecheck کل برنامه نیست | `pure_ts_typecheck.log` |
| Manifest Phase12 source | PASS؛ ۴۹۶ فایل پیش از تغییر | بررسی ورودی |
| `npm run verify:reference`, `npm run verify:static` | PASS | `reference.log`, `static.log` |
| OpenAPI Strict YAML و ۴۶ عملیات/۵۰۷ `$ref` | PASS (static) | `openapi.log` |
| TypeScript AST + local relative imports | PASS، ۱۱۲ فایل (parse only) | `syntax.log` |
| Checksum ۱۲ Migration | PASS | `static.log` |
| تلاش واقعی تولید Lockfile با Offline npm | FAIL `ENOTCACHED` | `npm_lockfile_attempt.log` |
| `npm ci` | FAIL؛ Lockfile وجود ندارد | `npm_ci.log` |
| Full `npm run typecheck` / `build` | FAIL؛ npm Type Packages در دسترس نیست | `full_typecheck.log`, `build.log` |
| `npm run lint` | FAIL؛ ESLint نصب نیست | `lint.log` |
| NestJS Unit/HTTP/PG Integration | NOT VERIFIED؛ نصب وابستگی و DB نداریم | `unit_nestjs.log`, `integration_postgres.log` |
| Docker/pg_dump/pg_restore/age/PITR | NOT VERIFIED؛ ابزار حاضر نیست | `runtime_tools.json` |
| CI واقعی در GitHub | NOT VERIFIED؛ فقط YAML نوشته شد | `.github/workflows/backend-phase13.yml` |

تست‌های Pure با مقادیر مصنوعی/Mock، اجرای DB/HTTP را شبیه‌سازی می‌کنند و هیچ Gate امنیتی یا دیتابیسی را PASS واقعی نمی‌کنند.

## ۵. وضعیت Gateهای فاز ۱۳

| Gate | موضوع | Implementation | Verification |
|---|---|---|---|
| G1 | رفع نقص‌های امنیتی Phase12 | PARTIAL | NOT VERIFIED |
| G2 | Backup/Restore و تفکیک اعتماد | PARTIAL | NOT VERIFIED |
| G3 | Metrics خصوصی و دارای محدودیت Cardinality | IMPLEMENTED | NOT VERIFIED |
| G4 | Logging و حذف داده حساس | IMPLEMENTED | NOT VERIFIED |
| G5 | Database Pool Monitoring | IMPLEMENTED | NOT VERIFIED |
| G6 | HTTP Timing Visibility | IMPLEMENTED | NOT VERIFIED |
| G7 | Booking Concurrency Harness | IMPLEMENTED | NOT VERIFIED |
| G8 | Overload Admission/Backpressure | IMPLEMENTED | NOT VERIFIED |
| G9 | Health/Readiness/Draining | IMPLEMENTED | NOT VERIFIED |
| G10 | Outbox Reliability Monitoring | PARTIAL | NOT VERIFIED |
| G11 | Operational Alerting | PARTIAL | NOT VERIFIED |
| G12 | Authorization/Tenant Isolation | PARTIAL | NOT VERIFIED |
| G13 | Database/API Compatibility | PARTIAL | NOT VERIFIED |
| G14 | Tests/Reproducibility | PARTIAL | FAIL |

## ۶. یافته‌های ممیزی خصمانه و موارد باز

1. جداسازی کلید age اصلاح شده ولی رمزگشایی و Restore روی دو Host مستقل با `age` واقعی ثابت نشده است.
2. اصل Trust Root Manifest وابسته به دریافت SHA معتبر از منبع جداست؛ تزریق دست‌ساز همان متغیر اعتبار cryptographic ندارد و باید از Secrets/Immutable Store دارای کنترل دسترسی تأمین شود.
3. Preflight Restore در چند فرمان SQL اجرا می‌شود و Race بین آن و شروع `pg_restore` بدون ایزولاسیون شبکهٔ واقعی قابل حذف نیست؛ Restore روی Host مشترک مجاز نیست.
4. در Docker Compose، IP مشاهده‌شدهٔ Collector ممکن است IP Bridge باشد؛ باید Allowlist مستقیم متناسب با محیط و محدودیت Ingress جداگانه آزمایش شود، نه اعتماد به X-Forwarded-For.
5. Instrumentation Query عمومی و Exemplar/Tracing کامل هنوز پیاده‌سازی نشده‌اند. Metrics Worker به Prometheus API همان فرایند متصل نیست؛ Worker JSON Diagnostic مستقل دارد.
6. هرچند Harness دو Process موجود است، اثبات 100 درخواست در ظرفیت ۱ و ۲۰، سه تکرار، رقابت Capacity/Cancel، Lock Wait، Outbox Fencing و Debugِ PostgreSQL همچنان `NOT VERIFIED` است.
7. بدون Lockfile واقعی، `npm ci`, Build, Jest/Nest test و GitHub Actions Fail-Closed می‌مانند. YAML معتبر اجرای CI نیست.
8. Release قبل از بازیابی واقعیِ دادهٔ مصنوعی، بازآفرینی PostgreSQL 17، آزمون TLS/ACL و مرور Security مستقل مجاز نیست.

## ۷. حکم و مرز فاز

**`SOURCE IMPLEMENTATION CANDIDATE — OBSERVABILITY/RECOVERY RUNTIME NOT VERIFIED`**

Source و Unit/Mock قابل‌اجرا تولید شدند، اما صحت کارایی/امنیت زیر بار در PostgreSQL واقعی و بازیابی Backup اثبات نشده‌اند. `NO-GO FOR PRODUCTION`. فاز چهاردهم آغاز نشده، GitHub Push و Deploy انجام نشده است. ادامهٔ کار فقط مطابق Deferred Test Register و اجرای Release Gateهای واقعی مجاز است.
