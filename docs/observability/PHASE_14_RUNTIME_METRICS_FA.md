# Phase 14 — مشاهده‌پذیری واقعی و حد اثبات

مسیر `/api/v1/internal/metrics` تنها با `MonitoringRoute`، `MonitorGuard`، کلید مستقل و Allowlist IP قابل دسترسی طراحی شده است. درخواست عمومی باید رد شود. در فاز ۱۴، یک Smoke Test برای اثبات رفتار Runtime در سورس اضافه شده اما در نبود NestJS/PG اجرا نشده است.

شاخص‌های فاز ۱۳ در سورس: شمار درخواست، Latency HTTP، خطاهای کد/کلاس، Pool Stats، Retry تراکنش، Unknown Commit و برخی وضعیت‌های Outbox. Labelها باید از Route Template ثابت مشتق شوند، نه UUID خام. مانیتورینگ فعلی در هر Replica درون‌فرایندی است؛ تجمیع چند Replica/Worker اثبات نشده است.

پیش از تعیین SLO/Alertهای واقعی، Prometheus Exposition باید Parse شود و دادهٔ نمونه در بار واقعی به‌دست آید. هیچ مقدار تولیدی یا مصنوعی به‌عنوان Baseline ثبت نشده است.
