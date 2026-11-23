# ممیزی معماری نهایی

**مشاهدهٔ مستقیم:** `apps/api/src/app.module.ts`، ماژول‌های Identity، Organizations، Governance، Catalog، Scheduling، Booking، Reporting، Observability، Database، Health و Common را در DynamicModule وارد می‌کند. `CommonModule` دارای `APP_GUARD` با `GlobalAuthGuard` است. Outbox Worker از Process مستقل در همان مخزن استفاده می‌کند؛ معماری ظاهراً Modular Monolith است.

**مرز اثبات:** سورس و Import نسبی ۱۱۵ فایل TypeScript بدون خطای AST/مسیر بررسی شدند، اما Dependency Injection واقعی، حلقه‌های runtime، Connection release، Startup/Shutdown و Client pool روی NestJS اجرا نشده‌اند. بنابراین Compose/Bootstrap هنوز NOT VERIFIED است.

**تراکنش‌ها و coupling:** Session/Booking از UnitOfWork و DatabaseService مشترک استفاده می‌کنند؛ P02 تراکنش‌ها و قفل‌های PostgreSQL مرجع هستند. اثبات ترتیب قفل و consistency تحت رقابت تا اجرای تراکنش‌های هم‌زمان ممکن نیست. Outbox درون DB دوام دارد ولی Worker چندفرایندی هنوز تست نشده است. هیچ Microservice جدیدی ساخته نشده است.

**اصلاح معماری/ممیزی Phase16:** Inventorی Phase11 فقط `modules/` را اسکن می‌کرد؛ مسیر `GET /api/v1/internal/metrics` در `common/observability/` از فهرست خارج بود. اسکریپت مستقل `phase16-controller-inventory.cjs` اکنون تمام Controllerها را می‌بیند: **۴۷ مسیر سورس، ۴۶ مسیر مطابق قرارداد طراحی، یک مسیر خصوصی Metrics**. آن Route دارای `@MonitoringRoute` و `@UseGuards(MonitorGuard)` است؛ اجرای Guard هنوز آزمون HTTP ندارد.
