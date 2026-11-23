# قرارداد پردازش at-least-once و Payload

منبع رویدادها سورس فعلی پروژه است؛ لیست شناخته‌شده در `EVENT_AGGREGATES` موجود است: `BookingConfirmed`, `BookingCancelled`, `BookingAttendanceRecorded`, `SessionDraftCreated`, `SessionPublished`, `SessionFinished`, `SessionCapacityChanged`, `SessionCancelled`, `OrganizationCreated`, `MemberAdded`, `MembershipChanged`, `BranchCreated`, `ServiceCreated`, `ResourceCreated`, `BusinessHourCreated`, `BusinessHourDeactivated`, `ScheduleExceptionCreated`, `ScheduleExceptionDeactivated`.

نسخهٔ ۱، Payload را یک Object محدود به ۱۶ کیلوبایت می‌داند. شناسهٔ معتبر Tenant و Aggregate از **ستون‌های پایدار رویداد** گرفته می‌شود، نه از متن Payload. پیوند Aggregate با Tenant در جدول اصلی بررسی می‌شود. اطلاعات دارای کلیدهایی شبیه Password/Token/Secret/Credential/Authorization رد می‌شوند؛ برای داده‌های قدیمی که الگوی کاملی ندارند باید قرارداد Type-specific سخت‌گیرانه‌تر در فاز Integration تثبیت شود. نوع ناشناخته Quarantine می‌شود، نه «تحویل موفق».

در Receipt فقط شناسهٔ رویداد، سازمان، Aggregate، Type، Schema-Version و زمان پردازش ذخیره می‌شود. External Handler فعلاً وجود ندارد. Idempotency مصرف‌کننده بر اساس `event_id` است. `Lease` در برابر claim هم‌زمان عمل می‌کند؛ Handler خارجی آینده باید کلید Idempotency همان رویداد را در سمت مقصد هم پشتیبانی کند.
