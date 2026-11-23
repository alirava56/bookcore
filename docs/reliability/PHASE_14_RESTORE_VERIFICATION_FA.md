# Phase 14 — سخت‌سازی Restore و معیار بازیابی

در `policy.cjs` انتخاب executable اکنون برای Restore/Verifier مستقل از `BOOKCORE_ENVIRONMENT` با `privileged:true` انجام می‌شود. `pg_restore`، `psql` و `age` باید مسیر مطلق پین‌شده، فایل عادی غیر Symlink، دارای بیت اجرا، مالک معتبر و بدون Parent Directory قابل‌نوشتنِ ناامن داشته باشند. برای Fixture تستی هم مسیر صریح الزامی است.

فایل خصوصی `BOOKCORE_AGE_IDENTITY_FILE` باید مسیر مطلق، فایل عادی، غیر Symlink، با Permission محدود، مالک مورد اعتماد و Parent قابل‌اعتماد باشد. `PGSSLROOTCERT` یک **گواهی عمومی** است و ممکن است `0644` باشد، اما نباید قابل تعویض توسط دیگران یا Symlink ناامن باشد. اعتبار نهایی اتصال با `verify-full` و TLS واقعی libpq است.

تست Recoverability هنوز انجام نشده است. پذیرش نهایی نیازمند `pg_dump` Custom واقعی، تأیید SHA از Store مستقل، Restore روی Instance ایزوله، تأیید `session_user`/`server_version_num`، Ledger، Grantها، BookingEventها، Outbox و دست‌کم یک بازیابی WAL/PITR واقعی است. بدون ایزولاسیون Writerهای بیرونی، Preflight چندمرحله‌ای به‌تنهایی تضمین اتمی Restore نیست.
