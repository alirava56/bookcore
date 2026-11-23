# ظرفیت و هم‌زمانی PostgreSQL — فاز ۰۷

## پروتکل قفل
برای هر Write ترتیب منطقی زیر حفظ می‌شود:

1. `Organization` فعال با `FOR SHARE` در عملیات Booking؛ مدیران Scheduling و Membership با `FOR UPDATE` سازمان را می‌گیرند. هر دو **قبل** از قفل‌های بعدی هستند. قفل Shared سازمان اجازه می‌دهد مشتریان یک سازمان هم‌زمان برای جلسات متفاوت اقدام کنند، اما تعلیق سازمان با Writeهای درحال‌جریان سریالی می‌شود.
2. `AuthSession` با `FOR SHARE` و بررسی Active بودن User؛ در عملیات کارمندی Membership با `FOR SHARE` قبل از Claim کلید.
3. ردیف `IdempotencyRecord` (Unique + `FOR UPDATE`).
4. ردیف `Session` با `FOR UPDATE`.
5. ردیف `Booking` (لغو/حضور) با `FOR UPDATE`، سپس نوشتن Event/Audit/Outbox.

در لغو و ثبت حضور، یک lookup بدون قفل از `booking.session_id` صرفاً برای تعیین Session انجام می‌شود؛ FK و Guard این رابطه را تغییرناپذیر نگه می‌دارند. مجوز از این lookup استخراج نمی‌شود. مسیرهای فاز ۰۶ با قفل انحصاری سازمان، با این ترتیب سازگارند؛ کد آزمایشی قدیمی فاز ۰۲ در Reference نباید مستقیم به تولید متصل شود.

## منبع حقیقت
در READ COMMITTED، پس از قفل Session، وضعیت، `clock_timestamp()` و Counter بررسی می‌شوند. `unique_effective_booking` از ثبت مؤثر تکراری حتی با دو Key متفاوت جلوگیری می‌کند. UPDATE اتمی Counter همراه با Event و Outbox در یک TX است و CHECK/Deferred Triggerها در COMMIT آن را بررسی می‌کنند.

## معیار اثبات
دو Process مستقل NestJS با Poolهای جدا برای ظرفیت‌های ۱ و ۲۰، هرکدام ۱۰۰ درخواست و سه اجرای مستقل. Assertions روی ردیف‌های Commitشده Booking/Counter/Event/Outbox و خروج پاک Workerها انجام می‌شود. Harness در `apps/api/test/integration/booking-postgres.test.ts` حاضر است ولی **اجرا نشده**؛ هیچ عدد عملکرد یا PASS دیتابیسی ادعا نمی‌شود.
