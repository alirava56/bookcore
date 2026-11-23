# گزارش آزمون هم‌زمانی BookCore

`npm run test:concurrency` دو پردازهٔ مستقل NestJS و یک PostgreSQL `17.6` را به کار گرفت. هر ردیف شامل ۱۰۰ درخواست مستقل است. خروجی خام در `evidence/final/final-cert.log` و توزیع‌ها در `evidence/final/capacity.json` قرار دارند.

| ظرفیت | تکرار | HTTP 201 | HTTP 409 با `SESSION_FULL` | P95 (ms) | P99 (ms) |
|---|---|---|---|---|---|
| 1 | 1 | 1 | 99 | 491.042 | 506.458 |
| 1 | 2 | 1 | 99 | 622.468 | 635.927 |
| 1 | 3 | 1 | 99 | 323.929 | 331.690 |
| 20 | 1 | 20 | 80 | 404.129 | 411.073 |
| 20 | 2 | 20 | 80 | 377.724 | 384.908 |
| 20 | 3 | 20 | 80 | 352.439 | 358.600 |

در هر اجرا `seats_committed`، تعداد Booking مؤثر، تعداد BookingEvent و تعداد Outbox با تعداد HTTP 201 برابر بودند. Booking مؤثر تکراری، 429، 5xx و timeout در این شش اجرا مشاهده نشد. کل زمان این بخش ۲۹۵۷٫۲۰ میلی‌ثانیه بود.

| سناریو | شاهد محلی |
|---|---|
| رزرو در مقابل کاهش ظرفیت، لغو Session و لغو Booking | `booking-postgres.test.ts` وضعیت نهایی Session، صندلی، تاریخچه و تعداد Outbox را بررسی کرد. |
| ثبت حضور در مقابل لغو | `phase11-mvp-http.test.ts` پس از FINISHED رقابت را اجرا کرد. حضور ثبت شد و لغو رد شد. |
| لغو رضایت در مقابل رزرو کارکنان، لغو عضویت در مقابل تغییر مجاز و پذیرش در مقابل لغو دعوت | `phase09-postgres.test.ts` پاسخ رقابت و آثار commit شده را تطبیق داد. |
| Refresh هم‌زمان و Refresh در مقابل Logout | `identity-tenant-postgres.test.ts` حداکثر یک چرخش و ابطال خانواده را بررسی کرد. |
| تکرار پس از از دست رفتن بدنهٔ HTTP و ACK نامعلوم COMMIT | آزمون Booking بدنه را نخواند و پاسخ را دوباره دریافت کرد. در آزمون Session، COMMIT در PostgreSQL واقعی انجام شد و خطای از دست رفتن ACK در مرز درایور تزریق شد. Replay فقط یک Session، Allocation و Outbox باقی گذاشت. |
| انقضای Lease، غیرفعال‌سازی Resource، نگه‌داری هم‌زمان و قطع اختیار اپراتور | `phase08-postgres.test.ts`، `sessions-postgres.test.ts`، `booking-postgres.test.ts` و `phase10-postgres.test.ts` آثار ثبت‌شده را بررسی کردند. |

در تمرین جداگانه یک Worker پس از ثبت claim با `SIGKILL` متوقف شد. Worker جایگزین پس از انقضای طبیعی Lease رویداد را گرفت. نتیجهٔ نهایی PostgreSQL دو تلاش، یک انتشار و یک Receipt بود. در اجرای موازی دیگر، دو پردازهٔ مستقل ۲۷ رویداد مصنوعی را با ۲۷ Receipt و Projection برابر ۲۷ پردازش کردند و هر دو با کد ۰ خارج شدند. شواهد در `evidence/final/worker-crash.log` و `evidence/final/workers.log` آمده‌اند.

در آزمون retry، قفل موقت PostgreSQL باعث timeout پردازش شد. Worker خطای `RETRYABLE_DATABASE_CONFLICT` و تلاش اول ناموفق را ثبت کرد. پس از backoff، تلاش دوم همان رویداد را موفق پردازش کرد. لاگ در `evidence/final/worker-retry.log` است.

این زمان‌ها به محیط موقت همین اجرا تعلق دارند و مبنای SLA تولید نیستند.
