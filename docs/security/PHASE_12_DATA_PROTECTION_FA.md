# ممیزی امنیت داده و Backup — Phase 12

**سطح دسترسی:** Backup واقعی شامل Hash رمز عبور، Refresh metadata و اطلاعات رزرو است؛ هر دارندهٔ Backup باید همان سطح حفاظتی پایگاه‌داده را رعایت کند. رمز در argv/Log نوشته نمی‌شود؛ اتصال libpq با `PG*` و Credential مستقل انجام می‌شود. Database Owner/Restore Role نباید رمز API داشته باشد.

**کنترل‌های اجراشده در کد:** دایرکتوری خصوصی 0700، فایل 0600، منع Symlink مستقیم، فایل موقت و Atomic Rename، SHA جریانی، Manifest مستقل، عدم Restore روی مقصد پر، نشانگر DB مستقل، Login binding با `session_user`، هدف allowlist و منع Remote/Production در Restore. دستورها با `spawn` و `shell:false` هستند. برای محیط‌های غیر development/test `age` الزامی است و کلید خصوصی در Artifact ذخیره نمی‌شود.

**ریسک‌های باقیمانده:** SHA256 بدون امضا Authenticity نمی‌دهد؛ Secure Erase فایل‌های قدیمی تضمین‌شده نیست؛ Snapshot منطقی Dump در مقابل تراکنش‌های جداگانه تست نشده؛ Secret Manager/KMS و Rotation اتوماتیک، ذخیرهٔ خارج از سایت، File system ACL و Audit مستقل اپراتور هنوز قابلیت اجرایی تأییدشده ندارند. Compose با `read_only`, `cap_drop` و `no-new-privileges` سخت‌تر شده ولی اجرای واقعی آن مشاهده نشده است.

**مدل تهدید:** Actor با دسترسی به Backup قادر به نشت اطلاعات است؛ Actor با دسترسی DB Restore می‌تواند اطلاعات را تغییر دهد؛ manifest tampering با Hash جدید فقط توسط امضای بیرون از همان مسیر قابل کشف است؛ Poisoned Archive باید قبل از Restore قرنطینه شود. اجرای PG tool با Login مستقل و محدود لازم است. هیچ HTTP Endpoint عملیاتی جدید ایجاد نشده است.
