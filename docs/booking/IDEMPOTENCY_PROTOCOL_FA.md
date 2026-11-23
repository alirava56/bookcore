# پروتکل Idempotency — فاز ۰۷

## کلید و Fingerprint
هدر `Idempotency-Key` الزامی و UUID است. Unique Scope دیتابیس: `(tenant_id,actor_id,operation,key)`. `operation` برای Create، Cancel و Attendance مستقل است. Fingerprint از Payload کاننیکال با ترتیب مرتب کلیدها و SHA-256 گرفته می‌شود؛ مسیر/Session/Booking و Actor لازم در Payload حضور دارند.

## الگوریتم
بعد از بازآزمایی Session احراز هویت و در صورت نیاز عضویت کارکنان، `INSERT ... ON CONFLICT DO NOTHING` و `SELECT ... FOR UPDATE` روی رکورد انجام می‌شود. `PROCESSING` موقت فقط داخل تراکنش است؛ Trigger مانع COMMIT آن می‌شود. در موفقیت، Receipt و HTTP Status به `FINAL` تبدیل می‌شوند؛ همزمان Booking، Counter، Event، Audit و Outbox Commit می‌شوند.

| سناریو | نتیجه |
|---|---|
| درخواست اول | اجرای کسب‌وکار و Commit پاسخ |
| همان Key/Payload | Replay دقیق Status/Body؛ بدون Side Effect جدید |
| همان Key/Payload متفاوت | `409 IDEMPOTENCY_KEY_REUSED` |
| دو درخواست هم‌زمان یک Key | Unique claim و قفل رکورد؛ فقط یک نتیجهٔ نهایی |
| رد کسب‌وکاریِ قابل‌پیش‌بینی | ۴xx پایدار در تراکنش Commitشده |
| SQL Error / Rollback | هیچ پاسخ FINAL جعلی، خطا Mapping ایمن |
| Commit نامعلوم | `503 UNKNOWN_COMMIT_OUTCOME`؛ فقط Retry با **همان Key و همان Payload** |
| Key منقضی ولی نگه‌داری‌شده | `409 IDEMPOTENCY_KEY_EXPIRED` تا پاک‌سازی کنترل‌شده |
| Key پاک‌شده پس از Retention | امکان ایجاد درخواست جدید تحت سیاست Retention؛ نیازمند تست سوءاستفاده |

بازپخش فقط بعد از مجوز دسترسی جاری مجاز است؛ Session یا Membership باطل‌شده نباید با Replay پاسخ خصوصی دریافت کند. دلیل Rejectionهای پنهان (مانند Booking ناموجود متعلق به دیگران) در صورت لزوم پیش از Claim بررسی می‌شود. **بازیابی قطعی COMMIT نامعلوم هنوز در PostgreSQL واقعی آزمایش نشده است.**
