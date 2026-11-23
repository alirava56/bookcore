# مسیرهای آزمون MVP

جریان‌های A تا K: ثبت‌نام/Login/Logout، ایجاد Organization و OWNER، دعوت و پذیرش کارکنان، Catalog و Resource، Session Draft→Publish، رزرو مشتری با Idempotency و History، لغو/Finish/Attendance، رضایت و رزرو کارکنان، Occupancy، Outbox و بازرسی عملیاتی.

برای هر جریان پاسخ HTTP **و** وضعیت Commitشدهٔ PostgreSQL باید با هم کنترل شوند. مجموعه‌های Integration قبلی حفظ شده‌اند؛ اجرای واقعی آن‌ها به Build و PG17 نیاز دارد. `scripts/run-tests.cjs integration` تست Restore را اجرا نمی‌کند و برای نبود تست‌های کامپایل‌شده خروجی BLOCKED می‌دهد.

تطبیق استاتیک ۴۶ مسیر/متد OpenAPI، معادل پاسخ DTO یا صحت Dependency Injection نیست. وضعیت HTTP/E2E تمام جریان‌ها: NOT VERIFIED.
