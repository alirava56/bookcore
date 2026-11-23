# سخت‌سازی Backup و Restore — تغییرات اجرایی

- Backup Producer برای دادهٔ رمز‌شده فقط `age recipient` عمومی را لازم دارد. دیگر کلید خصوصی را روی میزبان تولید نیاز ندارد. نتیجهٔ رمز‌شده `ENCRYPTED_BACKUP_CREATED_DECRYPTION_UNVERIFIED` است؛ چک SHA و وجود فایل، اثبات رمزگشایی نیست.
- `pg_dump --version` باید PostgreSQL client major 17 باشد. از سرور واقعی `SHOW server_version_num` و `SELECT current_database()` خوانده می‌شود و نسخه/نام مغایر رد می‌شوند.
- Restore `BOOKCORE_RESTORE_ALLOWED_LOGIN` را با PGUSER و **`session_user` واقعی**، دیتابیس مقصد و `server_version_num` روی اتصال مقصد تطبیق می‌دهد؛ `pg_restore --version` و نسخهٔ ثبت‌شدهٔ `pg_dump` نیز کنترل می‌شود.
- اجرای Restore فقط روی `development/test`، مقصد Allowlist، تأیید صریح، نشانگر Disposable، Backup معتبر، نمونهٔ بازیابی جداگانه، و عدم Session رقیب در نقطۀ Preflight مجاز است. با این حال Query مربوط به Sessionها **جایگزین قفل خارجی و ایزولاسیون شبکه نیست**؛ تیم عملیات باید اثبات کند هیچ Writer دیگری به نمونهٔ دورریختنی دسترسی ندارد.
- برای remote TCP، `PGSSLMODE=verify-full` و CA معتبر ضروری است؛ Local Unix Socket مورد اعتماد یا Loopback طبق سیاست جداگانه مجاز است. مسیر Executableها در Production باید Absolute، قابل‌اجرا و بدون نوشتن Group/World باشد.
- SHA-256 Archive + Manifest به‌تنهایی Proof of Origin نیست. Verifier مستقل در محیط Production به `BOOKCORE_TRUSTED_MANIFEST_SHA256` از Store مورد اعتماد جداگانه نیاز دارد؛ منشأ/اعتبار آن Store همچنان باید عملیاتی اثبات شود.
- CLI می‌تواند از منظر کنترل، Restore Mock موفق را تشخیص دهد. **هیچ Restore واقعی و هیچ Replay WAL آزمایش نشده‌اند**. خطای بین Preflight و پایان Restore می‌تواند وضعیت مبهم داشته باشد؛ در هر خطای postcheck سرویس مقصد باید قطع بماند.

**ملاحظۀ امنیتی مهم:** `BOOKCORE_RESTORE_ISOLATED_INSTANCE=yes` تأییدیهٔ اپراتوری است، نه دفاع کافی در برابر مهاجم دارای دسترسی شبکه. Restore در Production پشتیبانی نشده است.
