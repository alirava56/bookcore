# ADR-032 — Observability امن و تفکیک اعتماد در Recovery

**وضعیت:** Accepted for source implementation; Runtime verification deferred.

## مسئله

BookCore در فاز ۱۲ ابزار Backup/Restore اولیه داشت، اما کنترل Login واقعی، نسخهٔ PostgreSQL و استقلال کلید خصوصی age از میزبان Backup به‌اندازهٔ کافی enforce نمی‌شد. هم‌زمان برای بارسنجی رزرو به Metrics واقعی با محدودیت Cardinality نیاز بود. افزودن Metrics نباید گارد سراسری یا مرز Tenant را تضعیف کند.

## تصمیم

1. Metrics به‌صورت Counter/Histogram سبک و در RAM هر API Replica ثبت می‌شوند و فقط از مسیر `internal/metrics` پشت `MonitorGuard` قابل دریافت‌اند. IP مستقیم Socket و کلید جداگانه باید هم‌زمان معتبر باشند. Route Label فقط از قالب Handler و وضعیت از Status Class تولید می‌شود. Collector مستقل از HTTP کاربر است.
2. Admission Control بر اساس شمارندهٔ هم‌زمانی محلی **قبل از Controller** اعمال می‌شود. پاسخ 503 برای درخواست شروع‌نشده است و نتیجهٔ COMMIT درخواست دیگر را تغییر نمی‌دهد. Retry تراکنش همچنان محدود است.
3. Producer تنها Age Recipient Public را می‌گیرد؛ Recovery Verifier خصوصی باید جدا و مستقل باشد. Backup رمز‌شده روی Producer با عبارت `DECRYPTION_UNVERIFIED` ثبت می‌شود. اعتماد به اصالت Manifest از SHA خارجیِ مورد اعتماد ناشی می‌شود، نه SHA در همان پوشه.
4. اجرای Restore نیازمند Login مجاز، تطبیق واقعی `session_user` و دیتابیس مقصد، PostgreSQL major 17، نشانگر Disposable و نمونهٔ جدا از سرویس‌های Application است. اعلام ایزولاسیون از راه Environment به‌تنهایی مکانیسم امنیتی نیست و نیازمند اثبات شبکه/Host است.
5. Migrationهای ۰۰۱ تا ۰۱۲ تغییر نمی‌کنند. Index جدید بدون Plan واقعی ایجاد نمی‌شود.

## پیامدها و ریسک‌های پذیرفته‌نشده

- Metrics در چند Replica باید جدا Scrape و تجمیع شوند؛ Persist نمی‌شوند و هیچ‌کدام جایگزین Audit Event نیستند.
- Query-level tracing کامل، Metrics مستقل Worker برای Prometheus و اندازه‌گیری پیش‌فرض SLO هنوز ناقص‌اند.
- Race بین Preflight Restore و بازشدن Connection جدید **به‌طور کامل با Query لحظه‌ای حل نمی‌شود**؛ Restore حقیقی تنها روی نمونهٔ ایزولهٔ تأییدشده مجاز است.
- بدون PostgreSQL 17، age واقعی، npm و Workflow اجرایی، این تصمیم فقط پیاده‌سازی منبع است و Production release را مجاز نمی‌کند.

## آزمون پذیرش

نخست `npm ci`, Typecheck, Build و HTTP MonitorGuard واقعی؛ سپس Capacity 1/20 با دو پروسه و سه بار تکرار؛ سپس Backup رمز‌شدهٔ واقعی از Producer فاقد کلید خصوصی، بازیابی با Verifier مجزا، آزمون Login/Version/ACL و بازگردانی دادهٔ مصنوعی به PostgreSQL 17 ایزوله.
