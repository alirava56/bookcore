# Worker — معیارهای پذیرش

در PostgreSQL17 مشترک دو Worker مستقل باید با `SKIP LOCKED` و Lease/Fencing کار کنند. یک Event نباید دو Claim فعال داشته باشد؛ Crash، Timeout، Retry، Poison Event، Receipt یکتا و Projection باید از ردیف‌های Commitشده تأیید شوند.

No-op consumer یا Audit داخلی به‌معنی پیام‌رسانی خارجی نیست. تست‌ها در سورس باقی مانده‌اند؛ اجرا/Crash Recovery/Failover واقعی همگی NOT VERIFIED.
