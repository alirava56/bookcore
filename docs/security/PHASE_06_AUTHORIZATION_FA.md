# Authorization و جداسازی Tenant — Phase 06

| عملیات | مجوز اصلی | کنترل نهایی |
|---|---|---|
| Create, Publish, Cancel, Finish, Capacity | OWNER / MANAGER فعال | قفل Organization و بازبینی AuthSession/Membership **داخل تراکنش** |
| Staff list/detail | OWNER/MANAGER/RECEPTIONIST | فیلتر tenant/status/role در همان SELECT |
| Trainer staff list/detail | TRAINER فعال، فقط Resource مربی خودش | شرط ارتباط trainer_user_id در همان SELECT؛ نه فقط Precheck |
| Public list/detail | بدون Login | `@Public` محدود + RateLimit و SELECT صرفاً ACTIVE tenant و PUBLISHED آینده |

Schema خروجی عمومی یک Allowlist مستقل با `id`, `serviceTitle`, `branchName`, `startAt`, `endAt`, `timezone`, `status`, `seatsAvailable` است. `tenantId`, شناسهٔ Room/Trainer, `seatsCommitted`, `capacityTotal` و `version` هرگز در Public Projection ساخته نمی‌شوند.

**بدون Staff Membership نقش CUSTOMER ساخته نشده است.** سرقت Token، HTTP BOLA، Cross-Tenant IDOR، تغییر نقش هم‌زمان و Direct SQL بدخواهانه باید در PostgreSQL/HTTP واقعی بررسی شوند. Endpointهای عمومی RateLimit مشترک با PostgreSQL دارند؛ کلید RateLimit از نام Handler ساخته می‌شود، نه UUIDهای کنترل‌شده توسط مهاجم در URL. Proxy و NAT calibration هنوز معوق است.
