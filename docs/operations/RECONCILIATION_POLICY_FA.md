# سیاست Reconciliation و Repair

**Detection → Classification → Repair** سه مرحلهٔ مستقل‌اند. خروجی Inspector هیچ UPDATE/DELETE روی Booking، Session، AuditEvent، BookingEvent، Consent یا Idempotency انجام نمی‌دهد.

| تشخیص | طبقه‌بندی | اقدام مجاز Phase 10 |
|---|---|---|
| COUNTER_DRIFT یا CAPACITY_BOUNDS | شکست یکپارچگی بحرانی | `MANUAL_ONLY`، قفل ترافیک نوشتنی ذی‌ربط، Snapshot و بررسی SQL تاریخچه |
| CANCELLED_SESSION_DRIFT | تضاد وضعیت | فقط ثبت Incident و بازیابی با تأیید جداگانه |
| BOOKING_EVENT_CHAIN | احتمال نقص تاریخچه | بازسازی خاموش ممنوع، حفظ زنجیره و مراجعه به پروندهٔ رخداد |
| OUTBOX_PROJECTION_DRIFT | شمارندهٔ رسید داخلی | مقایسهٔ Receipt/Projection و بررسی رویدادهای ناشناخته؛ بدون Reset خودکار |
| stale Lease | عملیاتی | Worker فعلی به‌شکل مالک‌دار و پس از انقضا Claim می‌کند؛ دست‌کاری مستقیم نشود |
| Expired Invitation / Consent | عمر اعتبار | انقضا در Query احراز مجوز اعمال می‌شود؛ تاریخچه حذف نشود |

هیچ عملیات Auto-Repair روی State بحرانی فعال نشده است. برای تغییرات حساس، DBA باید Operator معتبر، دلیل، مدارک before/after و کنترل بعد از Commit فراهم کند. عملیات نامعلوم پس از COMMIT باید متوقف و از رکوردهای Commit‌شده بررسی شود؛ Retry کور ممنوع.
