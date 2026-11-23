# مجوز و امنیت رزرو — فاز ۰۷

## سیاست‌ها
- Global `APP_GUARD` از فاز چهارم فعال و Fail-Closed است. Booking Controller تزریق Principal معتبر JWT/DB را لازم دارد.
- رزرو شخصی: User ACTIVE + AuthSession فعال؛ بدون Membership کارکنان؛ Customer از Token مشتق می‌شود. `customerId` ارسالی حتی اگر UUID معتبر باشد با `403 BOOKING_CONSENT_REQUIRED` رد می‌شود تا سیستم رضایت/mandate ساخته شود.
- تاریخچه: فیلتر `tenant_id`, `customer_id`, و `auth_session` در SQL واحد؛ هیچ Query تمام Bookingهای سازمان را به حافظه انتقال نمی‌دهد. حتی سازمان تعلیق‌شده تاریخچهٔ مشتری را حذف نمی‌کند.
- لغو: مالک Booking قبل از Cutoff یا OWNER/MANAGER/RECEPTIONIST با دلیل معتبر. نقش TRAINER بدون مجوز اداری نمی‌تواند لغو مشتری دیگر را انجام دهد.
- حضور: کارمند مجاز یا TRAINER اختصاص‌یافته به Resource همان Session؛ User عادی مجاز نیست. Membership حین TX قفل و مجدداً تأیید می‌شود.
- تمام Writeها با Organizational Lock مشترک و بررسی AuthSession صورت می‌گیرند؛ تغییر وضعیت سازمان/عضویت به‌صورت موازی پس از پایان تراکنش قابل انجام است. 401/403/404/409 با RFC9457 بدون SQL و اطلاعات داخلی داده می‌شود.
- Rate Limiting مشترک PostgreSQL برای Booking بر اساس User و نوع عملیات (بدون اشتراک اشتباه NAT)، ولی Edge-level IP rate limit و محافظت DDoS هنوز وظیفهٔ عملیاتی است.

## ریسک‌های باز
Consent/mandate مشتری برای کارکنان، Lost-ACK Refresh قدیمی، Permission Matrix و BOLA روی DB واقعی، Rate Limit پشت Reverse Proxy، و Unknown COMMIT تماماً قبل از Pilot نیازمند آزمایش هستند. Runtime Role محدود مکمل RBAC است، نه جایگزین آن.
