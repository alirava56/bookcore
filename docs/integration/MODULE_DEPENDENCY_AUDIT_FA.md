# ممیزی Composition و وابستگی‌های BookCore

`AppModule.forRoot(config)` ماژول‌های `AppConfigModule`, `DatabaseModule`, `IdentityModule`, `OrganizationsModule`, `GovernanceModule`, `CatalogModule`, `SessionModule`, `BookingModule`, `ReportingModule`, `CommonModule`, `HealthModule` را بارگذاری می‌کند. `CommonModule` دارای `APP_GUARD` سراسری با `GlobalAuthGuard` است؛ تنها Routeهای دارای `@Public()` و Readiness دارای `@MonitoringRoute()` استثنای مصوب هستند. Worker در `scripts/outbox-worker.ts` فرآیند مستقل است و Controller HTTP برای آن ثبت نشده است.

**مرزهای DB:** همهٔ Business Writeها باید از `UnitOfWork` و `PoolClient` همان تراکنش استفاده کنند. `ReportingService` یک کوئری تجمیعی مستقل دارد؛ CLI عملیاتی باید Credential جدا از API/Worker و `BEGIN READ ONLY` داشته باشد. APIها تنها از `@CurrentPrincipal()` هویت می‌گیرند، نه از Role/UserId ادعایی درخواست.

**شواهد اجراشده:** اسکن AST تعداد ۴۶ Route را با ۴۶ Operation طراحی مطابقت داد، ۱۰۴ فایل TypeScript را از نظر Syntax/Import نسبی بررسی کرد و نبود Route اضافی/تکراری را گزارش نمود. **محدودیت:** DI و چرخهٔ عمر NestJS و این‌که APP_GUARD در Runtime واقعاً اعمال می‌شود، تا زمان نصب وابستگی‌ها/اجرای HTTP قابل تأیید نیستند. `npm run openapi:current` نیز اجرا نشده است.

**موارد باز:** Runtime Composition، AuthSession revocation race، role validation، CORS behind ingress، قفل‌های Cross-Module، و نصب مستقل npm. هیچ Circular Dependency با اجرای NestJS آزمایش نشده است.
