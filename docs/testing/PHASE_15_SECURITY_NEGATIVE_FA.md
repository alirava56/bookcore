# ماتریس آزمون‌های منفی امنیت

JWT امضای نامعتبر/منقضی/Algorithm Confusion، AuthSession و Membership لغوشده، Organization معلق، دورزدن Trainer scope، Cross-tenant access، Consent جعلی و منقضی، دعوت مصرف‌شده، Idempotency-Key متفاوت، SQL injection، X-Forwarded-For جعلی، Metrics بدون مجوز، سوءاستفاده از Roleهای SECURITY DEFINER و تغییر تاریخچهٔ Audit.

برای همهٔ سناریوها علاوه بر کد HTTP باید عدم تغییر دادهٔ حساس تأیید شود. تست‌های Source/Pure بخشی از سیاست را بررسی می‌کنند ولی هیچ نفوذسنجی جامع یا تست Runtime انجام نشده. تمام موارد وابسته به DB: NOT VERIFIED.
