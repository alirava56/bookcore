# Alertها و Runbook عملیات

آستانه‌ها **پیشنهادی و تأییدنشده با دادهٔ بار واقعی** هستند. Ruleهای دارای Metrics حاضر در سورس در `infra/observability/prometheus-alerts.yml` قرار دارند. موارد دیگر ابتدا به اتصال Collector یا Exporter معتبر نیاز دارند.

| موضوع | سطح پیشنهادی | سیگنال/شرط نمونه | اقدام اولیه و معیار بسته‌شدن |
|---|---|---|---|
| API 5xx | هشدار | نسبت 5xx پایدار بالا | بررسی Request ID، DB readiness و Rollback؛ کاهش خطای فنی |
| DB Pool انتظار | هشدار | waiting بالاتر از ظرفیت معمول برای ۵ دقیقه | سنجش اتصال‌های طولانی و کندی SQL؛ بازگشت صف به حد پایه |
| Unknown COMMIT | بحرانی | افزایش `db_unknown_commit` | توقف Retry ناامن، بازیابی با همان Idempotency-Key؛ اثبات نتیجهٔ Commit |
| Outbox poison | بحرانی | افزایش failed در Worker Log | بازرسی Restricted CLI و Tenant؛ پاک‌سازی بدون حذف تاریخچه ممنوع |
| Backup stale | بحرانی | نبود بکاپ جدیدِ تأییدشده | اجرای Backup، Verify مستقل و Restore آزمایشی؛ تازه‌بودن Artifact کافی نیست |
| Restore failure | بحرانی | Postcheck یا مهاجرت Ledger مغایر | مسدودسازی ترافیک مقصد؛ بازگردانی به محیط دورریختنی دیگر و ارزیابی داده |
| ظرفیت پر | اطلاعات | `SESSION_FULL` | خطای عادی تجاری است و نباید مستقلاً Incident ایجاد کند |
| Authorization anomaly | امنیتی | افزایش 401/403 غیرعادی | کنترل rate limits/انحراف Permission؛ بدون افشای هویت درخواست‌کننده |

برای هر Incident زمان، محیط، نسخهٔ Migration، خطای ثابت، صاحب عملیات و نتیجهٔ آزمون بازگشایی سرویس ثبت می‌شود. آستانه‌های Retry، Pool و SLO پس از بارسنجی واقعی بازتنظیم شوند.
