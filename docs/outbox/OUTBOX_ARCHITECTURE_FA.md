# معماری Worker تراکنشی Outbox

Worker یک Process مستقل از HTTP، در **همان Monolith و همان PostgreSQL** است؛ Queue یا Microservice مستقل ندارد. Outbox در مسیرهای دامنه و Audit در تراکنش تولید می‌شود. Migration `009_outbox_delivery.sql` فیلدهای `claimed_by`, `claim_started_at`, `failed_at`, `schema_version` و جدول رسید پایدار `processed_outbox_events` را اضافه می‌کند.

## پروتکل

1. Transaction کوتاه با `FOR UPDATE OF e SKIP LOCKED` برای رویدادهای آماده؛ `claimed_by` UUID یکتا، `lease_until` و `attempts` را اتمی می‌نویسد. Query دوم یک رویداد بازِ قدیمی‌تر از همان Tenant/Aggregate را بررسی می‌کند تا ترتیب پیش‌فرض رعایت شود.
2. Transaction دوم رویداد را **با همان Claim Owner و Lease معتبر** قفل می‌کند، schema-version و نوع و Payload و مرجع Aggregate متعلق به Tenant را اعتبارسنجی می‌کند و `processed_outbox_events` را با Unique(event_id) می‌نویسد؛ سپس `published_at` را در **همان COMMIT** ثبت می‌کند. Receipt غیرقابل ویرایش و حذف است.
3. خطای موقت تا ۸ تلاش با Backoff نمایی ۱ تا ۳۰۰ ثانیه و Jitter محدود تکرار می‌شود؛ خطاهای Payload/Type غیرمجاز و رسیدن به سقف تلاش به `failed_at` و کد خطای پاک‌سازی‌شده می‌روند. رویداد Failed حذف نمی‌شود.
4. پس از Crash و انقضای Lease، Worker دوم می‌تواند Claim را بازپس بگیرد. Worker قدیمی بعد از از دست دادن Lease حق Commit ندارد. Side Effect و `published_at` در یک DB Transaction هستند.

### محدودیت‌ها

`published_at` فعلاً به معنی **ثبت موفق Projection داخلی** است، نه ارسال ایمیل، SMS یا Webhook. تضمین «exactly once در شبکه» ادعا نمی‌شود. `created_at,id` ترتیب تقریبیِ ثبت رویداد را تعیین می‌کند، اما ترتیب قطعی Causal در تراکنش‌های هم‌زمان با Clock مستقل اثبات نشده است. اگر ترتیب قطعی per Aggregate لازم باشد، به Sequence تراکنشی اختصاصی نیاز است. رویداد FAILED قدیمی‌تر، رویدادهای بعدی همان Aggregate را تا بررسی Operator بلوکه می‌کند. هیچ رویدادی پاک نمی‌شود.

در صورت COMMIT نامعلوم Worker نتیجه را موفق فرض نمی‌کند. Lease منقضی می‌شود؛ Unique Receipt جلوی اثر ماندگار تکراری داخلی را می‌گیرد. تست واقعی این مسیر هنوز معوق است.
