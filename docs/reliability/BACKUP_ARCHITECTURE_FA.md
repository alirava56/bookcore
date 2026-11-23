# معماری نسخهٔ پشتیبان BookCore — Phase 12

## پیاده‌سازی موجود

`scripts/recovery/backup.cjs` ابزار مستقل Node.js 22 است. ورودی: مسیر مطلق دایرکتوری خصوصی `0700`، اتصال صریح `PGHOST`, `PGUSER`, `PGDATABASE`، و مقدار retention (۱ تا ۳۶۵۰ روز). اتصال با ابزار رسمی `pg_dump` صورت می‌گیرد، رمز عبور فقط از محیط یا فایل امن libpq دریافت می‌شود و هرگز آرگومان فرایند نیست.

۱. شناسهٔ یکتا بر اساس UTC و UUID، فایل `.pending` با مجوز `0600` در مقصد خصوصی ساخته می‌شود.
۲. `pg_dump --format=custom --no-owner` اجرا می‌شود. خروج موفق فرایند الزامی است.
۳. در صورت تعیین `BOOKCORE_BACKUP_AGE_RECIPIENT`، خروجی به `age` stream می‌شود و **هیچ فایل Custom غیررمزشده‌ای روی دیسک باقی نمی‌ماند**. برای تأیید نتیجهٔ رمزگشایی، فایل هویت `BOOKCORE_AGE_IDENTITY_FILE` لازم است.
۴. با `pg_restore --list` ساختار Custom Archive بررسی می‌شود؛ این تأیید **معادل Restore نیست**.
۵. پس از `fsync` و محاسبهٔ SHA-256 جریانی، فایل از حالت pending به نام نهایی تغییر می‌کند. Manifest مستقل JSON با SHA-256، اندازه، زمان، نام دیتابیس، نسخهٔ pg_dump و retention به‌طور اتمی نوشته می‌شود.
۶. تا موفقیت تمام مراحل، خروجی موفق اعلام نمی‌شود؛ فایل‌های موقت در خطا حذف می‌شوند.

## مثال توسعه، بدون اطلاعات محرمانه

```bash
install -d -m 700 /var/backups/bookcore
export BOOKCORE_ENVIRONMENT=development
export PGHOST=127.0.0.1 PGUSER=bookcore_backup PGDATABASE=bookcore_test
# رمز از PGPASSFILE امن یا secret manager تامین شود.
node scripts/recovery/backup.cjs --dir /var/backups/bookcore --retention 30
node scripts/recovery/verify-backup.cjs --manifest /var/backups/bookcore/<backup-name>.dump.manifest.json
```

در محیط غیرآزمایشی encryption الزامی است؛ کلید خصوصی age باید خارج از Repository، روی رسانهٔ مستقل، با نسخهٔ Recovery کنترل‌شده نگه‌داری شود؛ چرخش Recipient پس از اثبات رمزگشایی نسخه‌های جدید انجام شود. دسترسی به Backup معادل دسترسی به اطلاعات حساس مشتری است. SHA-256 به‌تنهایی *اصالت در برابر مهاجم تغییر‌دهندهٔ Manifest* را ثابت نمی‌کند؛ ثبت هش در سامانهٔ مستقل/امضای سازمانی لازم است. این نسخه سیاست انتقال به Storage خارج از سایت یا S3 Object Lock را پیاده نکرده است.

**شواهد:** ابزار و آزمون‌های Mock اجرا می‌شوند، ولی هیچ Backup واقعی PostgreSQL در این محیط ایجاد نشده است. حکم: IMPLEMENTED source / RESTORE NOT VERIFIED.
