# BookCore — ممیزی مستقل سورس و تحویل فاز ۱۰

**تاریخ بررسی:** ۲۰۲۶-۱۱-۲۳  
**ورودی:** `BookCore-Phase-10-Operational-Integrity(1).zip` و `PHASE_10_FINAL_REPORT_FA(1).md`  
**حکم:** `CONDITIONAL SOURCE-LEVEL GO FOR PHASE 11 — RUNTIME NOT VERIFIED`  
**مرز حکم:** مجوز ادامه توسعه سورس؛ نه گواهی صحت PostgreSQL، امنیت عملیاتی یا آمادگی Production.

## ۱. شواهدی که خودمان بازتولید کردیم

- تست CRC کل ZIP: PASS؛ ۴۴۶ عضو ZIP شامل یک Manifest و ۴۴۵ فایل پروژه.
- `node scripts/verify-manifest.cjs`: PASS؛ **۴۴۵/۴۴۵** فایل به لحاظ اندازه، SHA-256 و Inventory منطبق‌اند.
- گزارش جداگانه و `docs/engineering/PHASE_10_FINAL_REPORT_FA.md` داخل ZIP کاملاً بایت‌به‌بایت یکسان‌اند.
- Migrationهای ۰۰۱ تا ۰۱۰ در ZIP فاز ۱۰، در مقایسه مستقیم با ZIP فاز ۹، **۱۰/۱۰ بدون تغییر بایتی** مانده‌اند؛ `011_operational_integrity.sql` اضافه شده است.
- `npm run verify:reference`: PASS؛ `npm run verify:static`: PASS؛ `node scripts/verify-migration-checksums.cjs`: PASS برای ۱۱ Migration.
- تست‌های Pure مستقل اجرا شدند: Availability=۱۳، Session=۸، Booking=۶، Phase08=۲۴، Phase09=۶، Phase10=۸؛ جمع **۶۵ PASS، صفر FAIL**.
- `python tools/phase09_validate_openapi.py`: PASS برای ۴۶ operationId و ۵۰۷ ارجاع داخلی.
- `node tools/phase09_syntax_check.cjs`: PASS برای Parse و relative imports در ۹۹ فایل TypeScript. **این Typecheck کامل نیست.**
- فایل `package-lock.json` در بسته وجود ندارد؛ `npm ci` از استخراج تمیز به Lockfile وابسته است. PostgreSQL/Docker و Build با وابستگی واقعی در این ممیزی اجرا نشدند. هیچ تست واقعی SQL یا HTTP را PASS فرض نکردیم.

## ۲. تطبیق واقعی کدهای تحویلی با گزارش

**واقعاً در سورس موجود است:** `scripts/operational-integrity.ts` با تراکنش `BEGIN READ ONLY` و حساب Inspector جدا؛ `scripts/lifecycle-maintenance.ts` با اعمال محدودیت Batch، سن و Reason؛ `scripts/outbox-recovery.ts` بدون Actor UUID از CLI؛ `modules/operations/operations.domain.ts` با ممنوعیت پاک‌سازی Idempotency؛ Migration 011 با نگاشت `session_user` به Operator Registry، Restrict شده بودن تابع Legacy، توابع محدود Inspection/Requeue/Cleanup و جدول Audit تعمیرناپذیر؛ فایل Integration `phase10-postgres.test.ts`؛ CI فاز دهم.

**واقعاً محدود یا معوق است:** Inspector فقط حداکثر ۱۰۰ Session و ۱۰۰ Booking اول را می‌بیند (`completeScan:false`)؛ Maintenance فقط Bucketهای Rate Limit را حذف می‌کند؛ Idempotency retention پاک‌سازی ندارد؛ نقش‌های عملیاتی و Migration 011 روی PostgreSQL تست نشده‌اند؛ Workflow CI اجرا نشده است.

## ۳. یافته‌های مستقل

### P1 — ترتیب اشتباه رویداد نهایی در Inspector

`db/migrations/011_operational_integrity.sql` حوالی خطوط ۱۱۹ تا ۱۲۶، آخرین وضعیت Booking را با `ORDER BY e.at DESC,e.id DESC LIMIT 1` تعیین می‌کند. اما `db/migrations/004_history_consistency.sql` صراحتاً `event_order` را ترتیب منطقی مرجع معرفی کرده است (خطوط ۵ تا ۱۳). ترتیب `at,id` تضمین نمی‌کند همان رویدادی را انتخاب کند که بیشترین `event_order` را دارد. در Timestampهای برابر، UUID ممکن است رویداد قبلی را «آخرین» نشان دهد؛ این می‌تواند `BOOKING_EVENT_CHAIN` کاذب یا عدم شناسایی ناسازگاری بسازد.

