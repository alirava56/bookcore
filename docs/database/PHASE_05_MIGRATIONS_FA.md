# BookCore — Migration 006 و سازگاری داده‌های قبلی

## لیست تغییر

`006_catalog_availability.sql` بعد از `005_identity_security.sql` اعمال می‌شود و ۰۰۱ تا ۰۰۵ **byte-for-byte بدون تغییر** می‌مانند. ستون `branches.address` اضافه می‌شود و CHECKهای نام/عنوان برای آینده به‌صورت `NOT VALID` اعمال می‌شوند تا داده‌های معتبر قبلی مانع Migration نشوند. دو جدول جدید `business_hours`, `schedule_exceptions` از FK مرکب Tenant، XOR target، CHECK زمان و ایندکس‌های محدود به Target استفاده می‌کنند.

- Function `p05_weekly_overlap` دو Rule هفتگی را با shift هفتگی مقایسه می‌کند؛ Trigger `p05_guard_business_hour` برای INSERT فعال با Lock ردیف Organization مسابقهٔ نوشتن را Serialize و هم‌پوشانی را رد می‌کند. UPDATE فقط active true → false است.
- `schedule_exceptions` دارای دو Exclusion Constraint با `btree_gist` روی `(tenant_id, target_id, tstzrange)` و `active` است. فقط deactivation مجاز است؛ رکوردهای قدیمی پاک نمی‌شوند.
- `p05_guard_trainer_resource` به‌صورت SECURITY DEFINER، Active بودن Membership مربی یا Branch اتاق را در لحظهٔ درج بررسی و اطلاعات هویتی Resource را غیرقابل تغییر می‌کند. Function باید از نظر Privilege و Lock Order روی PostgreSQL واقعی تست شود.
- GRANT: Runtime role مجاز به SELECT/INSERT و تنها UPDATE(active) دو جدول Rule است؛ مالک Migration متفاوت از Runtime باقی می‌ماند.
- `bookcore_migrations` برای نام/Checksum استفاده می‌شود و Ready بعد از به‌روزرسانی Checksum 006 را هم لازم می‌داند.

## یادداشت ریسک

`NOT VALID` فقط تضمین constraint برای ردیف‌های جدید/به‌روزشده است؛ همهٔ تاریخچهٔ قبلی را تأیید نمی‌کند. `VALIDATE CONSTRAINT` پس از ممیزی داده لازم است. هیچ اجرای SQL واقعی در این محیط ثبت نشده؛ syntax، triggerها، گرنت و Migration re-run نیازمند آزمون PostgreSQL 17 هستند.
