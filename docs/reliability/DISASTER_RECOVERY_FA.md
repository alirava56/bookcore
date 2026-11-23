# برنامهٔ بازیابی بحران — BookCore

**دامنه:** این سند Runbook است و نتیجهٔ تمرین Recovery نیست. RPO و RTO پیشنهادی‌اند: برای بحث با مالک محصول، RPO حدود ۱۵ دقیقه و RTO حدود ۲ ساعت *صرفاً هدف پیشنهادی* هستند؛ تا تصویب، هیچ SLO تضمین‌شده‌ای وجود ندارد. Logical Backup روزانه به‌تنهایی چنین RPOای را تضمین نمی‌کند.

| حادثه | تشخیص/مهار اولیه | فرآیند بازیابی | شرط بازگشت |
|---|---|---|---|
| قطع API | Liveness و 5xx | توقف ترافیک، بررسی سرویس و Secretها، restart محدود | Readiness و HTTP E2E |
| توقف PostgreSQL | Readiness، لاگ DB | توقف Booking write، ارزیابی WAL و Failover | Counter/History و آزمون دو Process |
| خرابی Volume | checksum/I/O alerts | restore ایزوله از Backup+WAL | بازبینی Ledger و دادهٔ پایدار |
| حذف داده یا Migration خراب | Drift و Audit | فریز Write؛ point-in-time restore روی میزبان جدید | تحلیل حذف و تأیید مسئول |
| از دست رفتن Host | monitoring | provision مستقل و بازیابی Secretها از Vault | شبکه/امنیت/Backup تأیید |
| Crash Worker | backlog و lease | restart worker، reclaim lease، مقایسه receipt | عدم Double Side Effect |
| پاسخ COMMIT گمشده | خطای Transport | Retry با *همان* Idempotency-Key؛ در نبود قرارداد re-auth/manual resolution | عدم تراکنش تکراری |
| Credential compromise | هشدار امنیتی | قطع دسترسی و Rotation، ممیزی Audit | کلیدهای جدید و revocation آزموده |
| Backup خراب | mismatch SHA/List | Quarantine، نسخهٔ مستقل یا Backup قبلی | Restore واقعی موفق |
| انقضای اپراتور | Access denied | Provision مجدد با هویت مستقل و Audit | Privilege negative tests |

در بازیابی، Sessionها را مستقیماً از وضعیت FINISHED/CANCELLED بازنگردانید؛ تاریخچه و Outbox را بی‌دلیل بازنویسی نکنید. پیش از بازشدن ترافیک Booking، tenant isolation و هم‌زمانی ظرفیت اثبات شوند.
