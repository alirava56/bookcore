# Phase 14 — نصب تمیز و بازتولید Build

۱. روی Node 22.16.0 و یک Registry معتبر و در دسترس، از ریشهٔ استخراج تمیز پروژه اجرا کنید: `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`. فقط npm مجاز به تولید Integrity Metadata است؛ Hash یا نسخهٔ بسته را دستی اختراع نکنید.

۲. فایل `package-lock.json` تولیدشده را در کنترل نسخه ثبت کنید. سپس در Checkout تمیز `npm ci --no-audit --no-fund`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit` را اجرا کنید. نبود فایل تست، تست Skipشده و Exit غیرصفر نتیجه را رد می‌کند.

۳. `npm run verify:reference`, `npm run verify:static`, `npm run test:phase14:isolated` را اجرا و لاگ خام نگه دارید. بررسی AST/Import به‌جای Typecheck واقعی نیست. پس از Build، `npm run openapi:current` فقط مسیرهای پیاده‌سازی‌شده را تولید می‌کند.

در این محیط ساخت Lockfile با Timeout (Exit 124) مواجه شد؛ `npm ci --offline` بدون Lockfile با Exit 1 شکست خورد؛ Typecheck به‌دلیل نبود Type Declarationها Exit 2 داشت؛ ESLint نصب نبود (Exit 127) و Build نیز شکست خورد. خطاها در `evidence/phase14` نگهداری شده‌اند. **هیچ اجرای موفق Build اعلام نشده است.**
