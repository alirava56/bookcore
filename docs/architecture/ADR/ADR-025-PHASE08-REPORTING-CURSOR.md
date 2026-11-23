# ADR-025 — Reporting snapshot و Cursor دقیق

**وضعیت:** تصمیم موقت مهندسی، نیازمند اجرای Runtime و تأیید تعریف شمارش تجاری.

از یک SQL Statement برای Snapshot هماهنگ Occupancy استفاده می‌کنیم. بازه با شروع Session تعریف می‌شود؛ Sessionهای DRAFT حذف و Sessionهای PUBLISHED/FINISHED/CANCELLED شمرده می‌شوند. ستون‌های گزارش تعداد Bookingهای فعلی در هر Status هستند، نه Audit Events و نه `seats_committed`. Trade-off: برای گزارش‌های مالی/تاریخی نیازمند تعریف گزارش مجزا و احتمالاً Materialization خواهد بود.

Cursor تاریخچهٔ Booking از UTC Microsecond Text تولیدشده توسط PostgreSQL و `id` استفاده می‌کند. HMAC با کلید فعال JWT و Scope Tenant/Customer، دست‌کاری و استفاده در حساب دیگر را رد می‌کند. Rotation کلید ممکن است Cursorهای قبلی را نامعتبر کند؛ کاربر صفحه‌بندی را از ابتدا شروع می‌کند. جایگزین سادهٔ `Date.toISOString()` عمداً ممنوع است. این تصمیم جایگزین تست واقعی Page Boundary نمی‌شود.
