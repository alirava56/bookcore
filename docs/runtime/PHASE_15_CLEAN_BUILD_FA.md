# Phase 15 — بازتولید Build

**مبنای واقعی:** Node v22.16.0، npm 10.9.2، سیستم فایل محلی. بستهٔ ورودی با ۵۹۶/۵۹۶ هش معتبر آغاز شد.

ترتیب پذیرش: `npm install --package-lock-only` با Registry واقعی، ثبت Lockfile و Freeze مجدد Manifest، سپس `npm ci --no-audit --no-fund` در Workspace تمیز، `npm run typecheck`، `npm run lint`، `npm run build`، `npm run test:unit` و اجرای Bootstrap واقعی. همه باید با Exit Code صفر و خروجی خام ثبت شوند.

**نتیجه:** درخواست واقعی Lockfile پس از ۱۸ ثانیه به Timeout با Exit 124 رسید و Lockfile ساخته نشد. `npm ci --offline` به دلیل نبود Lockfile شکست خورد؛ Typecheck و Build به دلیل نبود type declarationها و پکیج‌های NestJS موفق نشدند. شکست در این بخش اثبات خطای TypeScript سورس نیست، ولی مانع قطعی Release است.

کد جدید `scripts/verify-manifest.cjs` دو حالت دارد: Release با موجودی کامل و SHA-256 سخت‌گیرانه؛ Workspace با بررسی تمام فایل‌های فهرست‌شده و اعلام صریح فایل‌های اضافه، بدون صدور گواهی بسته. `scripts/generate-manifest.cjs --write-release` فقط هنگام Freeze از بایت‌های واقعی Manifest تولید می‌کند. هیچ هش npm ساختگی وارد نشده است.

شواهد: `evidence/phase15/{npm-ci,typecheck,lint,build,preflight}.log` و `evidence/phase15/npm-lock-attempt.log`.
