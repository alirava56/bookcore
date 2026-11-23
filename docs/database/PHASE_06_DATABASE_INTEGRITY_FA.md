# یکپارچگی دیتابیس — Phase 06

Migrationهای `001` تا `006` به صورت byte-for-byte نگهداری شده‌اند. Migration جدید `007_session_permissions.sql` به ROLE محدود `bookcore_app` دسترسی SELECT/INSERT و UPDATE ستون‌های خاص Session، Allocation، Booking، BookingEvent و Idempotency می‌دهد؛ به تغییر هویت Tenant، شناسهٔ منابع یا حذف تاریخچه مجوز نمی‌دهد. Schema اصلی همچنان از `bookings`, `resource_allocations`, `sessions` و جداول Outbox/Audit قبلی استفاده می‌کند.

`verify_session_integrity` در 001 و اصلاحات 003/004 با Constraint Trigger تعویقی، شمارنده و تعداد تخصیص‌ها را پس از پایان تراکنش می‌سنجند؛ Triggerهای نسخهٔ 004 تاریخچهٔ Booking و دلایل لغو را محافظت می‌کنند. این مهاجرت‌ها **اجرا نشده‌اند** و رفتارشان هنوز `NOT VERIFIED` است.

### بررسی‌های لازم برای Release
1. اجرای `npm run migrate` دوبار روی PG17 تازه و ارتقا از 006 همراه با تایید Checksum.
2. ایجاد دو DRAFT هم‌پوشان با دو Process، کنترل SQLSTATE `23P01` و نبود ردیف ناقص.
3. تزریق SQL نامعتبر به Session/ResourceAllocation/BookingEvent، آزمایش Counter Drift و Tenant FKs.
4. اجرای لغو اتمی ۱۵ رزرو و Failure Injection با بررسی وضعیت Commit شده و Outbox.
5. آزمون تغییر ساعات/Exception، لغو عضویت TRAINER و ایجاد Session با چند Connection.
6. آزمون Permission least privilege و منع DELETE/UPDATE ستون‌های تاریخی.

SQL 007 فقط گسترش مجوز است، نه اثبات اجرای Triggerها یا رفع تمام نقص‌های احتمالی فاز دوم.
