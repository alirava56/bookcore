# BookCore — مدیریت Resource در Phase 05

- `TRAINER`: دقیقاً یک Resource برای `(tenant_id, trainer_user_id)`؛ `branch_id` ندارد و می‌تواند در چند شعبه کار کند. `trainer_user_id` باید به User فعال و Membership فعال با نقش TRAINER در همان سازمان ارجاع بدهد. Partial Unique Index از Migration 001 رقابت دو CREATE را نهایی می‌کند. Migration 006 با Trigger و قفل Membership جلوی دورزدن شرط Active در SQL مستقیم را در زمان INSERT می‌گیرد.
- `ROOM`: به Branch فعال همان سازمان تعلق دارد؛ `trainer_user_id` ندارد. کلید خارجی مرکب، ارجاع به شعبهٔ سازمان دیگر را رد می‌کند؛ Trigger 006 نیز هنگام ساخت، active بودن Branch را کنترل می‌کند.
- Buffer پیش/پس از فعالیت هر کدام در بازهٔ ۰ تا ۲۴۰ دقیقه است. در موتور Availability تنها پوشش Rule منابع بر اساس بازهٔ bufferدار سنجیده می‌شود؛ GiST Exclusion Constraint منابع در فاز ساخت Session همچنان مسئول جلوگیری از تخصیص تداخلی است.
- ارتباط type/branch/trainer و شناسه‌های کلیدی پس از درج غیرقابل تغییر است؛ برای اصلاح مالکیت باید Workflow مجزا طراحی شود. حذف سابقه در API موجود نیست.
- API GET منابع داخلی فقط برای OWNER/MANAGER/RECEPTIONIST است. `trainerUserId` یک شناسهٔ داخلی محسوب می‌شود و هیچ GET سراسری منابع برای TRAINER تعریف نشده. DTO تولیدی فقط فیلد ویژهٔ نوع انتخاب‌شده را دارد (`branchId` برای ROOM یا `trainerUserId` برای TRAINER) تا با `oneOf` منطقی قرارداد مطابقت کند.
- عضویت مربی پس از ساخت ممکن است لغو شود؛ FK تاریخی باقی می‌ماند. **در زمان ساخت Session** باید فعال‌بودن Membership مجدداً کنترل شود. این کار در Phase 05 انجام نمی‌شود.

## ریسک / نیاز به اثبات

Trigger 006 و هم‌زمانی INSERT منابع هنوز روی PostgreSQL 17 اجرا نشده‌اند. تست `catalog-postgres.test.ts` باید دقیقاً یک ردیف پذیرفته‌شده را با شمارش SQL تأیید کند.
