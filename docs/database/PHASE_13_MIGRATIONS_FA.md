# سیاست Migration فاز ۱۳

Migrationهای ۰۰۱ تا ۰۱۲ از نسخۀ مرجع به‌صورت byte-for-byte حفظ شده‌اند. Migration 013 ساخته نشده، زیرا قابلیت‌های فاز ۱۳ در لایهٔ API، ابزار عملیات و Test Harness انجام می‌شوند و بدون Plan واقعی، Index جدیدی اثبات نشده است. این **تأیید عملکرد ایندکس‌های فعلی نیست**.

قبل از انتشار، روی PostgreSQL 17 آزمایشی باید Migrationها با Role مالک اجرا، Checksum Ledger مقایسه، Roleهای App/Worker/Operations و فیلدهای Readiness آزمایش و برنامهٔ ارتقا روی دیتای Populateشده اجرا شود. تغییر SQL موروثی فقط با Migration افزایشی آینده مجاز است.
