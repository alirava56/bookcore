# فهرست Metrics در سورس

| نام Prometheus | نوع | منبع | توضیح و محدودیت |
|---|---|---|---|
| `bookcore_http_requests_total` | Counter | Middleware واقعی HTTP | method و route template و status_class؛ بدون ID |
| `bookcore_http_request_duration_seconds` | Histogram | HTTP finish/close | تأخیر واقعی تا پایان پاسخ؛ اندازهٔ Payload ثبت نمی‌شود |
| `bookcore_http_inflight` | Gauge | Middleware | درخواست فعال در همین فرایند؛ نمونهٔ بین Replicaها نیست |
| `bookcore_db_pool_connections` | Gauge | `pg.Pool` | total/idle/waiting هنگام Scrape؛ در دسترس‌نبودن DB را بررسی نمی‌کند |
| `bookcore_db_operation_duration_seconds` | Histogram | اتصال Pool و UoW | acquisition و transaction؛ نه تمام Queryهای SQL |
| `bookcore_operational_events_total` | Counter | API/UoW | retry، COMMIT نامعلوم، شکست Pool، overload، 401/403، full و replay |

تعداد سری‌های Route با سقف ۱۲۸ الگوی نام محدود است و برای افزایش بعد از سقف از `other` استفاده می‌شود. مدت‌زمان‌ها تنها از اندازه‌گیری واقعی به‌دست می‌آیند. مسیرهای ناشناخته یا حاوی UUID تحت برچسب `unmatched` ثبت می‌شوند. این مقادیر در RAM فرایند هستند؛ Restart آن‌ها را صفر می‌کند و Prometheus باید از نرخ Counter استفاده کند.

شاخص‌های backlog Outbox در `OutboxWorker.metrics()` از PostgreSQL Query می‌شوند و هر ۶۰ Poll به صورت JSON ثبت می‌شوند، نه از Endpoint عمومی. بررسی چند Worker و دوام زمانیِ این داده‌ها `NOT VERIFIED` است.
