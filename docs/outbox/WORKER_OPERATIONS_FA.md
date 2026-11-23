# Runbook عملیاتی Worker

**پیش‌نیاز:** PostgreSQL 17، npm Registry، Lockfile تولیدشده با npm واقعی، Migrationهای 001–009 روی DB تازه/ارتقایافته و Login عضو Role محدود `bookcore_worker`. هیچ Credential واقعی داخل ZIP قرار ندارد.

## اجرا و توقف

1. از ریشهٔ پروژه `npm install --package-lock-only && npm ci && npm run typecheck && npm run build` را اجرا کنید.
2. `MIGRATION_DATABASE_URL` را فقط در محیط Maintenance تنظیم و `npm run migrate` را **دو بار** اجرا کنید تا Hash Ledger بررسی شود.
3. `OUTBOX_DATABASE_URL` متعلق به Login Worker را تنظیم و `npm run outbox:worker` را اجرا کنید. در Docker: `docker compose -f infra/docker/compose.yml --profile worker up -d worker`. برای توقف SIGTERM بفرستید؛ Pool پس از پایان Batch بسته می‌شود. Kubernetes و مدیریت‌های پیچیده در MVP وجود ندارند.
4. لاگ‌های JSON فقط `claimed`, `processed`, `failed`, `durationMs` و Snapshot دوره‌ای `pending`, `failed`, `oldestPendingSeconds`, `retries` را دارند؛ هیچ Payload یا UUID کاربر Log نمی‌شود.

## بازیابی

- **Crash پیش از Handle:** تا پایان Lease صبر کنید؛ Claim بعدی همان رویداد را می‌گیرد.
- **Crash پس از COMMIT:** Receipt و `published_at` با هم هستند؛ دوباره اثر داخلی ساخته نمی‌شود.
- **Backlog غیرعادی:** اتصال و Grantهای Worker، Lock Timeout، قدیمی‌ترین `created_at` باز و رکوردهای `failed_at` را بررسی کنید. معیار هشدار و p95 نیازمند اندازه‌گیری میدانی است.
- **Quarantine/Poison Event:** ابتدا علت را رفع و صحت Payload/Schema را کنترل کنید. فقط Operator دارای دسترسی Maintenance می‌تواند با یک رویهٔ Auditشده `failed_at`, `last_error_code`, `available_at` را بازنشانی کند. هرگز رویداد را حذف نکنید؛ پس از آن، ترتیب Aggregate از سر گرفته می‌شود.
- **Duplicate مشکوک:** Unique Receipt و وضعیت COMMIT را با Query مستقیم بررسی کنید. از تکرار بی‌رویهٔ Worker یا Reset همهٔ Leaseها خودداری کنید.
- **DB outage:** Worker خطای سالم‌شده چاپ می‌کند و Poll بعدی انجام می‌شود؛ هیچ PASS کاذبی اعلام نمی‌شود. اقدام مداخله باید با اصل least privilege باشد.

**خطر عملیاتی:** اگر Handler آینده Network I/O انجام دهد، آن را خارج از Transaction Claim نگه دارید و برای تمدید Lease و Timeouts، طراحی جدید انجام دهید. Worker فعلی فقط پردازش داخلی دیتابیسی دارد.
