# Phase 14 — ماتریس آزمون منفی امنیت

## کنترل‌های واقعاً اجراشده در سطح Pure/Mock

`apps/api/test/unit/phase14-recovery.test.cjs` بررسی می‌کند عملیات Restore دارای سطح دسترسی، از PATH اجرا نشود؛ مسیر غیرمطلق، Symlink، فایل اجرایی یا پوشهٔ قابل‌نوشتن توسط دیگران رد گردد؛ کلید خصوصی `age` فقط فایل منظم با Permission محدود و مالک معتبر باشد؛ فایل عمومی CA با `0644` پذیرفته شود ولی Symlink یا Permission قابل‌نوشتن رد شود. این آزمون‌ها **واقعیت سرور PostgreSQL را شبیه‌سازی نمی‌کنند**.

## آزمون‌های واقعی معوق

JWT فاقد امضا یا منقضی، AuthSession لغوشده، Membership معلق، Cross-tenant BOLA/BFLA، جعل Consent، Staff booking غیرمجاز، دسترسی نادرست Trainer، MonitorGuard روی Ingress واقعی، XFF جعلی، Credentialهای Runtime و SECURITY DEFINER باید روی NestJS و PostgreSQL واقعی اجرا شوند.

Restore باید در Instance جدا، با binary ریشه‌مالک و مسیر پین‌شده، با `session_user` معتبر، مقصد Disposable و CA/TLS قابل‌اعتماد بررسی شود؛ وجود Checksum محلی به‌تنهایی امضای Publisher نیست. هیچ رخنهٔ عملیاتی با این تست‌های Pure «غیرقابل بهره‌برداری» اعلام نمی‌شود.
