# مدل گزارش Occupancy — فاز ۰۸

Endpoint پیاده‌سازی‌شده: `GET /api/v1/organizations/{orgId}/reports/occupancy?from=...&to=...`؛ با احراز هویت سراسری و مجوز OWNER/MANAGER. بازه‌ها offset-aware RFC3339 هستند؛ `from` شامل و `to` نامشمول، حداکثر ۳۱ روز UTC. هر دو اجباری‌اند؛ مقادیر خروجی ISO UTC با `Z` هستند.

تعریف موقتِ قابل بازبینی محصول: `sessions` تعداد Sessionهایی است که **شروع** آن‌ها در `[from,to)` قرار دارد و وضعیت فعلی‌شان `PUBLISHED`, `FINISHED`, یا `CANCELLED` است؛ DRAFT در گزارش تجاری شمرده نمی‌شود. `confirmed`,`attended`,`noShow`,`cancelledBookings` تعداد **ردیف‌های Booking با وضعیت فعلی مربوطه** در همین مجموعهٔ Sessionها هستند؛ یک مشتری که لغو کرده و مجدداً رزرو کرده است دو رکورد مستقل دارد، نه یک رزرو. `cancelledBookings` شامل لغو ناشی از Session Cancellation نیز هست. شمارش رویدادهای Audit یا Event جایگزین وضعیت واقعی Booking نیست.

این تعریف درصد اشغال یا تعداد صندلی لحظه‌ای را برنمی‌گرداند و از `seats_committed` به‌عنوان تاریخچه استفاده نمی‌کند. امکان تغییر مبنای بازه، استثناکردن Session لغوشده و سنجش ظرفیت میانگین از تصمیمات محصول هستند، نه تصمیم قطعی Stakeholder.

SQL در `reporting.service.ts` یک Statement با CTE است؛ Scope عضویت فعال، AuthSession معتبر، User فعال، Tenant فعال، نقش و بازهٔ تقویمی در همان Query حضور دارند. مقادیر `orgId`, `from`, `to` پارامتری هستند؛ کد فقط Aggregation عددی برمی‌گرداند و هیچ PII مشتری را حمل نمی‌کند. تست در محیط PostgreSQL واقعی مورد نیاز است. ارجاع مرجع: `docs/api/openapi.yaml`، Schema `Occupancy`.
