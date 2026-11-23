# Phase 14 — محیط اجرا و مرز ایمنی

**حکم فعلی:** محیط حاضر Node.js `22.16.0` و npm `10.9.2` دارد، اما `docker`، `psql`، `pg_dump`، `pg_restore` و `age` در PATH موجود نیستند. هیچ اتصال واقعی به PostgreSQL 17 انجام نشده است.

## جداسازی محیط

فقط از دیتابیس مصنوعی و دورریختنی استفاده کنید. محیط `infra/docker/compose.phase14.disposable.yml` یک سرویس PostgreSQL 17 با Volume مستقل و Port لوکال `127.0.0.1:55433` دارد. قبل از راه‌اندازی، رمزهای **مستقل و تصادفی تستی** برای `PHASE14_OWNER_PASSWORD`، `PHASE14_APP_PASSWORD` و `PHASE14_WORKER_PASSWORD` تنظیم شوند. `BOOKCORE_TEST_DATABASE_DISPOSABLE=yes` فقط پس از تأیید حقیقی دورریختنی بودن هدف اعمال شود.

نقش Migration Owner باید از `bookcore_app` جدا باشد. برای آزمون‌های عملیاتی، حساب‌های مستقل Worker، Inspector، Maintenance و Recovery با دسترسی حداقلی لازم است؛ نبود این‌ها را با Superuser برای سرویس API دور نزنید.

## کنترل پیش از آزمون

`node scripts/phase14-runtime-preflight.cjs` وضعیت ابزارها را گزارش می‌کند و در صورت نبود زیرساخت Exit 2 می‌دهد. این دستور تنها بازرسی است و دیتابیس را تغییر نمی‌دهد. برای بازتولید کامل ابتدا Lockfile واقعی، بعد `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build` و مهاجرت روی مقصد جداگانه لازم است.

**ممنوع:** اتصال به دادهٔ مشتری، اجرای Restore روی Production، Push یا Deploy، استفاده از Credential واقعی در فایل/لاگ.
