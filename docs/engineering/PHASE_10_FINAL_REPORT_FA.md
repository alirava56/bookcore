# BookCore — گزارش نهایی مهندسی فاز ۱۰

**تاریخ:** ۲۳ نوامبر ۲۰۲۶  
**حکم:** `SOURCE IMPLEMENTATION CANDIDATE — OPERATIONAL DATABASE VERIFICATION DEFERRED`  
**انتشار Production:** ممنوع؛ فاز ۱۱ آغاز نشده است.

## ۱. مبنا و منشأ

- مبنای کد: `BookCore-Phase-09-Security-Governance.zip` (۴۰۷ فایل به‌جز Manifest). بستهٔ ورودی حفظ شد.
- ممیزی مستقل `BookCore_Phase09_Independent_Source_Audit_FA.md` از کتابخانه خوانده و یک نسخهٔ مرجع در `docs/engineering/PHASE_09_INDEPENDENT_SOURCE_AUDIT_FA.md` قرار گرفت.
- تمام ۱۰ Migration قبلی بدون تغییر حفظ شده‌اند. Migration افزایشی `011_operational_integrity.sql` اضافه شد.
- این مرحله یک توسعهٔ سورس و ابزار عملیاتی است، نه تأیید Runtime و امنیت دیتابیس.

## ۲. یافته‌ها و اصلاحات واقعی سورس

| ID | مشکل | تغییر واقعی | مرز اثبات |
|---|---|---|---|
| R10-01 | Fixture مربی در تست Consent از OWNER استفاده می‌کرد | هویت و Membership مجزای TRAINER، آزمون منفی برای OWNER | تست PostgreSQL نوشته، اجرا نشده |
| R10-02 | UUID ادعایی Operator از CLI قابل جعل در Audit بود | حذف Actor از CLI و محدودکردن تابع قدیمی؛ Registry LOGIN↔User؛ تابع جدید با `session_user`، محدودیت OWNER/Tenant، قفل و Audit | بررسی استاتیک؛ PostgreSQL و Role tests اجرا نشده |
| R10-03 | هر `23505` دعوت، خطای Pending ترجمه می‌شد | نگاشت فقط `staff_invite_one_pending` به `INVITATION_ALREADY_PENDING` و خطای یکتایی عمومی برای بقیه | Pure test PASS؛ SQL ناشناختهٔ واقعی تست نشده |
| R10-04 | توکن خام دعوت پس از COMMIT و پاسخ گمشده قابل بازیابی نبود | فرایند امن List metadata → Revoke → Reissue، تست HTTP+PG؛ بدون ذخیرهٔ Token خام | تست طراحی شده؛ Runtime اجرا نشده |

## ۳. توسعهٔ عملیاتی

- Inspector محدود به Tenant و OWNER واقعی، Batch حداکثر ۱۰۰ و `BEGIN READ ONLY`. تشخیص نمونه‌ای Counter drift، Session cancellation drift، وضعیت نهایی BookingEvents، Projection Receipt/Counter، Lease و دعوت/رضایت منقضی.
- تفکیک Detection/Classification/Repair؛ تعمیر خودکار Booking، Counter، تاریخچه و Audit عمداً وجود ندارد.
- Maintenance فقط برای auth_rate_limits قدیمی‌تر از ۴۸ ساعت: Preview، Batch حداکثر ۱۰۰، `FOR UPDATE SKIP LOCKED`، Reason و ثبت در جدول Audit الحاقی.
- `idempotency_records` حذف نمی‌شوند. این تصمیم **محافظه‌کارانه و موقت** است، نه اجرای کامل سیاست Retention؛ خطر رشد داده باقی است.
- Outbox Requeue در SQL با LOGIN واقعی، عضویت OWNER و Scope مجاز کنترل می‌شود؛ SELECT مستقیمِ Outbox برای نقش Ops گرفته شده است. تابع SECURITY DEFINER جدید با `search_path` ثابت طراحی شد.
- مسیرهای HTTP عمومی جدید برای عملیات حساس ایجاد نشده‌اند. Startup، Worker و جریان Booking قبلی حفظ شده‌اند.

## ۴. شواهد واقعی اجرا (فقط آنچه واقعاً اتفاق افتاد)

