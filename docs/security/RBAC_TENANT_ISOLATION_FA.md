# BookCore Phase 04 — RBAC و جداسازی Tenant

## پیش‌فرضِ عدم دسترسی
Global `APP_GUARD` در `CommonModule` به `GlobalAuthGuard` وصل است. مسیرهای ناشناس فاقد Decorator عمومی باید 401 بدهند. `@Public` فقط روی Register/Login/Refresh و Live، `@MonitoringRoute` فقط روی Ready است. Ready علاوه بر Metadata دارای `MonitorGuard` مستقل است. تست‌های Source موجودند؛ Nest runtime تأیید نشده است.

## Authorization Engine
`TenantAuthorizationService` هویت حاصل از JWT و DB session را به Membership فعال Tenant وصل می‌کند. `tenantId`, `userId` یا `role` از Body هیچ‌گاه مجوز نمی‌شوند. در Writeها همان قفل‌های Session و Membership **داخل UnitOfWork** دوباره اعمال می‌شوند؛ Revocation بعد از گرفتن قفل نمی‌تواند عملیات جدیدِ دریافت‌کنندهٔ قفل را تأیید کند.

| Action | OWNER | MANAGER | RECEPTIONIST | TRAINER | غیرعضو |
|---|---|---|---|---|---|
| GET سازمان | اجازه | اجازه | اجازه | اجازه | 404 |
| GET لیست اعضا | اجازه | اجازه | 403 | 403 | 404 |
| POST عضو OWNER/MANAGER | اجازه | 403 | 403 | 403 | 404 |
| POST عضو RECEPTIONIST/TRAINER | اجازه | اجازه | 403 | 403 | 404 |
| PATCH نقش/وضعیت عضو | مجاز با Last Owner | فقط R/T بدون خود | 403 | 403 | 404 |

برای جلوگیری از TOCTOU، `GET organization` و Query لیست اعضا Membership Actor را در Query داده نیز بررسی می‌کنند. تغییر آخرین Owner با قفل Organization و PostgreSQL Trigger حفاظت می‌شود.

## DB Privileges و حد اعتماد
- `bookcore_owner` مالک Migration، `bookcore_app` کاربر Runtime با `GRANT`های محدود و بدون مالکیت Schema است.
- DB role حتی با مجوز Update بخشی از Membership، Principal HTTP را ذاتاً نمی‌شناسد؛ SQL Injection یا Credential Compromise می‌تواند Application RBAC را دور بزند. بنابراین Query پارامتری، Least Privilege، عدم افشای Runtime credential و تست Negative الزامی‌اند.
- تابع SECURITY DEFINER `lock_bookcore_organization` با search_path ثابت صرفاً قفل Tenant را دریافت می‌کند. Trigger آخرین OWNER از تغییر مستقیم Role/Status محافظت می‌کند.
- Role grants و رفتار Triggerها به دلیل نبود PostgreSQL واقعی NOT VERIFIED هستند و قبل از Pilot باید اثبات شوند.
