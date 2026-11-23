# طرح اجرای آزمون بار رزرو

منبع اجرا `apps/api/test/integration/booking-postgres.test.ts`، Worker مستقل `phase07-api-worker.cjs` و دستور `npm run perf:booking:postgres` است. برای آزمایش به Node 22، نصب واقعی npm، PostgreSQL 17 مهاجرت‌یافته و دیتابیس **کاملاً آزمایشی** نیاز است. هیچ آزمایشی روی تولید اجرا نشود.

سناریوها ۱۰۰ مشتری مجزا با ۱۰۰ کلید مجزای Idempotency هستند؛ دو پروسهٔ API NestJS با Pool مستقل ایجاد می‌شوند. ظرفیت‌های ۱ و ۲۰ هرکدام سه بار با Session تازه اجرا می‌شوند. ظرفیت مؤثر، شمارنده، BookingEvent، Outbox و عدم Duplicate Customer از رکوردهای Commit‌شده SQL بررسی می‌شوند.

هر دور فقط پس از مشاهدهٔ HTTP، شیء JSON `phase13_booking_contention` می‌نویسد که شامل ظرفیت، تکرار، تعداد، توزیع Status، `p50/p95/p99` برحسب میلی‌ثانیه و نتایج دیتابیس است. هیچ عدد آماده‌ای در سورس ثبت نشده است. خطای Spawn، Timeout یا Shutdown آزمون را FAIL می‌کند.

اجرای توصیه‌شده: از `npm ci && npm run build && npm run migrate` روی دیتابیس Disposable استفاده کنید، سپس `npm run perf:booking:postgres` را اجرا کرده و خروجی JSON/TAP را نگه دارید. به هر دور `pg_stat_activity` و `pg_locks` نیز با Timestamp جمع‌آوری شود. سناریوهای رقابت Cancellation، Capacity و AuthSession فعلاً صرفاً در تست‌های PostgreSQL دیگر تعریف شده‌اند و بدون اجرا `NOT VERIFIED` هستند.
