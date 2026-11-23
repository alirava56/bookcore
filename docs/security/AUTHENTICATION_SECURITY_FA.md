# BookCore Phase 04 — Authentication Security

**مرجع پیاده‌سازی:** `apps/api/src/modules/identity/`، `common/security/`, `db/migrations/005_identity_security.sql`.

## رمز عبور و سیاست ثبت‌نام
- `argon2` با نوع `argon2id` و پارامترهای `memoryCost=19456 KiB (~19 MiB)`, `timeCost=2`, `parallelism=1` انتخاب شده است؛ اجرای بنچمارک حافظه و DoS به تعویق افتاده.
- Password حداقل ۱۲ و حداکثر ۱۲۸ کاراکتر با حروف کوچک، بزرگ، عدد و نماد؛ تطبیق خطا با RFC 9457. Plaintext یا Hash در پاسخ یا لاگ خروجی وارد نمی‌شود.
- کد در برابر ایمیلِ ناشناخته، Work Factor برای Argon2id انجام می‌دهد تا تفاوت زمانی کاهش یابد؛ این جایگزین کنترل در برابر Enumeration نیست.
- پاسخ Duplicate 409 مطابق قرارداد، از نظر Privacy ممکن است وجود حساب را افشا کند. Rate Limit و سیاست تجاری این افشا نیازمند بررسی است.

## JWT
- `jsonwebtoken 9.0.2` با **HS256 تنها**، `typ=JWT`, `kid` allowlist، `issuer`, `audience`, `sub`/`sid` UUID، `jti`, `type=access`, `exp` و TTL پیش‌فرض ۹۰۰ ثانیه.
- `AUTH_JWT_KEYS_JSON` حاوی کلیدهای متمایز با حداقل ۳۲ بایت است، و `AUTH_JWT_ACTIVE_KID` برای امضای توکن جدید انتخاب می‌شود. کلیدهای قدیمی تا انقضای توکن‌هایشان باید فقط برای Verify حفظ شوند؛ مدیریت/بازیابی Rotation در KMS جزو مراحل بعد است.
- هیچ الگوریتم انتخابیِ دریافت‌شده از Header به Verify داده نمی‌شود. توکن `none`, امضای نامعتبر، Expired، Issuer/Audience نامعتبر رد می‌شود.
- صرف JWT کافی نیست؛ `GlobalAuthGuard` برای **هر درخواست محافظت‌شده** Active AuthSession و Active User را در دیتابیس بررسی می‌کند. Middleware عمومی فقط متدهای مشخص با `@Public()` و `@MonitoringRoute()` را مستثنی می‌کند. Ready همچنان MonitorGuard دارای Secret و Allowlist شبکه دارد.

## Refresh Rotation و Replay
- Refresh ۳۲ بایت Random با `crypto.randomBytes()` و Encoding base64url است؛ تنها SHA-256 verifier آن در DB نگهداری می‌شود. به دلیل ۲۵۶ بیت Entropy، Hash مستقیم بدون Salt قابل دفاع است؛ هیچ Refresh plaintext در دیتابیس نیست.
- هر Refresh قدیمی با `consumed_at` مصرف و یک فرزند به Session/Family متصل می‌شود؛ Index یکتا روی `parent_id` از دو Child برای یک Parent جلوگیری می‌کند.
- Replay مصرف‌شده موجب Revocation Session و Invalidation خانواده می‌شود. **نکتهٔ حیاتی:** Service داخل تراکنش نتیجهٔ REPLAY برمی‌گرداند، سپس پس از Commit خطای 401 می‌دهد؛ Throw داخل TX باعث Rollback ابطال می‌شد.
- Logout Session را در DB revoke می‌کند، و JWT صادرشده از همان Session بلافاصله نامعتبر می‌شود. Session lifetime پیش‌فرض ۳۰ روز مطلق است.
- خطای شبکه هنگام COMMIT ممکن است نتیجهٔ نامعلوم ایجاد کند؛ `UNKNOWN_COMMIT_OUTCOME` با 503 برگردانده می‌شود. **Refresh پس از Commit نامعلوم پروتکل بازیابی کاملاً Idempotent ندارد**؛ Retry خودکار Refresh مصرف‌شده می‌تواند Session را به دلیل Replay revoke کند. این مورد باید قبل از عرضهٔ واقعی با Recovery UX/Protocol حل شود.

## Rate Limit و CORS
- جدول `auth_rate_limits` از UPSERT اتمیک دقیقه‌ای در PostgreSQL برای IP مستقیم و مسیر استفاده می‌کند؛ بودجه‌های پیش‌فرض Register=20، Login=10، Refresh=15 درخواست در دقیقه برای هر Direct Peer است. این IP می‌تواند Proxy باشد؛ در استقرار واقعی Rate Limit لایهٔ Edge و Key استاندارد کاربر/IP لازم است.
- درخواست‌های API فاقد Cookie و با Refresh در JSON هستند؛ CORS فقط allowlist، بدون wildcard و بدون credentials. هدرهای `Content-Type` و `Authorization` فعال شده‌اند.
- Body size 64kb (قابل تنظیم با کنترل صریح)، ValidationPipe whitelist + forbidNonWhitelisted، Problem Details بدون Query/Stack/Token، JSON Logging با CorrelationID.

## ریسک‌های امنیتی باقیمانده
خطر حملهٔ DoS روی Argon2، سیاست Email Confirmation، فقدان MFA، Abuse Rate Limit با NAT، Secret Rotation خارجی، CSRF در صورت تغییر به Cookie، شکست‌های واقعی PostgreSQL، بنچمارک concurrency و Unknown Commit همگی NOT VERIFIED یا deferred هستند. هیچ Penetration Test ادعا نشده است.
