# یکپارچگی گزارش و هم‌زمانی

در READ COMMITTED، چند Query جداگانه می‌توانند Snapshotهای متفاوت ببینند. به همین علت تمامی شمارنده‌های این گزارش در یک SQL Statement و یک Snapshot ساخته می‌شوند. JOIN کلید Session به Booking فقط با `tenant_id` و `session_id` انجام می‌شود. گروه وضعیت‌ها `CONFIRMED`, `ATTENDED`, `NO_SHOW`, `CANCELLED` هستند و شمارش رویدادهای تکراری انجام نمی‌شود. Indexهای موجود `sessions_tenant_start` و `booking_session_status` برای این مسیر در نظر گرفته شده‌اند؛ EXPLAIN ANALYZE و سنجش p95 در PostgreSQL واقعی معوق است.

در هم‌زمانی با تراکنش رزرو، نتیجه بازتاب یکی از Snapshotهای معتبر در شروع Statement است، نه تغییرات آینده. Cancel/Commit و Refresh در مسیر گزارش خارجی Trigger نمی‌کنند. کاربران بدون Membership سازمانی حتی اگر Booking شخصی داشته باشند به گزارش اداری دسترسی ندارند. پاسخ به عضو فعال بدون نقش گزارش `403` و به هویت بدون عضویت `404` است. رفتار دقیق با Suspended Organization نیز `404` است.

ریسک: ستون شمارندهٔ `sessions` ممکن است با انتظار محصول برای Session لغوشده یا جلسات منتقل‌شده متفاوت باشد؛ نیازمند تأیید Stakeholder. آزمون‌های شمارش `ATTENDED/NO_SHOW` و Snapshot هم‌زمان در PostgreSQL هنوز اجرا نشده‌اند.
