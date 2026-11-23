# ممیزی امنیت نهایی BookCore — Phase 16

**دامنهٔ بررسی:** سورس دقیق Checkpoint فاز ۱۵ و اصلاحات Phase16؛ تحلیل Static/AST، اسکریپت‌های امنیتی و تست‌های Pure. OWASP API Security Top 10 به‌عنوان چک‌لیست مرور استفاده شد، **نه مدرک Penetration Test واقعی**.

## یافتهٔ اصلاح‌شده SEC16-01 — P2، انتخاب باینری در Backup Producer

- **پیش‌نیاز حمله:** دسترسی به محیط اجرای Producer و توان تغییر PATH یا یک executable پیشوندی.
- **کد:** `scripts/recovery/backup.cjs` پیش از اصلاح، در محیط Test/Development از `tool(name,env)` با مسیر PATH استفاده می‌کرد؛ دسترسی pg_dump به کل داده حساس است.
- **اصلاح:** برای `pg_dump`, `psql`, `pg_restore`, `age` همیشه `tool(name,env,{privileged:true})`. این سیاست مسیر مطلق، مالکیت مورداعتماد، عدم symlink، Permission فایل و پوشهٔ اجدادی را کنترل می‌کند.
- **Regression:** `apps/api/test/unit/phase16-recovery-policy.test.cjs`، سه تست واقعی Node با نتیجه PASS؛ تست‌های Mock موروثی Phase12/13 با Fixtureهای pin‌شده حفظ و دوباره اجرا شدند.
- **ریسک باقیمانده:** اعتماد سیستم‌عامل به باینری و محیط Runner، صحت واقعی اتصال PG17/age و پذیرش Policy در Runtime هنوز NOT VERIFIED است.

## امنیت احراز هویت و مجوز

سورس `AppModule` دارای APP_GUARD و `GlobalAuthGuard` است؛ Identity شامل JWT، نشست و Refresh و Governance شامل دعوت/Consent است. ادعای صحت عملی Session Revocation، Cross-tenant، Last-owner، BOLA و race بدون PostgreSQL/HTTP مجاز نیست. Scope مربی و مجوز عملیات حساس باید با HTTP منفی و رکوردهای واقعی تست شود. **S01–S03 و S05–S07: NOT VERIFIED.**

## امنیت داده و بازیابی

Scan محدود Regex فاز ۱۶ روی ۴۱۲ فایل متنی هیچ نشانه‌ای از الگوهای کلید خصوصی/PAT موردنظر پیدا نکرد؛ این اسکن، تشخیص جامع secrets یا audit وابستگی‌ها نیست. مسیرهای Backup/Restore جداسازی Actor، TLS، کلید age، Manifest Provenance و مقصد Disposable را در سطح سورس دارند، ولی به‌دلیل نبود PG17 و ابزارها، اجرای واقعی و جداسازی Writerها اثبات نشده است.

## ابهام‌های اولویت‌دار

JWT/Refresh unknown-COMMIT، revoke رقابتی، Race ظرفیت و Last-owner، Roleهای SECURITY DEFINER، دو Worker با Lease Expiry، operator binding و نبود npm Lockfile هرکدام مستقل Release Blocker هستند. هیچ‌یک به PASS ارتقا داده نشده‌اند.
