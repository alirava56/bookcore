# Backpressure و مدیریت فشار

`MAX_INFLIGHT_REQUESTS` محدودۀ ۱ تا ۱۰۰۰۰ با پیش‌فرض ۶۴ دارد. Middleware قبل از Controller و قبل از هر عملیات Booking با یک شمارندهٔ محلی ظرفیت هم‌زمانی را بررسی می‌کند. هنگام عبور از سقف، `503 SERVER_OVERLOADED` در قالب Problem Details و `Retry-After: 1` می‌دهد. چون قبل از ورود به تراکنش رد می‌کند، نتیجهٔ COMMIT را مبهم نمی‌سازد. Liveness و Readiness از Admission مستثنا هستند.

این محدودکننده برای **هر Replica مستقل** است؛ صف/محدودیت سراسری Tenant یا Edge هنوز لازم است. محدودسازی Retryهای شناخته‌شده در `UnitOfWork` همچنان حداکثر پنج تلاش است؛ Unknown Commit خودکار Retry نمی‌شود. برای حملات و Burst در Ingress باید Rate Limit بر پایه Actor/Endpoint جداگانه پیکربندی شود. `503` به معنی عدم شروع عملیاتِ همین درخواست است، نه تضمین عدم اجرای Retry از درخواست قبلی.

پیش از انتشار، Pool Max، حداکثر Replicaها، تعداد اتصال PostgreSQL، زمان Timeout و ظرفیت Worker با آزمون بار واقعی تنظیم شوند.
