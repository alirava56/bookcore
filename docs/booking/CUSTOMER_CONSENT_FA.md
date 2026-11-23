# رضایت مشتری برای رزرو به نمایندگی

## اصل تجاری
نقش Staff به‌تنهایی مجوز ثبت رزرو برای مشتری نیست. مشتری **خودش** به یک سازمان مشخص حق ثبت رزرو به نمایندگی می‌دهد. داشتن شماره تلفن، ایمیل یا UUID کاربر رضایت نیست.

## Data Model
جدول `booking_consents`: `id`, `tenant_id`, `customer_id`, `created_at`, `expires_at`, `revoked_at`. UNIQUE جزئی روی `(tenant_id,customer_id)` برای رضایت لغونشده. مدت قرارداد فعلی سرویس حداکثر ۳۰ روز است، دیتابیس بیش از ۹۰ روز را نیز منع می‌کند. این تفاوت دفاع لایه‌ای است؛ Rule دیتابیس برای این‌که مدیر با SQL فراتر از محدودیت سرویس ثبت نکند، جایگزین سیاست اپلیکیشن نیست.

## مسیرها
- `POST /organizations/{orgId}/booking-consents`: توسط مشتری احراز هویت‌شده، Org ACTIVE؛ بدون امکان تعیین customerId دلخواه.
- `GET /organizations/{orgId}/booking-consents/me`: فقط رضایت‌های صاحب Principal.
- `POST /organizations/{orgId}/booking-consents/{consentId}/revoke`: فقط صاحب رضایت، ثبت زمان ابطال و Audit/Outbox در همان TX.

## اتصال به Booking
`BookingService.create()` اگر `customerId` غیر از `principal.userId` باشد، Role زندهٔ Staff با `OWNER|MANAGER|RECEPTIONIST` و رضایت معتبر همان مشتری/سازمان را می‌طلبد. کنترل بعد از بازیابی نتیجهٔ Idempotencyِ از قبل Commit‌شده و **پیش از ایجاد رزرو تازه** انجام می‌شود. ادعای ظرفیت و درج Booking همچنان در همان Transaction و با Session Lock انجام می‌شود. Actor و Customer به‌صورت مجزا ثبت می‌شوند.

## Race و Failure
قفل سازمان در Grant/Revoke/Booking به همراه Consent `FOR SHARE` برای عملیات جدید از ایجاد رزرو بعد از ابطال از پیش Commit‌شده جلوگیری می‌کند؛ اگر رزرو جلوتر Commit شود، ابطال جدید آن را خودکار لغو نمی‌کند. این سیاست باید در PostgreSQL واقعی با تراکنش‌های هم‌زمان آزمایش شود. Replay درخواست Commit‌شده ممکن است جواب قدیمی را بازگرداند ولی اثر جانبی جدید تولید نمی‌کند.

## محدودیت‌های فعلی
محدودهٔ رضایت فعلاً «یک کرسی در سازمان مشخص» است و محدودیت خدمت/تاریخ/تعداد استفاده یا UX نمایش سیاست حقوقی در این فاز تعریف نشده است. Consent تاریخی یا رضایت ضمنی ساخته نشده. Inviter/Staff اجازهٔ Grant به جای Customer ندارد.
