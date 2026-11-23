# Phase 14 — طرح آزمون End-to-End واقعی MVP

آزمون `apps/api/test/integration/phase14-runtime-smoke.test.ts` پس از Build باید روی PostgreSQL 17 دورریختنی اجرا شود: Bootstrap واقعی NestJS، `/health/live` عمومی، جلوگیری از `/me` بدون JWT، عدم دسترسی عمومی به `/health/ready` و `/internal/metrics` و وجود ۱۲ Migration در Ledger. این تست در محیط حاضر اجرا نشده است.

مجموعهٔ موروثی E2E نیز باید مسیرهای ثبت‌نام، Login، ایجاد Organization/OWNER، دعوت و پذیرش Trainer، Branch/Service/Resource، ساعات کاری، DRAFT/Publish، Booking مشتری، History، لغو، Consent برای عملیات کارکنان، Attendance، Reporting و Outbox را با **ردیف‌های Commitشده** بررسی کند؛ HTTP 200 به‌تنهایی کافی نیست.

تمام نقش‌های ناشناس، مشتری، Trainer، Receptionist، Manager، Owner و اپراتور مستقل را در سناریوهای مثبت و منفی پوشش دهید. خطاهای SQLSTATE، Timeout، Retry و Unknown Commit باید جدا ثبت شوند. هر Test بدون پیش‌نیاز واقعی باید fail-closed شود، نه Skip بی‌سروصدا.
