# BookCore Phase 04 — Migration 005

Migrationهای `001_core.sql`, `002_resource_guard.sql`, `003_hardening.sql`, `004_history_consistency.sql` بدون تغییر نگه داشته شدند؛ تغییر جدید تنها `005_identity_security.sql` است.

## تغییرات
- ایندکس یکتای normalized email با Preflight برای جلوگیری از تخریب دادهٔ Legacy
- `password_credentials` با FK محدودکننده به User
- `auth_sessions` و `refresh_tokens` با Unique Hash و Unique Parent Child، Session/Family، تاریخ مصرف/انقضا/ابطال، منع تغییر شناسه‌ها
- `auth_rate_limits` با Atomic UPSERT و Count مثبت
- `protect_last_active_owner` و تابع `lock_bookcore_organization`
- محدودسازی حق نوشتن به نقش `bookcore_app`؛ Role باید قبل از اعمال Migration وجود داشته باشد

## اجرا و بازتولید
```bash
npm install --package-lock-only --ignore-scripts
npm ci
npm run typecheck && npm run lint && npm run build
# PostgreSQL 17, bookcore_app role created before migration
npm run migrate
npm run migrate
npm run test:integration
```
این فرمان‌ها با دسترسی Registry و PostgreSQL واقعی قابل اجرا هستند؛ در محیط این نشست اجراهای کامل به علت نبود پیش‌نیاز موفق نشدند. Lockfile جعلی ساخته نشده است.

## اولویت تست‌های منفی DB
۱. Duplicate normalized email و حساب Legacy فاقد Password.
۲. App Role نتواند جدول‌های حساس را خارج از Grant بنویسد.
۳. دو Refresh هم‌زمان به دو Descendant معتبر منجر نشود.
۴. دو Owner نتوانند هم‌زمان هر دو خود را Revoke کنند.
۵. آخرین OWNER با SQL مستقیم قابل تنزل نباشد.
۶. تاریخچهٔ Audit و Booking Events قابل Delete/Update نباشند.
۷. Migration replay checksum ها را مقایسه کند.
۸. خواندن Tenant دیگر با 404/No Rows محدود شود.

**ریسک مهم:** Legacy Migrationهای فاز دوم تاکنون روی PostgreSQL واقعی آزمایش نشده‌اند. محاسبات Deferred Trigger و SQLSTATEها همچنان زیر Gateهای فاز دوم NOT VERIFIED می‌مانند.
