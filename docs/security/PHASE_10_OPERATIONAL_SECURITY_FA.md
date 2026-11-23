# امنیت عملیاتی و تهدیدهای باقی‌مانده

| تهدید | اصلاح سورس | مدرک | ریسک باقیمانده |
|---|---|---|---|
| جعل Actor در Retry Outbox | حذف Actor CLI، `session_user` + Registry و عضویت OWNER + Audit، سلب EXECUTE تابع Legacy | بازبینی متن SQL/CLI | تست نقش واقعی PostgreSQL و Credential Provisioning |
| Privilege escalation از API | `bookcore_app` نه Role عملیاتی و نه EXECUTE توابع جدید | Migration 011 و تست منفی طراحی‌شده | SQL Grants اجرا نشده |
| نشت Tenant در Inspector | Scope اجباری Tenant و OWNER، خروجی محدود بدون PII | کد تابع و تست | تست واقعی Cross-tenant NOT VERIFIED |
| حذف زودهنگام Idempotency | Purge غیرفعال | تست Pure | رشد رکورد و تصمیم Retention باز |
| حذف ناامن Rate Limit | حداقل ۴۸ ساعت، Batch ۱۰۰، dry-run، SKIP LOCKED، Audit | SQL و Pure tests | هم‌زمانی PostgreSQL اثبات نشده |
| Replay توکن دعوت گمشده | Revoke + Reissue به‌جای بازیابی Hash | تست Integration منبع | تست HTTP/PG اجرا نشده |
| تقابل revocation با عملیات | قفل سازمان و عضویت هنگام Requeue | SQL | Lock ordering واقعی و Deadlock NOT VERIFIED |
| پاک‌کردن تاریخچه | نبود Auto Repair، Trigger Audit | سورس | مالک DB/Superuser دارای اختیار است |

هیچ کنترل جدیدی مجوز انتشار Production محسوب نمی‌شود؛ گزارش صحت فقط به آزمون‌های واقعاً اجراشده محدود است.
