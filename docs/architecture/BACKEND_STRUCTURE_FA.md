# ساختار بک‌اند BookCore — فاز سوم

## معماری واقعی

Backend فعلی یک **Modular Monolith** با NestJS و PostgreSQL است. تنها ماژول عملیاتی HTTP در این فاز `HealthModule` است. ایجاد ماژول‌های خالی Identity / Catalog / Scheduling / Booking HTTP / Reporting عمداً انجام نشده؛ وجود نام ماژول در معماری فاز اول به معنای پیاده‌سازی نیست.

- `apps/api/src/main.ts`: ورود، اعتبارسنجی Environment و graceful lifecycle.
- `bootstrap.ts`: Request ID، Header امنیتی، Body limit، CORS، ValidationPipe، ProblemFilter، Swagger محدود به مسیرهای اجراشده.
- `config/app-config.ts`: تنظیمات معتبر با Fail-fast؛ بدون مقدار پیش‌فرض برای URL دیتابیس یا کلید مانیتورینگ.
- `common/errors`: RFC 9457، پاسخ‌های بدون stack، SQL یا credential؛ Problem Details مستقل از DTOهای آینده.
- `common/security`: `DefaultDenyGuard` و مدل `AuthorizationPort`؛ جایگزین احراز هویت نیست، هیچ Protected Route باز نیست.
- `common/observability`: Request ID تولیدشده در سمت سرور؛ لاگ JSON شامل method، route pattern، status و duration؛ بدون بدنه/Query/Token.
- `infrastructure/database`: Pool با Lifecycle و Readiness واقعی طراحی‌شده؛ از دیتابیس متصل و وجود Schema اطمینان می‌گیرد.
- `infrastructure/transactions`: `UnitOfWork` با Connection واحد، تراکنش صریح، Timeout، Rollback، Retry محدود، تفکیک Unknown COMMIT.
- `modules/booking/booking-sql.adapter.ts`: **فقط Adapter داخلی** برای قفل Session و ثبت Outbox با کلاینت همان TX؛ هیچ Endpoint رزرو وجود ندارد و صحت Domain هنوز آزمایش نشده.
- `modules/health`: Liveness عمومی و Readiness محدود به IP/کلید.
- `scripts/migrate.ts`: Migrationهای Additive با Ledger checksum و Advisory Lock.

## مرزهای وابستگی

`HTTP Health -> DatabaseService -> PostgreSQL` و `Future Use Case -> UnitOfWork -> BookingSqlAdapter`. هیچ import تولیدی از Phase 02 testing fixture یا Harness وجود ندارد. Phase 02 در `reference/Phase_02/` تاریخچهٔ مستقل است؛ خود Migrationها byte-identical باقی مانده‌اند و تأیید نشده‌اند.

## کنترل و عدم قطعیت

- `READ COMMITTED` و Session-row `FOR UPDATE` از ADR-011 مشتق شده و هنوز نیازمند آزمایش هم‌زمانی روی PostgreSQL واقعی است.
- DB Adapter بدون Authorization واقعی نباید از مسیر HTTP فراخوانی شود.
- Redis، Microservice، Subscription، Payment، Waitlist و Web UI عمداً در این فاز وجود ندارند.
- Runtime Swagger فقط آنچه واقعاً در Controller وجود دارد تولید می‌کند؛ قرارداد کامل ۳۸ عملیات فاز اول در `docs/api/openapi.yaml` برای مراحل بعد حفظ شده است.
- پیش از اتصال Identity و Booking API، نیاز به تصمیم و تست دربارهٔ شناسه‌های tenant-safe، Permission revocation و isolation حیاتی است.
