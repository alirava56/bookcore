# BookCore — ممیزی مستقل سورس فاز ۰۹

**مبنا:** `BookCore-Phase-09-Security-Governance(1).zip` و `PHASE_09_FINAL_REPORT_FA(1).md`؛ بررسی مستقل در ۲۳ نوامبر ۲۰۲۶.

**حکم:** `CONDITIONAL SOURCE CONTINUATION — RUNTIME SECURITY NOT VERIFIED`. ادامه توسعه فاز ۱۰ با اصلاح‌های اولویت‌دار زیر پذیرفتنی است؛ انتشار یا تأیید امنیتی ممنوع.

## ۱. اعتبار بسته و شواهد قابل تکرار

- ZIP CRC سالم؛ استخراج امن و بررسی Manifest از ریشه `bookcore/`: **۴۰۷ از ۴۰۷** فایل با SHA-256 و اندازه مطابقت دارند.
- گزارش جداگانه با `docs/engineering/PHASE_09_FINAL_REPORT_FA.md` دقیقاً هم‌هش است.
- مقایسه با آرشیو اصلی فاز ۰۸ نشان داد Migrationهای **۰۰۱–۰۰۹ بایت‌به‌بایت یکسان** هستند؛ Migration **۰۱۰** جدید است.
- اعتبارسنج OpenAPI: **۴۶ عملیات، ۴۶ operationId یکتا، ۵۰۷ ارجاع داخلی قابل حل**؛ فقط بررسی ایستا.
- ابزار بررسی نحوی/Import: **۹۴ فایل TypeScript** بدون ایراد نحوی یا Import نسبی در بررسی اجراشده؛ Typecheck با وابستگی‌های واقعی نیست.
- اجرای مجدد تست‌های Pure: Availability=13، Session=8، Booking=6، Phase08/Outbox=24، Phase09/Governance=6؛ **جمعاً ۵۷ PASS / صفر FAIL**.
- `scripts/test-booking-domain-pure.cjs` اکنون با ۶ تست موفق Exit Code صفر برمی‌گرداند؛ نقص شمارنده ثابت فاز ۸ اصلاح شده است.
- PostgreSQL/NestJS HTTP، Migration، Integration، Worker Multi-process و CI واقعاً در این ممیزی اجرا نشده‌اند. `package-lock.json` وجود ندارد؛ قابلیت نصب تمیز/Typecheck/Build هنوز تأیید نشده است.

## ۲. ممیزی مستقیم کد و یافته‌ها

### F09-01 — P1 — Fixture تست PostgreSQL با Trigger منابع ناسازگار است

- `apps/api/test/integration/phase09-postgres.test.ts`، بخش تست Consent، Resource مربی را با `trainer_user_id=owner.id` ایجاد می‌کند.
- `db/migrations/006_catalog_availability.sql`، تابع `p05_guard_trainer_resource` برای ساخت Resource نوع TRAINER الزام می‌کند عضویت همان کاربر در سازمان `role='TRAINER'` و `status='ACTIVE'` داشته باشد.
- سازنده سازمان طبق `apps/api/src/modules/organizations/organizations.service.ts` دارای نقش `OWNER` می‌شود، نه `TRAINER`.
- بنابراین اجرای معتبر PostgreSQL برای این Fixture با مدل فعلی **ناسازگار** است و احتمال زیاد قبل از رسیدن به Assertions مربوط به Consent به خطای Constraint منجر می‌شود. این نتیجه ناشی از تطبیق مستقیم SQL و Test Source است؛ مشاهده Runtime PostgreSQL نیست.
- **اصلاح:** ایجاد User جداگانه، عضویت فعال TRAINER با مسیر Invitation/Acceptance یا Fixture معتبر، سپس ساخت Resource و Session. آزمون‌های مثبت/منفی Trigger را مستقل بنویسید.

### F09-02 — P1 — انتساب هویت اپراتور در ابزار بازیابی Outbox قابل اتکا نیست

