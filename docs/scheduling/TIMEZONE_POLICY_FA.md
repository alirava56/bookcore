# BookCore — Timezone و DST

- IANA timezone سازمان (برای نمونه `Asia/Tehran` یا `Europe/Berlin`) از جداول سازمان خوانده می‌شود. Schedule Exception و Session proposal هر دو با timestamp دارای offset صریح RFC3339 ثبت می‌شوند؛ offset باید با IANA در همان instant و wall clock سازگار باشد. نمونه `2026-11-23T10:00:00+03:30` در تهران به `2026-11-23T06:30:00.000Z` تبدیل می‌شود.
- خروجی تمام instants به UTC با `Z` canonical است. زمان محلی هفتگی (`HH:mm`, `isoWeekday`, `endDayOffset`) بدون تبدیل اولیه به UTC ذخیره می‌شود، چون DST در تاریخ‌های مختلف متفاوت است.
- برای تبدیل یک boundary محلی روی تاریخ پیشنهادی، offsetهای نزدیک بررسی و تطابق local clock آزموده می‌شود. صفر Candidate = زمان گمشده؛ دو Candidate = زمان مبهم؛ هر دو رد می‌شوند. یک Candidate = Instant یکتا. این تصمیم **سخت‌گیرانه‌تر از** تفسیر offset درخواست‌های Exception است، چون BusinessHours خودشان offset ندارند.
- Rule crossing midnight همیشه نسبت به **روز محلی آغاز** به روز بعد تعلق دارد؛ بازه‌ها نیمه‌باز هستند و روز یکشنبه به دوشنبه به شکل چرخشی بررسی می‌شود.
- بازهٔ بررسی پیشنهادی حداکثر ۲۴ ساعت است؛ Exception حداکثر ۳۱ روز. Query `from/to` برای فهرست Exceptions instant-aware است و به offset سازمان سنجاق نمی‌شود.
- تست‌های Pure واقعی شامل تهران، ساعات شبانه، Berlin spring gap و fall fold هستند. Validation با خود PostgreSQL هنوز تأیید نشده است.
