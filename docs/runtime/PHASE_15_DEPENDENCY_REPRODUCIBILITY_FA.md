# سیاست بازتولیدپذیری وابستگی‌ها

`package.json` دارای نسخه‌های صریح NestJS، TypeScript، Node22 و ابزار PostgreSQL است؛ اما بدون Registry و Lockfile معتبر، صحت سازگاری نسخه‌ها اثبات نشده. نسخه‌های نصب‌شده، Integrity واقعی و Advisoryها را نمی‌توان از فهرست دستی حدس زد.

تولید Lockfile فقط از npm و Registry واقعی مجاز است. هنگام حصول دسترسی شبکه: `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`، سپس اعتبار Lockfile، `npm ci` از مسیر تمیز، اجرای Build و تهیه SBOM به کمک یک ابزار نصب‌شده. اگر Registry، DNS یا Proxy دسترسی را رد کرد، Exit Code و خروجی خام ثبت شود.

یک Lockfile اضافه‌شده به بستهٔ قبلی، عمداً اعتبار Manifest قبلی را باطل می‌کند؛ Freeze بعدی باید Manifest جدید را از کل محتوای واقعی بازتولید کند. این رفتار در تست‌های Phase15 بررسی شده است.
