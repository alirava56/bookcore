# Phase 14 — آزمون سخت‌گیرانهٔ ظرفیت و دو فرایند

Harness `apps/api/test/integration/booking-postgres.test.ts` برای هر یک از ظرفیت‌های ۱ و ۲۰، سه تکرار با ۱۰۰ مشتری یکتا و دو Child Process مستقلِ NestJS با Pool جدا دارد.

اصلاح فاز ۱۴: `verifyBookingContentionResults()` فقط پاسخ موفق `201` با شناسهٔ Booking و رد تجاری مستند `409 / SESSION_FULL` را می‌پذیرد. تعداد دقیق باید `capacity` موفق و `100-capacity` رد تجاری باشد. `503`، `429`، سایر `409`ها، پاسخ بدون ID، خطای Network و Timeout باید آزمایش را شکست دهند. `fetch` دارای Timeout ۲۰ ثانیه‌ای است.

بعد از هر تکرار، مقدار `seats_committed`، Bookingهای مؤثر، BookingEventها، Outbox و یکتایی مشتری از PostgreSQL خوانده می‌شوند. p50/p95/p99 فقط از Requestهای واقعاً اجراشده محاسبه شوند. Shutdown همهٔ Workerها باید با Exit 0 پایان یابد. سناریوی `1×201 + 99×503` اکنون در تست Pure فاز ۱۴ با خطا رد می‌شود.

هیچ Benchmark یا تأیید عدم Overbooking در این نشست انجام نشده است. نتیجهٔ C-01 و C-20 در حالت `NOT VERIFIED` می‌ماند.
