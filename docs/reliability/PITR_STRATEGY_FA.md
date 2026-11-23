# راهبرد PITR برای PostgreSQL 17

Backup منطقی `pg_dump -Fc` قابلیت Replay WAL ندارد. برای Point-in-Time Recovery واقعی، به **Base Backup فیزیکی معتبر + زنجیرهٔ پیوستهٔ WAL** نیاز است. در محیط‌های آینده می‌توان از pgBackRest یا ابزار رسمی PostgreSQL با مخزن خارج از Host استفاده کرد؛ این Package پیاده‌سازی PITR و آرشیو WAL را ادعا نمی‌کند.

پیش‌نیازها: `wal_level=replica`، `archive_mode=on`، دستور `archive_command` معتبر با تأیید موفق Upload، مانیتور تأخیر/شکست Archive، نگه‌داری WAL تا تمام Base Backupهای وابسته، محافظت و رمزنگاری مخزن Backup و آزمایش بازیابی Timeline. `archive_command='true'`، بدون ذخیرهٔ WAL، **خطر ازدست‌رفتن داده** دارد و ممنوع است.

تمرین پذیرش: نصب PG17 ایزوله، تهیه Base Backup، انجام تراکنش A و ثبت زمان و LSN، انجام تراکنش B، توقف سرویس، Restore Base Backup و WAL با `recovery_target_time` بین A و B، سپس تأیید مشاهده A و عدم مشاهده B و سلامت Migration/Booking/Outbox. با ایجاد Timeline جدید، History قبلی را حذف نکنید. مستندکردن LSN و هش مخزن لازم است.

**وضعیت:** PREPARED DOCUMENTATION / PITR NOT VERIFIED. هیچ Base Backup، Archive WAL یا Replay واقعی انجام نشده است.
