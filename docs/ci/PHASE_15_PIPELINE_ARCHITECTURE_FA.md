# معماری تست‌های CI — تفکیک مسئولیت

`backend-phase15.yml` شامل Job ساخت سورس و Job PostgreSQL17 دورریختنی است. هیچ تمرین Restore را در Job Integration عادی اجرا نمی‌کند. Runner `scripts/run-tests.cjs` سه دستهٔ `unit`، `integration` و `recovery` را تفکیک می‌کند. `phase12-backup-restore.test.ts` در مسیر معمولی حذف/تضعیف نشده؛ فقط از Test Discovery عادی جدا شده است.

`backend-phase15-recovery.yml` یک Workflow **فقط دستی** با ورودی صریح و Environment جدا به نام `bookcore-disposable-recovery` است. تنها پایگاه مبدأ و مقصد مصنوعی مجاز هستند؛ اجرای Restore باید با هویت مستقل، نسخهٔ PG17، ابزارهای pin‌شده و نتیجهٔ Ledger/ACL انجام شود. در صورت نبود Lockfile، کلاینت PG17، هویت یا Fixture لازم، Job باید fail/block شود؛ Skipped هرگز PASS نیست.

**وضعیت فعلی:** CI اجرا نشده است. YAML سند طراحی تست است، نه مدرک PASS. تست Runner با Fixture واقعاً اجرا و غیرفعال بودن اجرای ناخواستهٔ Recovery را اثبات کرد؛ این فقط تست محدودهٔ Runner است.

توجه: Workflowهای تاریخی برای ردیابی نگه داشته شده‌اند؛ تعریف GitHub branch-protection و required checks با مسئول انتشار است تا فقط Pipeline جاری به‌عنوان شرط Release استفاده شود.
