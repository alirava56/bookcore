# سیاست Retention و حذف ایمن

Expiry دسترسی به معنای جواز Delete فیزیکی نیست. هیچ رکورد Booking، BookingEvent یا AuditEvent برای کاهش مصرف دیسک حذف نمی‌شود. Retention نهایی به قرارداد، قوانین و تصمیم مسئول Data Governance بستگی دارد؛ عددهای زیر پیشنهاد عملیاتی‌اند و مصوبهٔ حقوقی نیستند.

| منبع | سیاست فعلی / اقدامات مجاز | خطر |
|---|---|---|
| IdempotencyRecord | **حذف غیرفعال** تا تعریف tombstone یا Business Key ایمن | ایجاد عملیات دوم پس از پاک‌سازی |
| AuthSession / RefreshToken | انقضا و Revocation قابل اعمال؛ حذف نیازمند retention امنیتی مستقل | از دست رفتن Forensics |
| StaffInvitation | Expiration/Revocation حفظ می‌شود؛ حذف تاریخچه غیرفعال | انتساب نادرست عضویت |
| BookingConsent | انقضای Scope بدون پاک‌سازی Proof و Audit | جعل رضایت |
| AuthRateLimit | Maintenance محدود موروثی: حداقل ۴۸ ساعت و حداکثر ۱۰۰ رکورد | دادهٔ NAT/Brute-force |
| OutboxEvent / Receipt | حالت‌های terminal حفظ، cleanup غیرفعال | از دست رفتن at-least-once/dedup |
| BookingEvent / AuditEvent | Append-only؛ بدون حذف | تخریب شواهد |
| Operational logs | پیکربندی سازمانی و محدودیت دسترسی | نشت PII و Storage |
| Backup Archive | retention پیشنهادی ۳۰ روز با ابزار Preview فقط‌خواندنی | حذف آخرین نسخهٔ بازیابی |

`retention-preview.cjs` فقط نام Backupهای منقضی‌شده را با سقف ۱۰۰ Manifest گزارش می‌کند و هیچ فایلی را حذف نمی‌کند. حذف Backup باید پس از آزمون Recovery، وجود نسخهٔ مستقل قابل‌بازیابی، تأیید قانونی و پنجرهٔ حذف مجاز انجام شود. هیچ حذف خودکار جدیدی در Phase 12 فعال نیست.
