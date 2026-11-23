# BookCore — گزارش ممیزی مستقل سورس فاز ۱۳

**تاریخ ممیزی:** ۲۰۲۶-۱۱-۲۳  
**ورودی‌ها:** `BookCore-Phase-13-Observability-Performance(1).zip` و `PHASE_13_FINAL_REPORT_FA(1).md`  
**حکم:** `CONDITIONAL SOURCE GO FOR PHASE 14 — RUNTIME / PRODUCTION NO-GO`

## ۱. روش

ZIP به‌صورت مستقل و با کنترل مسیرهای نامعتبر و CRC استخراج شد؛ `MANIFEST.md` با فایل‌های واقعی سنجیده شد. گزارش جداگانه با `docs/engineering/PHASE_13_FINAL_REPORT_FA.md` مقایسهٔ بایتی شد. SQLهای ۰۰۱–۰۱۲ با سورس آرشیو اصلی فاز ۱۲ مقایسه شدند. اسکریپت‌های Pure، کنترل‌های استاتیک، OpenAPI، Syntax و Reference مستقلاً اجرا شدند. سپس کدهای واقعی `bootstrap.ts`، `app.module.ts`، `common/observability`، `DatabaseService`، `UnitOfWork`، `HealthController`، `scripts/recovery`، تست Booking PostgreSQL، Docker و CI بررسی شدند.

## ۲. نتایج واقعی

| کنترل | مشاهدهٔ مستقل |
|---|---|
| CRC ZIP | PASS |
| Manifest نهایی | PASS، ۵۴۵ فایل/هش صحیح؛ Manifest خودش در شمارش نیست |
| مطابقت گزارش مستقل و گزارش در ZIP | PASS، بایت‌به‌بایت |
| Migrationهای ۰۰۱–۰۱۲ نسبت به ZIP فاز ۱۲ | PASS؛ هیچ تغییری دیده نشد |
| Pure suites Phase 05–13 | PASS، ۱۰۳ تست در ۹ مجموعه (۱۳+۸+۶+۲۴+۶+۸+۱۲+۱۰+۱۶) |
| مرجع Phase02 و بررسی‌های Static | PASS |
| OpenAPI | PASS، ۴۶ operationId یکتا و ۵۰۷ مرجع محلی معتبر |
| Syntax و relative imports | PASS، ۱۱۲ فایل TypeScript؛ Typecheck کامل نیست |
| `npm ci --offline` | FAIL؛ نبود `package-lock.json` |
| `npm run typecheck` | FAIL؛ وابستگی و Type declarations واقعی موجود نیستند |
| NestJS، HTTP و PostgreSQL | NOT VERIFIED؛ ۰ تست اجرایی |
| Backup/Restore/age/PITR واقعی | NOT VERIFIED |
| Load test واقعی ۱۰۰ درخواست × دو فرایند × ۳ تکرار | NOT VERIFIED |
| CI واقعی | NOT VERIFIED |

## ۳. یافته‌های سورسی مستقل

### P1 — Restore در حالت Execute می‌تواند ابزار را از PATH غیرپین‌شده بگیرد

**شواهد:** `scripts/recovery/policy.cjs:29–38,75–86` و `scripts/recovery/restore.cjs:16–21,37–45`.

`restorePolicy()` اجرای Restore را تنها در `development/test` می‌پذیرد؛ اما `tool()` اجبار به مسیر مطلق/کنترل مجوز فایل را فقط برای `BOOKCORE_ENVIRONMENT=production` اعمال می‌کند. بنابراین در **همان محیطی که `execute=true` مجاز است**، `tool('pg_restore',env)` می‌تواند رشتهٔ `pg_restore` را برگرداند تا از PATH انتخاب شود. بازتولید مستقل این ناسازگاری با `restorePolicy(...,true) === true` و `tool(...) === 'pg_restore'` انجام شد. این اثبات سوءاستفاده نیست؛ اما برای ابزار بازیابی دارای اختیار نوشتن دیتابیس، نقص در مرز اعتماد به Executable است.

**اصلاح:** همهٔ اجرای مخرب Restore و Verifier عملیاتی باید مستقل از نام Environment، از مسیرهای مطلق پین‌شده با مالکیت/مجوز امن استفاده کنند؛ برای تست‌های Mock مسیرهای صریح fixture مورد استفاده قرار گیرد. رفتار `--execute` و حق اجرای ابزارها تحت تست منفی قرار گیرد.

### P1 — Harness هم‌زمانی می‌تواند خطاهای ۵xx را موفقیت تلقی کند

**شواهد:** `apps/api/test/integration/booking-postgres.test.ts:110–115,130–137`.

در آزمون ظرفیت ۱ یا ۲۰، فقط `successes === capacity` و `non201 === 100-capacity` کنترل می‌شود. بنابراین از دید این شرط‌ها، حالتی مانند یک `201` و ۹۹ پاسخ `503` برای ظرفیت ۱ هم پذیرفته می‌شود؛ در حالی‌که چنین حالتی نشانهٔ خطای زیرساخت/فشار است نه رد صحیح `SESSION_FULL`. همین منطق برای ظرفیت ۲۰ نیز برقرار است. این نقصِ واقعی در منطق آزمون است، نه تأیید وقوع 503 در PostgreSQL.

