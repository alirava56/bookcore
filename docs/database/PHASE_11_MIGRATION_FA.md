# Migration 012 — بازرسی Keyset و Event-Order

فایل افزایشی `db/migrations/012_integrity_inspection_paging.sql` هیچ‌یک از ۱۱ Migration قبلی را تغییر نمی‌دهد. Checksum آن در `apps/api/src/infrastructure/database/migration-checksums.ts` ثبت و با `verify-migration-checksums.cjs` بررسی می‌شود.

**تغییرات:** ایندکس tenant/id فقط برای Outbox (چهار جدول دیگر از قبل `UNIQUE(tenant_id,id)` دارند)؛ تابع `bookcore_inspect_tenant_page(uuid,text,text,timestamptz,int)` با صلاحیت LOGIN مستقل، حد ۱۰۰، Cursor مبتنی بر UUID یا EventType، شش نوع داده، تاریخچه کامل BookingEvent بر اساس `event_order` و تشخیص مشکلات اولیه/انتقال/پایان. `bookcore_inspect_tenant` قدیمی برای سازگاری فقط یک نمونه از Session/Booking را از تابع جدید می‌خواند و همیشه `completeScan:false` باقی می‌ماند.

**سازگاری داده‌های قدیمی:** Bookingهای قبل از اعمال Migration 004 ممکن است EventOrder backfilled با Chronology قطعی همخوان نباشد؛ هر Findings شامل `provenance:HISTORICAL_ORDER_UNVERIFIED` است و نباید اتوماتیک Repair شود. هیچ Event تاریخی اصلاح یا حذف نمی‌شود.

**Snapshot:** هر صفحه در تراکنش مستقل Read Only بررسی می‌شود. `asOf` مرز درج است، نه Snapshot سراسری؛ وضعیت رکوردهای موجود ممکن است بین صفحات تغییر کند. `coverageComplete` صرفاً پیمایش کلیدهای واجد شرایط است؛ `consistentSnapshot:false` و `certifiedIntegrity:false` همواره باقی می‌مانند.

**دستور اجرای آینده:** `npm ci`, `npm run build`, `npm run migrate` دوبار روی PostgreSQL 17، `npm run test:integration`؛ آزمون هم‌زمانی و اجازهٔ EXECUTE نقش‌های حقیقی. تا انجام این دستورات، صحت SQL `NOT VERIFIED` است.
