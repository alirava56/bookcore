# گزارش بازیابی BookCore

**Logical Restore محلی و PITR محلی با PostgreSQL 17.6 اجرا شدند.** دیتابیس‌های مبدأ و مقصد و اطلاعات آزمون مصنوعی بودند. `pg_dump`، `pg_restore` و `psql` از باینری‌های رسمی نسخهٔ اصلی ۱۷ استفاده کردند.

- `npm run test:recovery` با کد ۰ اجرای `pg_dump` در فرمت custom، بررسی آرشیو، رمزگشایی `age` با هویت جدا و restore تک‌تراکنشی روی مقصد خالی و علامت‌گذاری‌شده را تأیید کرد. digest غایب، digest غلط و هویت مبدأ غلط پیش از Restore رد شدند.
- پس از Restore، ۱۵ مهاجرت، دو Booking، ۲۷ AuditEvent، ۲۷ رویداد Outbox، ۲۷ Receipt و شمارش Projection برابر ۲۷ بررسی شدند. اختلافی در ظرفیت، زنجیرهٔ وضعیت یا رسیدها ثبت نشد. ACL نقش‌های API و Worker از Restore عبور کرد.
- برای PITR روی سرور موقت جدا `pg_basebackup -X stream -c fast` و `pg_verifybackup` اجرا شدند. نشانگر `replayed` پس از backup و پیش از `bookcore_verify_target` ثبت شد. نشانگر `after_target` پس از نقطهٔ بازیابی ثبت شد. مقصد از WAL بایگانی‌شده تا نقطهٔ نام‌دار پیش رفت، با timeline جدید promote شد و فقط `base,replayed` و هر ۱۵ مهاجرت را نشان داد.
- دریافت digest و کلید در اجرای محلی از طریق کانال‌های محیطی جدا شبیه‌سازی شد. گردش‌کار GitHub مستلزم محیط محافظت‌شده، شناسهٔ اجرای تولیدکنندهٔ جدا و digest مصوب آن محیط است. اجرای آن محیط، خرابی واقعی مرکز داده و اندازه‌گیری عملیاتی RPO/RTO همچنان باز هستند.

شواهد در `evidence/final/recovery-final.log` و `evidence/final/pitr.log` هستند. Dump و کلید خصوصی جزو بستهٔ سورس نیستند.
