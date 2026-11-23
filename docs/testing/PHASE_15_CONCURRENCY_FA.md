# آزمون Concurrency و ظرفیت

برای ظرفیت ۱ و ۲۰، هرکدام ۱۰۰ مشتری متمایز و کلید Idempotency مجزا روی **دو فرایند مستقل** و حداقل سه تکرار از Fixture تازه الزامی است. باید تعداد Booking مؤثر، `seats_committed`، BookingEvent و Outbox یکسان باشند؛ پاسخ‌های ۵xx/Timeout/Network failure باید آزمون را FAIL کنند. پاسخ `503` هرگز رد تجاری صحیح نیست.

آزمون‌های تداخلی اولویت‌دار: Booking/Capacity reduction، Booking/Session cancellation، Consent revocation/Staff Booking، Refresh/Logout، Outbox lease/fencing و Maintenance/Booking.

Harness سورس موجود است، اما PostgreSQL و NestJS اجرا نشده‌اند؛ اعداد p50/p95/p99 یا TPS گزارش نشده‌اند. وضعیت: NOT VERIFIED.
