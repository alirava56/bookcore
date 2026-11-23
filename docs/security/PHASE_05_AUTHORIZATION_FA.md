# BookCore — محدودهٔ امنیتی Phase 05

## سیاست دسترسی

| قابلیت | OWNER / MANAGER | RECEPTIONIST | TRAINER |
|---|---|---|---|
| Branch / Service / Resource Create | مجاز | ممنوع | ممنوع |
| Branch / Service List | مجاز | مجاز | مجاز (فقط Tenant فعال) |
| Resource List (trainerUserId داخلی) | مجاز | مجاز | ممنوع 403 |
| Hours / Exceptions Create, Deactivate | مجاز | ممنوع | ممنوع |
| Hours / Exceptions List | کل Tenant | کل Tenant | فقط Resource نوع TRAINER متعلق به خودش؛ نه سایر منابع و نه ساعات شعبه |

تمام عملیات ثبت/اصلاح Rule، داخل یک تراکنش با قفل سازمان، بررسی AuthSession و Membership فعال و سپس Audit+Outbox انجام می‌شوند. Queryهای List علاوه بر Precheck، شرط Actor فعال و Role را در خود SELECT دارند. شناسهٔ Tenant یا Role از Body قابل اعتماد نیست. عملیات DELETE عمومی وجود ندارد.

## Hardened review از Phase 04

- گارد سراسری APP_GUARD و حالت پیش‌فرض 401 پابرجاست؛ مسیرهای جدید هیچ `@Public()` ندارند.
- **Refresh:** دو درخواست موازی با Refresh Token یکسان ممکن است یک Rotation و یک Replay ایجاد کنند و کل Session ابطال شود. بدون سازوکار قابل اتکای اثبات «درخواست تکراری معتبر» در برابر «توکن دزدیده‌شده»، سازش امنیتی (شُل‌کردن Replay Detection) پذیرفته نشده است. کلاینت باید Refreshهای هم‌زمان را Single-flight کند؛ پس از Commit نامعلوم یا پاسخ گمشده، Reauthentication لازم است و بازاستفاده کورکورانه Token خطر ابطال Family دارد. توسعهٔ پروتکل Recoverable باید پیش از Pilot بررسی شود.
- **Membership Consent:** `POST members` از Phase04 اجازهٔ درج کاربر موجود بر اساس UUID را می‌دهد، اما رضایت مستقیم او اثبات نشده است. توصیهٔ عملیاتی: این عملیات تا سامانهٔ Invitation/Acceptance فقط برای کارکنانِ بیرون از سیستم با موافقت قابل‌مستند اپراتور و بدون اعلان عضویت قطعی به کاربر استفاده شود؛ **این صرفاً رهنمود موقت است، نه کنترل enforce شده**. قبل از عرضهٔ عمومی، Invitation+Acceptance یک Blocker محصولی است.
- **Rate limit:** نگاشت IP با `request.socket.remoteAddress` است؛ spoofed X-Forwarded-For قابل اعتماد نیست. در Reverse Proxy، چندین کاربر NAT ممکن است در یک Bucket قرار بگیرند و 429 مشترک بگیرند. Ingress باید Rate Limit بر اساس هویتِ verified proxy و IP واقعی را مستقل اجرا کند؛ `auth_rate_limits` باید با Job دارای دسترسی مهاجرت از Bucket قدیمی پاک‌سازی شود. محیط چند Replica نیاز به تست واقعی مشترک DB دارد.
- **دسترسی مستقیم SQL:** محدودسازی Role در API جانشین RLS یا جلوگیری از Compromise Runtime credential نیست؛ این ریسکِ مانده از Phase04 تغییری نکرده است.

### نتیجه

همهٔ تست‌های HTTP/DB از جمله Race Membership Revocation و Visibility باید با PostgreSQL واقعی اجرا شوند. امنیت عملیاتی و Production Readiness هنوز `NOT VERIFIED` است.

**Maintenance operation (added):** `npm run auth:limits:prune` after successful Build, with `MIGRATION_DATABASE_URL` limited to the maintenance environment. It deletes only auth-rate buckets older than two days and does not execute automatically on application startup. For rate-limit abuse/spoofing, ingress policy remains required.
