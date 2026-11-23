# بازگردانی کنترل‌شدهٔ BookCore

## اصل ایمنی

`restore.cjs` با پیش‌فرض Dry Run کار می‌کند؛ مجوز Restore از یک `--force` ساده به‌دست نمی‌آید. برای اجرای واقعی: `BOOKCORE_ENVIRONMENT=test|development`، میزبان Local/Unix Socket، اسم مقصد در allowlist مستقل `BOOKCORE_DISPOSABLE_RESTORE_TARGET`، تأیید صریح `BOOKCORE_RESTORE_ACK=RESTORE_DISPOSABLE:<db>`، هویت Login مطابق `BOOKCORE_RESTORE_ALLOWED_LOGIN` و `PGUSER`، و PostgreSQL **17** الزامی‌اند. هدف باید در `COMMENT ON DATABASE` نشانگر `bookcore-disposable-restore-v1` داشته باشد و در schema `public` جدول، view یا sequence نداشته باشد.

اجرای Restore به یک دیتابیس موجود حاوی داده، میزبان راه‌دور یا محیط Production **در این ابزار پشتیبانی نمی‌شود**. برای بحران واقعی Production، DBA باید محیط جایگزین ایزوله بسازد و پس از اثبات Recovery فرآیند Switch-over مستقل را اجرا کند.

## آماده‌سازی توسط DBA روی دیتابیس ساختگی

```sql
-- فقط روی سرور تست؛ DBA باید ابتدا دیتابیس جدید و خالی بسازد:
COMMENT ON DATABASE bookcore_restore_sandbox IS 'bookcore-disposable-restore-v1';
```

```bash
export BOOKCORE_ENVIRONMENT=test
export PGHOST=127.0.0.1 PGUSER=bookcore_restore PGDATABASE=bookcore_source_test
export BOOKCORE_DISPOSABLE_RESTORE_TARGET=bookcore_restore_sandbox
export BOOKCORE_RESTORE_ALLOWED_LOGIN=bookcore_restore
export BOOKCORE_RESTORE_ACK=RESTORE_DISPOSABLE:bookcore_restore_sandbox
node scripts/recovery/restore.cjs --manifest /secure/backups/<name>.dump.manifest.json --target-db bookcore_restore_sandbox
# بعد از تأیید DBA و backup مستقل:
node scripts/recovery/restore.cjs --manifest /secure/backups/<name>.dump.manifest.json --target-db bookcore_restore_sandbox --execute
```

ابزار پیش از اجرای Restore اندازه، SHA-256، ساختار Custom و در حالت رمز‌شده نتیجهٔ decrypt را تأیید می‌کند؛ سپس `pg_restore --single-transaction --exit-on-error --no-owner` را اجرا می‌کند. پس از Restore، جدول `bookcore_migrations` با Checksum سورس مقایسه می‌شود. هر شکست Exit 1 می‌دهد؛ هیچ ادعایی دربارهٔ Consistency Domain بدون اجرای Inspector و تست‌های جدا ندارد.

## چک‌لیست بازکردن ترافیک

نسخهٔ PostgreSQL و Roleها، Migration ledger، ظرفیت/BookingEvent، حق دسترسی کارکنان و مشتری، Outbox receipt، زمان بازگشت Worker، اعتبار JWT و ریسک Tokenهای معتبر قبل از حادثه را بررسی کنید. در Restoration از نسخهٔ قدیمی، احراز هویت و idempotency به‌ویژه به بازبینی امنیتی نیاز دارند. *Restore و Cutover واقعی در این مرحله اجرا نشده است.*

### Role and privilege restoration

در Source Backup، GRANT/ACL حفظ می‌شود؛ پیش از Restore، DBA باید Roleهای موردنیاز (از جمله `bookcore_app` و `bookcore_worker`) را با هویت مستقل و بدون Credential واقعی Source فراهم کند. ابزار Restore پس از عملیات، توانایی SELECT/INSERT روی Booking و SELECT Worker روی Outbox و عدم مالکیت جدول توسط نقش API را بررسی می‌کند. اگر Roleها یا ACLها موجود نباشند، نتیجه **FAIL** است، حتی اگر Ledger سالم باشد. در بازگردانی Production، آزمون جامع همهٔ GRANTها و RLS/Triggerها نیز مستقل لازم است.