| فرمان / کنترل | نتیجه | فایل شواهد |
|---|---|---|
| `npm run verify:reference` | PASS | evidence/phase10/reference.log |
| `npm run verify:static` | PASS | evidence/phase10/static.log |
| `npm run test:phase10:isolated` | **۸/۸ PASS** | evidence/phase10/phase10_pure.log |
| ۵ مجموعهٔ Pure موروثی | **۵۷/۵۷ PASS** | evidence/phase10/*_pure.log |
| `python tools/phase09_validate_openapi.py` | PASS: ۴۶ عملیات، ۵۰۷ Ref | evidence/phase10/openapi_contract.log |
| `node tools/phase09_syntax_check.cjs` | PASS: ۹۹ فایل TS از نظر AST/Import محلی | evidence/phase10/syntax_scan.log |
| `node scripts/verify-migration-checksums.cjs` | PASS: ۱۱ Checksum | evidence/phase10/migrations.log |
| `npm install --package-lock-only --offline` | FAIL: ENOTCACHED | evidence/phase10/npm_lock.log |
| `npm ci --offline` | FAIL: Lockfile واقعی وجود ندارد | evidence/phase10/npm_ci.log |
| `npm run typecheck` / `npm run build` | FAIL: وابستگی/نوع Node/Nest/pg نصب نیست | evidence/phase10/typecheck.log, build.log |
| `npm run lint` | FAIL: eslint نصب نیست | evidence/phase10/lint.log |
| `npm run test:integration` | FAIL: dist تست ساخته نشده | evidence/phase10/integration.log |
| PostgreSQL17 Migration/Concurrency/Authorization | **صفر تست اجرا**؛ NOT VERIFIED | پیش‌نیاز PostgreSQL/Docker در این محیط نیست |
| GitHub Actions | NOT VERIFIED | هیچ Push یا Workflow Run انجام نشد |

**جمع تست Pure:** ۶۵ PASS، صفر FAIL. این تعداد هیچ تست PostgreSQL یا NestJS را شامل نمی‌شود. نتایج ماشین‌خوان در `evidence/phase10/command_summary.json` قرار دارد.

## ۵. Gateهای مستقل

| Gate | پیاده‌سازی | اعتبارسنجی |
|---|---|---|
| G1 — اصلاحات R10-01..04 | IMPLEMENTED (source) | NOT VERIFIED |
| G2 — Database inspection | PARTIAL (نمونهٔ محدود) | NOT VERIFIED |
| G3 — Reconciliation safety | IMPLEMENTED (read-only; auto repair disabled) | NOT VERIFIED |
| G4 — Lifecycle maintenance | PARTIAL (صرفاً bucket و expiry منطقی) | NOT VERIFIED |
| G5 — Idempotency retention | PARTIAL (purge deliberately disabled) | NOT VERIFIED |
| G6 — Invitation/consent lifecycle | PARTIAL (reissue + existing enforcement) | NOT VERIFIED |
| G7 — Cross-module consistency | PARTIAL (lock-order audit/tests) | NOT VERIFIED |
| G8 — Audit/Outbox integrity | PARTIAL (receipt-projection sample; recovery) | NOT VERIFIED |
| G9 — Operational authorization | IMPLEMENTED (role-bound SQL candidate) | NOT VERIFIED |
| G10 — Observability | PARTIAL (sanitized inspection JSON) | NOT VERIFIED |
| G11 — Migration/API consistency | PARTIAL (source/hash checked) | NOT VERIFIED |
| G12 — Tests/reproducibility | PARTIAL | FAIL |

هیچ Gate امنیتی/دیتابیسی صرفاً با گذر آزمون استاتیک PASS نشده است.

## ۶. ریسک‌های باز و توصیهٔ ادامه

- اجرای تازه و روی دادهٔ موجود PostgreSQL 17 برای Migration 011؛ تست نقش‌ها، فیلتر Tenant و انتساب `session_user`، SQLSTATE و Audit؛ شکست باید به اصلاح Migration *افزایشی بعدی* منجر شود، نه دست‌کاری 001–010.
- ممیزی جامع وضعیت‌های میانی BookingEvent، Outbox eventهای مفقود و تمام Tenantها؛ Inspector فعلی فقط نمونهٔ محدود را می‌بیند (`completeScan:false`).
- تصمیم Stakeholder دربارهٔ دورهٔ Retention، تعداد روزهای بازیابی Commit نامعلوم و پاک‌سازی Idempotency؛ تا آن زمان حذف خاموش ممنوع.
- آزمایش هم‌زمانی واقعی بر روی Revocation/Booking/Session، دو Worker/Lease، پروتکل ناشناس‌ماندن توکن دعوت و فصل مشترک قفل‌ها.
- ایجاد Lockfile واقعی فقط با npm Registry، اجرای `npm ci`, `typecheck`, `lint`, `build`, تمامی Unit/Integration و GitHub Actions در ریپازیتوری مجاز.
- تهیهٔ جداگانهٔ Credential اختصاصی برای هر اپراتور و ثبت LOGIN به User تأییدشده. Credential مشترک عملیاتی باعث انتساب نادرست Audit می‌شود.

## ۷. نتیجهٔ مستقل

**Phase 10 در سطح سورس بخشی از قابلیت‌های عملیاتی را پیاده‌سازی کرده است و ۶۵ آزمون Pure واقعاً PASS شده‌اند. با این حال، عملیات دیتابیسی، امنیت نقش‌ها و بازتولیدپذیری اجرایی هنوز اثبات نشده‌اند؛ این خروجی قابل انتشار تجاری نیست.**

مرحلهٔ ۱۱ آغاز نشده؛ تغییرات روی GitHub Push نشده است.
