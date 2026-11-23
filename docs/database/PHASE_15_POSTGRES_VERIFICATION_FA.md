# PostgreSQL 17 — قرارداد اثبات

باید یک PostgreSQL17 دورریختنی با نقش‌های جداگانه Migration Owner، Runtime، Worker، Inspector، Maintenance و Recovery فراهم شود. ۱۲ Migration تاریخی بدون تغییر به‌ترتیب اجرا و Migration Runner بار دوم تکرار شود. در دیتابیس پرشده با Fixture مصنوعی، قید ظرفیت، یکتایی رزرو، Exclusion منابع، Composite Tenant FK، Last-owner، تاریخچهٔ BookingEvent، Audit immutable، دعوت/Consent و Outbox lease بررسی شود.

سه نوع سند لازم است: لاگ خام اجرای Migration/SQLSTATE، وضعیت واقعی نقش‌ها/اشیای دیتابیس، و نتیجهٔ Integration/Concurrency روی PostgreSQL مشترک.

**وضعیت:** `psql`, `postgres`, `pg_dump`, `pg_restore` و Docker در محیط حاضر موجود نیستند. هیچ Migration اجرا نشده است؛ بررسی SHA-256 سورس به معنای صحت SQL یا مجوزهای دیتابیس نیست.