**اصلاح:** Status/Error Codeهای مجاز را صریحاً بررسی کنید؛ هر 5xx، Timeout، Retry-budget exhaustion، خطای Worker و پاسخ غیرمنتظره باید Gate عملکرد را FAIL کند. Final persisted-state و Event/Outbox counters همچنان الزامی‌اند. `p50/p95/p99` و Deadlock/Lock Wait واقعی را فقط از اجرای واقعی گزارش کنید.

### P2 — مجوز فایل خصوصی age در Verifier صریح بررسی نمی‌شود

**شواهد:** `scripts/recovery/verify-backup.cjs:15–19` و `scripts/recovery/restore.cjs:37–41`.

وجود `BOOKCORE_AGE_IDENTITY_FILE` بررسی شده، ولی قبل از استفاده از کلید خصوصی `age`، `safeFile()` یا کنترل معادل برای permission/مالکیت/عدم Symlink به آن اعمال نمی‌شود. این کنترل برای پیاده‌سازی اصل جداسازی Producer و Recovery و کاهش افشای کلید توصیه می‌شود. مستندات و تست‌ها باید عدم وجود کلید در Producer و محدودیت دسترسی در Verifier را جداگانه اثبات کنند.

### P2 — سیاست دسترسی به فایل CA بیش از حد سخت‌گیرانه است

**شواهد:** `scripts/recovery/policy.cjs:18–20,47–51`.

برای TLS از `safeFile(PGSSLROOTCERT)` استفاده می‌شود که مجوز گروه/سایرین را ممنوع می‌کند؛ یک CA عمومی با مجوز رایج `0644` و با `PGSSLMODE=verify-full` پیش از اتصال رد شد (`PRIVATE_FILE_PERMISSIONS_REQUIRED`). CA عمومی کلید خصوصی نیست. از یک Validator متناسب با **CA قابل اعتماد** استفاده کنید؛ عدم Symlink ناامن، مالکیت/دسترسی معتبر و محتوا/زنجیرهٔ TLS را بدون الزام نادرست 0600 مدیریت کنید.

### ریسک‌های تأییدنشده یا آگاهانه محدود

- Metrics endpoint به‌صورت سورسی تحت `MonitorGuard` و allowlist IP مستقیم است؛ اما رفتار در Docker/Ingress/Proxy و واقعی بودن IP Collector آزمایش نشده.
- HTTP Metrics در هر Replica درون‌فرایندی‌اند؛ Outbox Worker به Prometheus API متصل نیست. گزارش کامل Metrics چند Worker نباید داده شود.
- `MetricsRegistry` cardinality را محدود می‌کند و `JsonLogger.event` از allowlist استفاده می‌کند؛ اما کامل‌بودن پوشش SQL query tracing، کاربرد API کامل و مسیردهی Log در Runtime تأیید نشده.
- Restore همچنان با preflight چندمرحله‌ای و بدون ایزولاسیون قوی خارجی اجرا می‌شود؛ بررسی یک‌لحظه‌ای sessionها جایگزین Isolation نیست.
- تولید Lockfile واقعی و تکرارپذیری Docker/CI همچنان Release Blocker است.

## ۴. نقاط مثبت ساختاری

- `ObservabilityModule` واقعاً در `AppModule` درج شده؛ مسیر خصوصی Metrics در سورس وجود دارد.
- اندازه‌گیری HTTP، Db Pool و UnitOfWork به کد اجرایی متصل است و دادهٔ نمایشی نیست.
- Guard سراسری `APP_GUARD` حفظ شده و مسیر Metrics به گارد مانیتورینگ اختصاصی ارجاع دارد.
- Backup Producer رمز‌شده به age Recipient عمومی وابسته شده و از Verifier دارای کلید خصوصی جداست.
- Restore قبل از اجرای عملی، `session_user`، مقصد و نسخهٔ PostgreSQL را در مسیر اجرایی بررسی می‌کند؛ اثبات این کنترل‌ها روی سرور واقعی معوق است.
- تست‌های Pure/Mock نتایج درست را بازمی‌گردانند و خطای صفر تست را پنهان نمی‌کنند.

## ۵. تصمیم ادامه

برای **توسعه سورس در فاز ۱۴**: GO مشروط. برای Production/Pilot با دادهٔ واقعی: **NO-GO**. آغاز فاز ۱۴ باید اصلاحات P1 بالا و تأمین محیط اجرایی Node22/npm/PostgreSQL17 را اولویت دهد. پس از ۱۳ فاز بدون نصب تمیز و PostgreSQL واقعی، صرفاً افزودن ماژول‌های تازه کافی نیست؛ فاز ۱۴ باید Clean Build، اجرای Migrationها و تست‌های End-to-End را به‌عنوان اهداف اصلی پیگیری کند و اگر محیط در دسترس نبود، نتیجه را `BLOCKED/NOT VERIFIED` ثبت کند نه PASS.
