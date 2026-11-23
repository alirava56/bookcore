# معماری Observability — فاز ۱۳

BookCore همچنان یک NestJS Modular Monolith و یک Worker مستقل در همان مخزن است. در API، `ObservabilityModule` یک `MetricsService` درون‌فرایندی را به درخواست‌ها، `DatabaseService` و `UnitOfWork` متصل می‌کند. شاخص‌ها مبتنی بر رخداد واقعی هستند؛ دادهٔ ساختگی یا مقادیر ثابت «موفق» صادر نمی‌شود.

## مرز امنیت و جمع‌آوری

`GET /api/v1/internal/metrics` با `@MonitoringRoute()` و `@UseGuards(MonitorGuard)` محافظت شده است. گارد، هم IP مستقیم سوکت را با Allowlist مشخص و هم کلید `X-BookCore-Monitor-Key` را کنترل می‌کند؛ هدرهای Forwarded دلخواه جایگزین IP واقعی نمی‌شوند. `@ApiExcludeController` این مسیر عملیاتی را از قرارداد عمومی جدا نگه می‌دارد. هر Replica مستقل باید از مسیر شبکهٔ خصوصی و با کلید چرخان جمع‌آوری شود. تجمیع بین Replicaها خارج از برنامه و وظیفهٔ سامانهٔ پایش است.

## محدودیت‌های واقعی

اندازهٔ تأخیر درخواست با `performance.now()` تا پایان Response یا قطع اتصال انجام می‌شود. Route Label از الگوی Handler می‌آید، نه URL واقعی و UUID مشتری. نوع وضعیت فقط `2xx`, `4xx`, `5xx` و مشابه است. تعداد سری‌ها محدود است. پایش Pool شامل `totalCount`, `idleCount`, `waitingCount` است؛ سنجش معامله از `UnitOfWork` و زمان اخذ اتصال انجام می‌شود. **Query-by-query timing در تمام SQLهای مستقیمِ PoolClient هنوز پیاده‌سازی نشده است**. Outbox در پروسهٔ جدا گزارش JSON دوره‌ای دارد، اما به Prometheus مشترک API متصل نیست؛ هیچ ادعای Metrics چند Worker وجود ندارد.

## راه‌اندازی

1. کلید `MONITOR_API_KEY` با حداقل ۳۲ کاراکتر تصادفی تعریف شود.
2. `MONITOR_ALLOWED_IPS` فقط شامل IP مستقیم Collector در شبکهٔ اختصاصی باشد.
3. در صورت قرارگیری پشت Proxy، مسیر metrics مستقیماً به اینترنت منتشر نشود؛ TLS و دسترسی Collector در لایهٔ Ingress الزامی است.
4. Alertها تا اندازه‌گیری واقعی بار و تعیین SLO تجاری، آزمایشی و نیازمند تنظیم‌اند.