**اصلاح اجباری:** به‌جای `ORDER BY e.at DESC,e.id DESC` از ترتیب مرجع `event_order DESC` استفاده شود؛ بررسی کامل زنجیره `from_status`/`to_status` در نمونه‌ها انجام و تست رگرسیون برای Timestamp برابر و UUID با ترتیب معکوس نوشته شود. چون Migration 011 هنوز در محیط واقعی اجرا نشده ولی باید immutable فرض شود، اصلاح با Migration 012 افزایشی باشد، نه ویرایش تاریخچه.

### P1 — ابزار تشخیص فقط «نمونه» است و مسیر پیمایش کامل ندارد

`bookcore_inspect_tenant` در همان Migration با `ORDER BY ... LIMIT p_limit` فقط اولین صفحه ثابت را می‌بیند. بدون Cursor و چرخه پیمایش، ۱۰۱مین Session یا Booking اصلاً با اجرای تکراری دستور بررسی نمی‌شود. گزارش `completeScan:false` این محدودیت را صادقانه بیان کرده؛ بنابراین این نقص **ادعای Product-wide reconciliation** را غیرقابل قبول می‌کند، نه هدف نمونه‌گیری محدود فاز ۱۰ را.

**اقدام:** افزودن پیمایش Keyset پایدار و snapshot/consistency policy با محدودیت منابع و گزارش Coverage؛ تا آن زمان هر خروجی فقط SAMPLE INSPECTION تلقی شود.

### P1 — ماتریس منفی هویت عملیاتی ناکافی است

تست `phase10-postgres.test.ts` بازیابی موفق با Operator ثبت‌شده و نفی دسترسی یک سازمان نامرتبط به Inspector را در سورس دارد؛ اما حالت‌های `SET ROLE`، Login بدون Binding، Binding غیرفعال، نگاشت Operator به User اشتباه، حساب اشتراکی، Cross-Tenant Requeue و نقش‌های ناهمخوان را به‌صورت مستقل آزمایش نمی‌کند. این موضوع **حفره پوشش تست** است؛ بهره‌برداری عملی اثبات نشده.

**اقدام:** منفی‌ها با Loginهای PostgreSQL واقعی و نقش‌های جداگانه نوشته و در فاز آزمایش نهایی اجرا شوند. تغییر Registry باید منحصراً با DBA مجاز، همراه با ثبت رویداد و فرآیند تأیید و ردیابی باشد.

### P1 — بازتولیدپذیری همچنان مسدود است

`package-lock.json` واقعی وجود ندارد؛ اجرای `npm ci`, Typecheck، ESLint، Build، PostgreSQL 17، Migration و GitHub Actions مشاهده نشده است. در نتیجه هیچ تضمین صحت Runtime برای امنیت SECURITY DEFINER، Triggerهای قدیمی، قفل و تراکنش ارائه نمی‌شود. این مانع انتشار است، نه لزوماً مانع کدنویسی طبق تصمیم کارفرما.

### P2 — مدیریت Retention و پوشش تاریخی ناقص

حذف Idempotency عمداً ممنوع است و ممکن است به رشد داده منجر شود؛ بررسی Audit/Outbox نیز نمونه‌ای است و Missing eventها را جامع کنترل نمی‌کند. تصمیم retention و طراحی ممیزی کامل با حفظ History باید در مراحل بعد بسته شود.

## ۴. تصمیم مستقل

- **پیشرفت سورس:** قابل قبول برای ادامه به Phase 11، مشروط به اینکه مشکلات P1 نخستین وظیفه آن مرحله باشند.
- **گواهی امنیت / PostgreSQL / Release:** `NO-GO / NOT VERIFIED`.
- **پیشنهاد اولویت فاز ۱۱:** یکپارچه‌سازی قراردادها و جریان‌های MVP، اصلاح Inspector، کامل‌کردن پوشش منفی Role/Operator، و ایجاد آزمون‌های Cross-Module در سورس؛ سپس اجرای جامع همه تست‌های واقعی در مرحله نهایی طبق سیاست کارفرما.

**هشدار:** موفقیت ۶۵ تست Pure به معنی موفقیت تست‌های NestJS و PostgreSQL یا آزمون هم‌زمانی ۱۰۰ درخواست نیست.
