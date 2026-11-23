# ممیزی استاتیک SQL و ایندکس‌ها

این بررسی **EXPLAIN واقعی نیست**؛ هیچ دیتابیس برای `EXPLAIN (ANALYZE, BUFFERS)` در محیط اجرا موجود نیست. قراردادهای پایهٔ SQL و Migrationهای ۰۰۱–۰۱۲ حفظ شده‌اند.

| مسیر حساس | الگوی سورس | ریسک/کنترل |
|---|---|---|
| Booking Create | Session row `FOR UPDATE`, partial effective uniqueness | رقابت روی Session؛ نیاز به اندازه‌گیری Lock Wait |
| Booking History | `(created_at,id)` DESC + Cursor میکروثانیه‌ای | Index و Plan باید در دادهٔ بزرگ تست شوند |
| Session/Resource | Exclusion Constraint | هم‌پوشانی به PostgreSQL واگذار شده؛ عملکرد GiST اندازه‌گیری نشده |
| Occupancy | Aggregate Tenant + بازهٔ نیمه‌باز | `EXPLAIN` برای Tenant حجیم هنوز لازم است |
| Outbox | `SKIP LOCKED` + Lease و Fencing | Polling تحت backlog و Workerهای متعدد آزمایش شود |
| Inspection | Keyset Cursor + Bounded Batch | از OFFSET عمیق پرهیز شده؛ Snapshot بین صفحات سازگار نیست |

Index شمارهٔ ۰۱۳ اضافه نشد چون بدون Plan و حجم داده، اضافه‌کردن Index پرهزینهٔ Write توجیه نشده است. معیار پذیرش: اندازه‌گیری Plan واقعی با دادهٔ مصنوعی در مقیاس هدف، ثبت CPU/IO، ایندکس‌های استفاده‌شده، Lock Wait، latency و تغییر بعد از اصلاح.
