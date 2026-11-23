# یکپارچگی دیتابیس فاز ۰۷

Migrationهای `001` تا `007` بدون تغییر نگه‌داری شده‌اند. Migration افزایشی `008_booking_permissions.sql` مجوزهای لازم ایجاد Booking، درج `BookingEvent`, `Outbox`, `Audit`، به‌روزرسانی Counter و Sequence مربوط به `event_order` را برای نقش محدود `bookcore_app` اضافه می‌کند. مالک Schema با حساب runtime یکی نیست.

قیود موجود: `bookings(tenant_id,session_id)` composite FK، `unique_effective_booking` Partial Unique، CHECK بازه ظرفیت، Guardهای تغییرناپذیری فیلدهای هویت/تاریخچه، بررسی انتهایی `verify_session_integrity()` و `verify_booking_history()` و اجرای Deferred Trigger در COMMIT.

**Risks & checks:** به‌دلیل عدم اجرای PG17، Syntax/Grantهای `008`، قفل‌های Deferred Trigger و ترتیب واقعی Eventها `NOT VERIFIED` هستند. SQL مستقیم مخرب (Counter اشتباه، Event نامعتبر، تغییر تاریخچه و Cross-Tenant FK) باید در محیط مالک تست و Commit ناموفق دیده شود. Migration در محیط خالی و دیتابیس دارای دادهٔ معتبر فاز ۰۶ دوبار اجرا شود؛ Checklist checksum و Rollback نیز بررسی شود. DB role نباید UPDATE/DELETE تاریخچه یا UPDATE شناسه‌های غیرمجاز داشته باشد.
