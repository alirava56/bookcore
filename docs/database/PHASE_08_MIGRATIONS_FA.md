# Migration افزایشی 009 و مجوزها

Migrationهای 001–008 تغییر بایتی نکرده‌اند. `009_outbox_delivery.sql` فقط جدول/ستون/Index و Role لازم را اضافه می‌کند. Legacy `lease_until` که فاقد Owner بوده قبل از فعال‌شدن Constraint به NULL برگردانده می‌شود؛ این پاک‌سازی به معنی لغو Claim تاریخی از Worker تأییدشده نیست، چون قبل از فاز ۰۸ Worker عملیاتی نداشته‌ایم. در DB دارای Worker موازی، اعمال Migration باید در Window نگهداری انجام شود.

Role `bookcore_worker` NOLOGIN است؛ یک Login جداگانه با مجوز Role برای آن ایجاد می‌شود و API نباید از آن Credential استفاده کند. در Compose توسعه، Login با نام `bookcore_worker_login` توسط init-db.sh ایجاد و در Migration Role به آن تفویض می‌شود. در Production باید Role Management مستقل انجام شود و نباید رمزهای توسعه بازاستفاده شوند. Worker فقط SELECT روی Aggregateهای لازم و INSERT/SELECT در Receipt و UPDATE ستون‌های Delivery در Outbox دارد؛ INSERT/DELETE/UPDATE روی Audit یا Booking در اختیار Worker نیست.

Index `outbox_claimable_v1` برای Poll و `outbox_aggregate_order_v1` برای Predecessor Check تعریف شده‌اند. `processed_outbox_events` یک PK روی event_id دارد و FKها با `ON DELETE RESTRICT` تاریخچه را نگه می‌دارند. Check قفل جاری و وضعیت terminal، از نگهداری مالک Claim بعد از انتشار یا Failure جلوگیری می‌کند. سازگاری با DB پر از داده، Grant واقعی و عملکرد PostgreSQL 17 نیازمند تست؛ صرف تحلیل SQL اثبات Runtime نیست.
