# BookCore — بازرسی یکپارچگی عملیاتی

## مرز اجرا
`scripts/operational-integrity.ts` یک CLI فقط‌خواندنی است. با `BOOKCORE_INSPECT_DATABASE_URL`، یک LOGIN مستقل که عضو نقش `bookcore_inspector` است، اجرا می‌شود؛ این ورود باید از پیش به User واقعی در `bookcore_operator_identities` پیوند داده شده باشد. تابع `bookcore_inspect_tenant(tenant,limit)` هویت را از `session_user` می‌گیرد، OWNER فعال همان Tenant را کنترل می‌کند و حداکثر ۱۰۰ Session، ۱۰۰ Booking، ۱۰۰ نوع شمارنده و چند نمونهٔ عمر رویداد را بررسی می‌کند.

```bash
npm run build
BOOKCORE_INSPECT_DATABASE_URL='postgres://INSPECTOR_LOGIN@localhost:5432/bookcore' npm run ops:inspect -- TENANT_UUID 50
```

خروجی JSON دارای `findings`، `staleLeasesSample`، `expiredInvitationSample`، `expiredConsentSample` و `completeScan:false` است. شناسه‌های محدود دیتابیسی ممکن است در خروجی عملیاتی دیده شوند؛ این خروجی فقط برای اپراتور مجاز است. هیچ API عمومی اضافه نشده است.

## پوشش و محدودیت
- تطبیق `seats_committed` با شمار Booking مؤثر؛ `0 <= committed <= capacity`؛ جلسات CANCELLED دارای رزرو مؤثر یا Allocation فعال؛ تطبیق Event اولیه و آخرین وضعیت هر Booking؛ Projection برابر شمار رسیدهای داخلی؛ Lease قدیمی؛ دعوت و رضایت منقضیِ نمونه‌برداری‌شده.
- این ابزار بررسی **نمونهٔ محدود** است؛ برای اثبات نبود Drift در کل دیتابیس کفایت نمی‌کند. زنجیرهٔ میانی BookingEvent، رخدادهای Outbox مفقود، تمام Aggregateها و Audit provenance هنوز نیازمند بازرسی کامل و تست واقعی‌اند.
- Read-only بودن در تراکنش `BEGIN READ ONLY` نیز درخواست می‌شود، اما تضمین عملی آن وابسته به اجرای PostgreSQL 17 است.
- `completeScan:false` صریحاً مانع اشتباه گرفتن نبود Finding با سلامت جامع می‌شود.

**وضعیت:** سورس موجود؛ اجرای PostgreSQL در این محیط NOT VERIFIED.
