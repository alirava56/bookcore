# Phase 14 — سازگاری PostgreSQL 17 و Migration

این مرحله هیچ Migration تازه‌ای اضافه نمی‌کند. `001` تا `012` به‌شکل بایت‌به‌بایت حفظ شده‌اند. کنترل Checksum فایل‌ها و Ledger محلی موفق بوده، ولی **اجرای SQL در PostgreSQL 17 انجام نشده است**.

در دیتابیس آزمایشی خالی ابتدا Roleها را با Migration Owner ایجاد کنید، نه با Credential API. `npm run migrate` را دوبار اجرا کنید؛ دفعهٔ اول باید هر Migration را Apply و بار دوم همان Checksumها را Verify کند. سپس جدول `bookcore_migrations` و نقش/Grantها را بررسی کنید.

تست‌های منفی باید Cross-tenant FK، GiST Exclusion، Capacity، Last Owner، تاریخچهٔ BookingEvent، Audit Immutability، Consent و Worker lease را با SQLSTATE واقعی بسنجند. برای Upgrade شامل دادهٔ مصنوعی موجود نیز باید History، Grantها و Outbox Receipts پس از مهاجرت معتبر باقی بمانند. هیچ Trigger یا Constraint قدیمی برای عبور تست تضعیف نشود.

ریسک شناخته‌شده: SQLهای 001–012 از مراحل قبل هیچ گواهی اجرای Real PG ندارند. نتیجهٔ Migration Gate در این مرحله `NOT VERIFIED` است.
