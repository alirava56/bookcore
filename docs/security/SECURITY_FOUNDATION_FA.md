# زیرساخت امنیت BookCore — فاز سوم

**امنیت پیش‌فرض:** پیش از ایجاد هر Protected API، احراز هویت واقعی و بررسی عضویت سازمانی باید برقرار باشد. `DefaultDenyGuard` همیشه 401 می‌دهد؛ نه Fake User و نه Bypass ساخته نشده است. هیچ Tenant ID ارسالی از Client مالکیت را ثابت نمی‌کند.

## بالفعل در سورس

- `parseConfig` با Fail-fast برای URL و رمز مانیتورینگ؛ مقادیر پیش‌فرض Secret وجود ندارند. در Production، Placeholderها رد می‌شوند و Swagger UI ممنوع است.
- `helmet` Headerهای امنیتی را در HTTP قرار می‌دهد؛ سقف Body و CORS allowlist اعمال می‌شوند. CORS هیچ جایگزینی برای Authorization نیست.
- ValidationPipe سراسری `whitelist=true`, `forbidNonWhitelisted=true`, `transform=false` دارد؛ DTO های Endpointهای آینده هنوز پیاده نشده‌اند.
- `ProblemFilter` پاسخ RFC 9457 را بدون پیام استثنای خام، Connection String، SQL یا Stack تولید می‌کند.
- Request ID از سمت سرور ایجاد می‌شود؛ Header ورودی به شناسهٔ مورداعتماد تبدیل نمی‌شود؛ لاگ بدنه و Headerها ثبت نمی‌کند.
- `/health/live` عمومی و فاقد دیتیل سیستم است. `/health/ready` به کنترل TCP peer IP **و** Header `X-BookCore-Monitor-Key` نیاز دارد؛ هش کلید با مقایسهٔ زمانی ثابت سنجیده می‌شود. `X-Forwarded-For` برای مجوز مانیتورینگ نادیده گرفته می‌شود.
- Session Resource/Tenant Authorization و JWT وجود ندارند؛ نباید این ماژول را production-auth نامید.

## Deferred security checks

1. تست HTTP واقعی با Dependencyهای نصب‌شده، کنترل Headerها، و عدم نشت Stack/SQL در 400/500/503.
2. بررسی Proxy واقعی و ریسک دسترسی مستقیم به Ready endpoint، نفوذ شبکه و allowlist.
3. تست cross-tenant FK، revoked membership، permission recertification و update concurrently.
4. DML Grant واقعی برای role کم‌دسترسی و جلوگیری از bypass Domain transitions.
5. ممیزی کنترل Secret در CI، Container و Logging؛ تست End-to-end پیش از انتشار.

منبع مرجع: `docs/security/THREAT_MODEL_FA.md` و `docs/security/AUTHORIZATION_MATRIX.md` از فاز اول، همراه با ADRهای فاز دوم در آرشیو مرجع.
