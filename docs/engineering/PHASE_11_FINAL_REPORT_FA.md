# BookCore — Phase 11 Final Engineering Report (فارسی)

**فاز:** 11/16 — MVP Workflow Integration، API Contract Consolidation، Cross-Module Consistency  
**حکم:** `SOURCE INTEGRATION CANDIDATE — POSTGRESQL/NESTJS RUNTIME NOT VERIFIED`  
**مرز حکم:** ادامهٔ توسعه و آزمایش مجاز است؛ انتشار Production، تصدیق امنیت و ادعای صحت تراکنش‌های PostgreSQL مجاز نیست.

## ۱. ورودی و حفظ تاریخچه

مرجع کد `BookCore-Phase-10-Operational-Integrity.zip` است. ZIP اولیه قبل از تغییر استخراج شد؛ `scripts/verify-manifest.cjs` تمام **445/445** رکورد قبلی را تأیید کرد. گزارش ممیزی مستقل Phase10 نیز خوانده شد. تمام SQLهای `001` تا `011` در فاز یازدهم بدون هیچ تغییر بایتی حفظ شدند؛ تنها `012_integrity_inspection_paging.sql` اضافه شد. تاریخچهٔ فازهای قبلی، تست‌های قبلی و ADRها در خروجی باقی مانده‌اند.

## ۲. اصلاحات واقعی در سورس

- **R11-01:** در تابع جدید بازرسی، تاریخچهٔ Booking با `ORDER BY e.event_order ASC` و شمارش رویداد اولیه، اعتبارسنجی انتقال‌ها، پایان‌های `CANCELLED/ATTENDED/NO_SHOW`، تطبیق Reason و وضعیت پایانی ارزیابی می‌شود. به جای اصلاح تاریخی `011`، تابع نمونه‌ای قبلی در Migration `012` با Wrapper سازگار جایگزین شد و خروجی آن همچنان `completeScan:false` است. برای رکوردهای قدیمی‌تر از نصب Migration 004، Provenance با `HISTORICAL_ORDER_UNVERIFIED` نشان داده می‌شود، نه فساد قطعی.
- **R11-02:** `bookcore_inspect_tenant_page(...)` دارای Keyset روی شناسهٔ UUID و Event Type، شش مجموعهٔ `SESSION/BOOKING/OUTBOX/COUNTER/INVITATION/CONSENT`، Limit یک تا صد، Tenant و Operator Binding، و Watermark زمانی است. CLI جدید `operational-inspection-v2.ts` صفحه‌های کوتاه `BEGIN READ ONLY` را می‌خواند، Cursor امضاشدهٔ HMAC و محدودیت Workload دارد و Findings را بدون Repair خروجی می‌دهد. یک Snapshot سراسری بین Pageها وجود ندارد؛ `consistentSnapshot:false` و `certifiedIntegrity:false` عمداً هرگز مثبت نمی‌شوند.
- **R11-03:** تست‌های PostgreSQL منفی برای LOGIN بی‌Binding، Binding غیرفعال، User معلق، OWNER لغوشده، هویت نادرست Registry، GUC جعلی، تلاش SET ROLE، تداخل Tenant، دسترسی مستقیم به Audit و Trigger تغییرناپذیری Audit اضافه شد. Credential اشتراکی و Audit Provisioning همچنان نیازمند سیاست عملیاتی‌اند.
- **Integration:** ممیزی Composition و ۴۶ Controller Operation، گزارش ماشین‌خوان API، نقشهٔ هشت Workflow (A–H)، ماتریس Invariantها، مرزهای تراکنش و تست HTTP یکپارچهٔ ثبت‌نام تا Reporting/Outbox نوشته شد. همهٔ ۴۶ مسیر سورس از نظر Method/Path با ۴۶ عملیات طراحی یکسان‌اند؛ این معادل اجرای Route یا Dependency Injection در NestJS نیست.
- **Migration:** پنج ایندکس بر اساس `(tenant_id,id)` برای پیمایش محدود و Security Definer با `session_user` و گرانت محدود؛ Migration 012 فقط کاندیدای SQL است تا روی PostgreSQL واقعی اجرا شود.

## ۳. شواهد واقعاً اجراشده

| بررسی | نتیجه | محل شواهد |
|---|---|---|
| Manifest اصلی فاز دهم | PASS، 445/445 | خروجی `scripts/verify-manifest.cjs` در شروع |
| Testهای Pure فازهای 05–10 | PASS، 65/65 | `evidence/phase11/command_results.log` |
| تست‌های Pure فاز 11 | PASS، 11/11 | همان لاگ |
| همهٔ تست‌های Pure | **PASS، 76/76** | همان لاگ |
| بررسی Static قدیمی + فاز جدید | PASS | `npm run verify:static` |
| SHA-256 Migrationهای 001–012 | PASS، 12/12 | `scripts/verify-migration-checksums.cjs` |
| AST TypeScript و relative imports | PASS، 104 فایل | `tools/phase09_syntax_check.cjs` |
| OpenAPI design YAML | PASS، 46 عملیات / 507 ارجاع | `tools/phase09_validate_openapi.py` |
| Controller inventory | PASS، 46/46 Method/Path و صفر تکرار | `docs/integration/API_IMPLEMENTATION_MATRIX.json` |
| نصب تمیز با `npm ci --offline` | FAIL، Lockfile وجود ندارد | لاگ دستورها |
| دسترسی npm Registry | FAIL، `EAI_AGAIN` | لاگ دستورها |
| Typecheck / Build / ESLint | FAIL، Dependency/Types نصب نشده | لاگ دستورها |
| NestJS Unit/HTTP و PG17 Integration | NOT VERIFIED؛ تست‌ها در این محیط اجرا نشدند | لاگ `test:unit` و `test:integration` |
| Migration SQL روی PostgreSQL17 و اجرای CI | NOT VERIFIED | PostgreSQL/Docker/اجازهٔ اجرای GitHub Actions فراهم نبود |

