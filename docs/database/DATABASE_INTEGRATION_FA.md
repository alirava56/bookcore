# اتصال دیتابیس — فاز سوم

**وضعیت:** SQL-first foundation پیاده‌سازی شده؛ اجرای PostgreSQL و همهٔ Constraintها همچنان `NOT VERIFIED`.

چهار Migration `001_core.sql` تا `004_history_consistency.sql` از آرشیو معتبر Phase 02 **بدون تغییر** منتقل شده‌اند. هیچ یک به‌عنوان Migration تولیدی تأییدشده معرفی نمی‌شود. لازم است روی PostgreSQL 17.6 در دیتابیس تازه، قبل از هر استفادهٔ مشتری، واقعاً اجرا و آزمایش شوند.

## Ledger و Transaction

- CLI مستقل `scripts/migrate.ts` فقط با `MIGRATION_DATABASE_URL` کار می‌کند و به `DATABASE_URL` نقش اپلیکیشن برنمی‌گردد.
- `bookcore_migrations(name, checksum_sha256, applied_at)` و `pg_advisory_xact_lock(...)` در تراکنش مشترک از تداخل اجرای هم‌زمان Migration جلوگیری می‌کند. دوباره اجرا کردن، checksum را مقایسه می‌کند؛ Drift با خطا متوقف می‌شود.
- Migrationهای قدیمی Phase 02 یک Ledger متفاوت به نام `spike_migrations` داشتند؛ این کد از آن استفاده نمی‌کند. انتقال یک دیتابیس قدیمی از spike به backend نیازمند برنامهٔ Migration مستقل و نباید بدون بررسی انجام شود.
- خطای قطع اتصال هنگام COMMIT ممکن است نتیجهٔ نامعلوم ایجاد کند. برای Migration، قبل از Retry باید Ledger را از اتصال جدید بررسی کرد؛ نتایج تجربی هنوز در دست نیست.

## Runtime

`DatabaseService` Pool را با سقف Connection مشخص و Timeout می‌سازد؛ Application Shutdown آن را می‌بندد. `UnitOfWork` از یک `PoolClient` برای BEGIN، SET LOCAL (با `set_config`)، اجرای Callback و COMMIT/ROLLBACK استفاده می‌کند. کد `40P01`/`40001` تنها با `severity=ERROR` و تلاش‌های محدود Retry می‌شود؛ Network COMMIT failure به `UnknownCommitOutcome` منتهی می‌شود و نیاز به بازیابی با Idempotency-Key همان درخواست دارد. اگر عملیات Idempotent نیست، Retry خودکارِ Callback نیز مجاز نیست؛ Use Caseهای آینده باید این شرط را مشخص کنند.

Readiness پیش از پاسخ `200`، Query واقعی برای مشاهدهٔ `bookcore_migrations` و `sessions` از طریق `to_regclass` می‌زند. این آزمون **آماده بودن دامنه، صحت داده و کامل بودن ۴ Migration را ثابت نمی‌کند**؛ فقط اتصال و وجود حداقل Schema را می‌سنجد. Database Owner و Runtime Role باید جدا باشند؛ DML Grant برای Runtime هنوز ایجاد نشده و نیازمند سیاست عملیاتی بعدی است.

## ریسک‌های ثبت‌شده

1. Trigger Deferred فاز دوم برای Booking History و ResourceAllocation با ترافیک هم‌زمان واقعاً تست نشده است.
2. Direct SQL خارج از UnitOfWork ممکن است دامنه را نقض کند؛ RBAC و نقش محدود لازم است.
3. `pgcrypto`، `btree_gist`، GiST Exclusion، SQLSTATE، Deadlock و Atomicity هنوز Proof تجربی ندارند.
4. اجرای Migration روی دادهٔ قبلی و ordering رخدادها نیازمند Backfill Audit است.
5. عدم دسترسی npm Registry مانع Typecheck/Build و تست PG در محیط تولید این خروجی بوده است.

**Next verification:** G1–G8 Phase 02 plus Phase 03 PG integration test and pool teardown. No production release before their success.
