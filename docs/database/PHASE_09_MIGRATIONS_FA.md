# Database — Migration 010 Security Governance

## مرجع و توافق تاریخی
Migrationهای `001_core.sql` تا `009_outbox_delivery.sql` **بی‌تغییر** حفظ شده‌اند. Migration جدید `db/migrations/010_security_governance.sql` افزایشی است؛ ایجاد و صحت آن روی PostgreSQL واقعی هنوز `NOT VERIFIED` است. لیست هش‌ها در `apps/api/src/infrastructure/database/migration-checksums.ts` به‌روزرسانی شده است.

## ساختارها
- `staff_invitations`: UUID Identity ثابت، token verifier فقط SHA-256، Role enum محدود، حالات PENDING/ACCEPTED/DECLINED/REVOKED، یک Pending دعوت به‌ازای `(tenant_id,invitee_id)`.
- `booking_consents`: Consent مشتری جهانی برای Tenant با انقضا و ابطال، Unique unrevoked، FKهای مربوطه.
- `protect_governance_identity()`: BEFORE UPDATE/DELETE از Reparenting و تغییر تاریخچهٔ نهایی جلوگیری می‌کند؛ Mutationهای مجاز فقط وضعیت دعوت Pending و زمان ابطال رضایت فعال‌اند.
- `outbox_event_counters`: Projected count پایدار و غیرشخصی به تفکیک Tenant/Event Type؛ backfill از `processed_outbox_events` (بدون تکرار Side Effect).
- `bookcore_ops`: نقش غیرقابل Login با مجوز مستقل و تابع `bookcore_requeue_outbox` با `SECURITY DEFINER` و `search_path` ثابت، بررسی Membership فعال OWNER و Reason.

## اصل Least Privilege
`bookcore_app` برای جدول‌های دعوت/رضایت، SELECT/INSERT و فقط UPDATE ستون‌های وضعیت را دریافت می‌کند؛ `bookcore_worker` تنها مجوزهای لازم برای projection/خواندن metadata را دارد؛ `bookcore_ops` حق اجرای تابع Maintenance را دارد، نه دسترسی عمومی HTTP. Schema Owner و API Runtime نباید یکی باشند.

## دستورات تأیید عملی
از Runtime مجهز به PostgreSQL17 و npm Registry: ابتدا `npm install --package-lock-only` (با Registry حقیقی)، بعد `npm ci`، سپس `npm run typecheck && npm run lint && npm run build`، و `npm run migrate` با Migration Owner. Migration را در یک دیتابیس تازه و یک دیتابیس دارای دادهٔ واقعی فاز هشتم آزمایش کنید؛ یک بار دیگر برای Idempotency Ledger. سپس با اتصال `bookcore_app` UPDATE رفرنس ثابت، مستقیم‌نویسی AuditEvent، Grant غیرمجاز و DELETE تاریخچه را عمداً امتحان کنید؛ هرکدام باید Rollback شود. تست `phase09-postgres.test.ts` موجود است اما در این محیط اجرا نشده است.

## ریسک‌های آزاد
`SECURITY DEFINER`، Grants، Syntax تابع و پروتکل Deadlock باید **واقعاً اجرا** شوند؛ بررسی استاتیک SQL اثبات PostgreSQL نیست. تا پیش از اجرای این آزمایش‌ها، Gate مربوط به دیتابیس `NOT VERIFIED` می‌ماند.