**یادآوری:** عبور AST، Hash و Pure Unit به‌معنی تأیید تعاریف Decorator، Constraint، SQL Trigger یا اقلام API در Runtime نیست. حتی اجرای Mock بدون دیتابیس، تضمین هم‌زمانی نیست.

## ۴. ماتریس Gateها

| Gate | دامنه | Implementation | Verification |
|---|---|---|---|
| G1 | تعمیرات Phase10 و EventOrder | IMPLEMENTED | NOT VERIFIED (PG) |
| G2 | Composition | IMPLEMENTED در سورس | NOT VERIFIED (Nest runtime) |
| G3 | کامل‌شدن هشت جریان MVP | PARTIAL (E2E source موجود) | NOT VERIFIED |
| G4 | فهرست API و یکسان‌سازی قرارداد | PARTIAL (46/46 Static، Generated OpenAPI اجرا نشده) | NOT VERIFIED (HTTP) |
| G5 | یکپارچگی دامنه و قفل | PARTIAL | NOT VERIFIED |
| G6 | Booking و Session Lifecycle | PARTIAL | NOT VERIFIED |
| G7 | Identity، Governance و Consent | PARTIAL | NOT VERIFIED |
| G8 | Reporting، Outbox و پردازش | PARTIAL | NOT VERIFIED |
| G9 | کنترل دسترسی Tenant و Operator | PARTIAL | NOT VERIFIED |
| G10 | بازرسی جامعِ محدود | PARTIAL (۶ نوع Keyset؛ Snapshot بین‌صفحه‌ای و Audit جامع نداریم) | NOT VERIFIED (PG) |
| G11 | حفظ Schema و DB Invariants | PARTIAL (Migration جدید اجرا نشده) | NOT VERIFIED |
| G12 | تست و بازتولیدپذیری | PARTIAL | FAIL (npm/Lockfile) |

## ۵. ریسک‌ها و وظایف باقی‌مانده

۱. تست ۱۰۰ درخواست ظرفیت ۱/۲۰ در سه تکرار با دو فرایند واقعی و PostgreSQL17؛ قفل‌ها، Deadlock، ماندگاری رکوردها و Rollback باید مشاهده شوند.  
۲. اجرای واقعی Migration 012 روی دیتابیس خالی و دیتابیس با دادهٔ قدیمی، اعتبار EventOrder و مجوز `SECURITY DEFINER`/`session_user` همراه با آزمون نقش‌های منفی.  
۳. Snapshot بین صفحات عمداً واحد نیست. Watermark جلوی درج عادی پس از زمان آغاز را می‌گیرد، ولی تغییر وضعیت رکوردهای قدیمی ممکن است در Pageهای بعد دیده شود. این خروجی **پوشش Keyset** است، نه Audit Certified.  
۴. تطبیق Missing Outbox business events، ارتباط‌دادن تمام Aggregateها و Audit مستقل Provisioning هویت اپراتورها ناقص است.  
۵. Retention کلیدهای Idempotency همچنان بدون حذف خودکار؛ Unknown COMMIT برای Refresh/Session و دسترسی Delivery خارجی همچنان معوق‌اند.  
۶. تعریف‌های تست PostgreSQL/NestJS برای Workflows جدید نوشته شده‌اند ولی هنوز اجرا نشده‌اند.  
۷. Lockfile واقعی، `npm ci`, Typecheck، Lint، Build، Swagger اجرایی، Multi-worker Outbox و اجرای واقعی GitHub Actions الزامی و همگی باز هستند.

## ۶. اقلام خروجی

- `BookCore-Phase-11-MVP-Integration.zip` با سورس فازهای قبل، Migrationهای 001–012، تست‌های Pure/Integration/HTTP، Docker/CI، مستندات، ADR031، دفتر تست‌های معوق و Manifest SHA-256.
- `PHASE_11_FINAL_REPORT_FA.md` همان متن گزارش موجود در ZIP، جداگانه قابل دریافت.
- `evidence/phase11/command_results.log` و `docs/integration/API_IMPLEMENTATION_MATRIX.json` برای بازبینی مستقل.

**مرز اجرا:** فاز ۱۲ آغاز نشده، پرداخت/Waitlist/Frontend اضافه نشده و هیچ Push یا اجرای GitHub Actions بدون مجوز انجام نشده است.
