# Migration 011 — جزئیات و سازگاری

- فایل افزایشی: `db/migrations/011_operational_integrity.sql`؛ Migrationهای 001–010 با Hash ثابت باقی مانده‌اند.
- `bookcore_operator_identities`: ارتباط LOGIN دیتابیس و Global User؛ `enabled` پیش‌فرض false و فقط DBA/مالک Migration می‌تواند Provision کند.
- توابع `bookcore_requeue_outbox_bound`, `bookcore_list_quarantined_outbox`, `bookcore_inspect_tenant`, `bookcore_prune_auth_rate_buckets`: `SECURITY DEFINER` با `search_path=pg_catalog,public` و Role/Identity/Scope کنترل‌شده.
- گروه‌های `bookcore_inspector` و `bookcore_maintenance`: نقش‌های `NOLOGIN`، فقط اجرای توابع مجاز؛ نه Credential کاربردی مشترک.
- `bookcore_maintenance_audit`: تاریخچهٔ الحاقی با Trigger ممنوعیت تغییر؛ بدون DELETE خودکار.
- ایندکس `p10_outbox_receipts_tenant_type` برای شمارش Receipt به تفکیک Tenant/Type.
- دسترسی به تابع Legacy Recovery از `bookcore_ops` گرفته شده است؛ مهاجرت تاریخی حذف نشده است. Consumer قدیمی CLI که Actor UUID می‌پذیرفت دیگر سازگار نیست؛ جایگزین آن نسخهٔ bound است.

قابل نصب روی دادهٔ موجود به‌صورت Additive طراحی شده، اما **اعمال SQL، بازاجرا و تست Grant در PostgreSQL 17 هنوز NOT VERIFIED** است. پیش از استقرار نسخهٔ CI، لاگ Migration، بررسی عدم Schema Drift، برنامهٔ Rollback و تأیید نقش‌های مستقل ضروری‌اند.