- `scripts/outbox-recovery.ts` برای فرمان `retry` یک UUID اپراتور را به‌صورت پارامتر CLI می‌پذیرد.
- `db/migrations/010_security_governance.sql`، تابع `bookcore_requeue_outbox` بررسی می‌کند UUID اعلام‌شده OWNER فعال در Tenant باشد، اما آن UUID را به هویت **واقعی اتصال** `bookcore_ops` یا عامل احرازشده معادل وصل نمی‌کند.
- در نتیجه فردی که به Credential عملیاتی دسترسی داشته باشد می‌تواند UUID هر OWNER شناخته‌شده را ارسال کند و Audit نام آن کاربر را ثبت کند؛ این مسئله **ریسک جعل انتساب Audit توسط دارنده دسترسی عملیاتی** است، نه اثبات دسترسی یک کاربر عادی به CLI.
- **اصلاح:** تعیین منبع هویت اپراتور مبتنی بر اتصال عملیاتی یا کنترل مستقل هویت، ثبت هویت حقیقی اپراتور و Actor کسب‌وکاری به‌صورت جدا، اجتناب از اعتماد صرف به آرگومان `--actor`، و تست‌های مجوز منفی.

### F09-03 — P2 — نگاشت بیش‌ازحد عمومی خطای Unique در Invitation

- `apps/api/src/modules/governance/governance.service.ts` در `invite` هر خطای SQLSTATE `23505` را `INVITATION_ALREADY_PENDING` برمی‌گرداند.
- نقض Constraintهای دیگر از جمله رخدادهای فرعی همان تراکنش ممکن است به همین خطا تعبیر شود.
- **اصلاح:** بررسی `err.constraint` دقیقاً برای Unique Index مربوط به دعوت معلق؛ سایر خطاها طبقه‌بندی امن مستقل بگیرند و در سطح عملیاتی قابل تشخیص باشند.

### F09-04 — P2 — بازیابی توکن دعوت در فقدان پاسخ HTTP مشخص نیست

- `GovernanceService.invite` Token خام را فقط در پاسخ موفق ایجاد می‌کند و صرفاً هش آن را در DB نگه می‌دارد.
- اگر Commit موفق و پاسخ گم شود، درخواست مجدد با همان دعوت معلق Conflict می‌شود و Token خام از DB قابل بازیابی نیست.
- **اصلاح:** فرایند امن list/revoke/reinvite یا ابلاغ امن و قابل اتکای دعوت؛ بدون ذخیره‌سازی Token خام. رفتار Unknown COMMIT مستند و تست شود.

### F09-05 — قیود ادامه / NOT VERIFIED

- بازیابی Refresh با سیاست Re-authentication محافظه‌کارانه کدنویسی شده، ولی هم‌زمانی و قطع اتصال واقعی آزموده نشده‌اند.
- تکمیل Consent و Invitation از حیث Source وجود دارد؛ رضایت حقوقی، زمان‌بندی و نحوه ارسال دعوت تصمیم‌های محصولی باز هستند.
- Worker دارای Claim تک‌رویدادی و Fence در کد است؛ صحت Lease/Crash/Ordering/Receipt در PostgreSQL اثبات نشده است.
- تست‌های درونی Phase09 فقط سیاست‌های Pure را پوشش می‌دهند؛ اجرای کامل NestJS/SQL و Migration دهم هنوز گیت انتشار است.

## ۳. تصمیم مهندسی

**ورود به فاز ۱۰ برای ادامه توسعه سورس مجاز است**، مشروط بر اینکه F09-01 و F09-02 پیش از افزودن مسیر عملیاتی حساس جدید اصلاح شوند و F09-03/F09-04 در همان فاز با تست رگرسیون پوشش داده شوند. موارد `NOT VERIFIED` نباید در گزارش یا CI به PASS تبدیل شوند تا اجرای واقعی ممکن شود. فاز ۹ و کل محصول Production-ready نیستند.
