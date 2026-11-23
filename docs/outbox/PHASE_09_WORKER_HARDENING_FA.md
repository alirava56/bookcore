# Phase09 — سخت‌سازی Outbox Worker

## چه چیزی اصلاح شد؟
- `scripts/test-booking-domain-pure.cjs`: حذف عدد `# pass 5` ثابت و تحلیل TAP معتبر؛ خروجی Zero Test، Failed/Skipped/Cancelled را قبول نمی‌کند. ۶ تست Booking واقعاً PASS شده‌اند.
- `outbox.domain.ts`: قرارداد v1 به تفکیک نام و Aggregate؛ Payload خالی `BookingConfirmed` رد می‌شود. UUID/Status/Role/Kind و نسخه، فیلدهای ناشناس و کلیدهای حساس بررسی می‌شوند.
- **سازگاری تاریخی:** `OrganizationCreated` با `{}` و سایر Eventهای حداقلی صادرشده در سورس قبلی همچنان مجازند. شکل خاص قدیمی BookingConfirmed با `{id}` تنها برای Producer قدیمی حفظ شده است؛ این مدل برای Eventهای جدید توصیه نمی‌شود. Payloadهای ناسازگار بازنویسی خودکار نمی‌شوند.
- Worker دیگر Batch ۲۰ رکوردی را در Lease ۴۵ ثانیه پشت سر هم Claim نمی‌کند؛ BatchSize=1 اجباری است. UPDATE نهایی به مالک و Lease جاری وابسته و با `rowCount` سنجیده می‌شود.
- Projection جدید `outbox_event_counters` شمارندهٔ پردازش داخلی پایدار را پس از درج نخستین Receipt ثبت می‌کند؛ نه ارسال SMS/Webhook.

## وضعیت‌ها و ضمانت‌ها
Committed → Claim → Handler داخلى → Receipt/Projection/Processed و `published_at` در یک تراکنش. `published_at` **فقط رسید داخلی** است و ادعای تحویل خارجی ندارد. در Crash قبل از Commit، Lease منقضی می‌شود و Worker دیگر می‌تواند آن را بازیابی کند. در Crash بعد از Receipt، Unique Receipt مانع ثبت دوبارهٔ Projection می‌شود؛ این رفتار همچنان نیازمند اجرای واقعی دو Worker بر PostgreSQL است. مدل **At least once** است، نه Exactly once external delivery.

## قرنطینه و بازیابی
Event با شکست دائمی، راه Aggregate را تا رسیدگی ایمن مسدود می‌کند. CLI جدید `scripts/outbox-recovery.ts` با متغیر جداگانه `OUTBOX_OPS_DATABASE_URL` و role اختصاصی عملیاتی می‌تواند اطلاعات sanitized را فهرست یا با ID رویداد و Tenant/Actor/Reason آن را به صف برگرداند. تابع DB عضویت فعلی OWNER را دوباره بررسی و Audit ثبت می‌کند. هیچ Endpoint عمومی برای عملیات اضطراری وجود ندارد. Eventها حذف یا از ترتیب عبور داده نمی‌شوند.

## تست‌های لازم
اجرای حقیقی claims دو Worker، Lease expiry، Crash بعد از Receipt، Poison payload، SQL privileges، Lock timeout، Deadlock، Backlog و Timeout، Requeue آگاهانه. این‌ها به علت نبود PostgreSQL در این محیط `NOT VERIFIED` هستند. ابزارهای Safe Observability باید Tenant/Customer ID را به Labels عمومی Metrics اضافه نکنند.
