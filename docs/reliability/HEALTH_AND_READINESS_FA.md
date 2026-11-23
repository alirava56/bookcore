# سلامت و Draining

`GET /api/v1/health/live` عمومی و مستقل از DB است. `GET /api/v1/health/ready` خصوصی است و `MonitorGuard` باید شبکه و کلید را تأیید کند؛ Readiness وضعیت Migration و جدول‌های لازم را بررسی می‌کند اما گواهی Integrity کامل نیست. `LifecycleState` هنگام `beforeApplicationShutdown` وضعیت Draining می‌گیرد. در این حالت Readiness 503 و مسیرهای غیر از Live 503 دریافت می‌کنند؛ درخواست‌های از قبل پذیرفته‌شده برای تکمیل در اختیار Graceful Shutdown Nest هستند.

در محیط چند Replica، پیش از SIGTERM باید Ingress ترافیک جدید را از نمونهٔ در حال Draining حذف کند و Timeout خاتمه، از بیشترین درخواست قانونی بیشتر باشد. Worker جداگانه SIGTERM را دریافت کرده و پس از Tick جاری Pool را می‌بندد. هیچ ادعای تست Shutdown واقعی چند Replica وجود ندارد.
