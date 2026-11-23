# تکامل Schema در Phase 12

۱۲ Migration موجود **بدون هیچ تغییر بایتی** حفظ شده‌اند. Migration 013 ایجاد نشده است زیرا عملیات Backup با ابزارهای رسمی PostgreSQL و Manifest مستقل در File Storage کار می‌کند و هیچ تغییر Schema برای آن لازم نیست. ساخت جدول Tracking داخل دیتابیس هدف، بازیابی را به همان دیتابیس وابسته می‌کرد؛ عمداً انتخاب نشده است.

پس از Restore، Ledger `bookcore_migrations` با Checksum همان فایل‌های SQL سورس مقایسه می‌شود و کمتر از ۱۲ Entry یا Drift خطا است. این تطبیق فقط Version Integrity را نشان می‌دهد، نه سالم‌بودن تمام رکوردها. هیچ Trigger یا Constraint تاریخی تغییر نکرده است. احراز سازگاری PostgreSQL 17 واقعی، مجوزهای pg_dump/pg_restore و بازیابی یک Backup پرشده همچنان NOT VERIFIED است.
