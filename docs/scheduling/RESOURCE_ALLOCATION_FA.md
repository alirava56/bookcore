# تخصیص منابع — Phase 06

- **منبع TRAINER:** یک Resource واحد در سطح Tenant، قابل‌استفاده در شعب متعدد. عضویت فعال و نقش TRAINER هنگام Create/Publish لازم است.
- **منبع ROOM:** Branch معتبر و هم‌سازمانی باید با Branch Session برابر باشد.
- **قرارداد زمان:** `[start_at - buffer_before, end_at + buffer_after)` با `tstzrange` و GiST EXCLUDE برای تخصیص فعال.
- **DRAFT:** منابع را واقعاً رزرو می‌کند. ایجاد هم‌پوشان بدون دورزدن DB ممنوع است.
- **CANCELLED:** با deactivated_at و active=false آزاد می‌شود ولی تاریخچهٔ Allocation پاک نمی‌شود.
- **قفل‌ها:** ابتدا قفل سازمان (هماهنگ با Catalog Rule Mutation و Membership)، سپس نشست/عضویت، سپس منابع به ترتیب UUID، سپس Session در تغییر وضعیت. GiST و Deferred Trigger مرجع نهایی هستند.

تغییر قوانین جدید، Sessionهای موجود را خودکار باطل نمی‌کند. ابهام مهم برای Spike: تعامل قفل سازمان و Session با مسیر آیندهٔ Booking (Phase 02) باید در اجرای چندپردازشی سازگار شود. در Phase 06 هیچ Booking Creation API ایجاد نشده است.
