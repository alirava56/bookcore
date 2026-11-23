# BookCore — قوانین Availability (Phase 05)

## تصمیم قابل پیاده‌سازی

- BusinessHours یک پنجرهٔ محلیِ هفتگی برای **یک Branch یا یک Resource** است (XOR)، روزهای ISO برابر ۱ تا ۷؛ انتها به‌شکل `[start,end)` است. Rule شبانه با `endDayOffset=1` مجاز، طول هر پنجره ۱ تا ۱۴۴۰ دقیقه و تداخل Ruleهای فعالِ همان Target در دیتابیس ممنوع است (حتی یکشنبه به دوشنبه).
- هنگام بررسی یک Session پیشنهادی، Branch باید با Rule فعال یا `OPEN_OVERRIDE` معتبر باز باشد. اگر Resource در درخواست داده شود، همان شرط **به‌طور مستقل** برای Resource برقرار است؛ نداشتن Rule به‌صورت پیش‌فرض `AVAILABLE` تعبیر نمی‌شود. این سیاست «Fail Closed» برای هدف تجاری باید در آزمایش پذیرش تأیید شود.
- بازهٔ اصلی برای Branch و بازهٔ `[start-bufferBefore,end+bufferAfter)` برای Resource اعتبارسنجی می‌شود. بازه‌های مجاور تداخل ندارند. مجازبودن چند Rule متصل با Union زمانی بررسی می‌شود.
- `CLOSED` در هر Scope مربوطه حق وتو دارد. `OPEN_OVERRIDE` فقط فقدان یا محدودیت BusinessHours همان Scope را پوشش می‌دهد؛ CLOSED شعبه را حتی استثنای OPEN_OVERRIDE روی Resource نمی‌تواند دور بزند و برعکس. دو Exception فعالِ هم‌پوشان برای یک Target با GiST رد می‌شوند.
- Exception با start/end به‌صورت RFC3339 دارای offset واقعی سازگار با IANA سازمان وارد و به UTC ذخیره می‌شود. تغییر Rule گذشته Session موجود را لغو نمی‌کند؛ این Workflow در فاز بعد تعریف می‌شود.
- اگر Local Boundary در روز انتقال DST مبهم یا ناموجود باشد، موتور به‌جای انتخاب دلخواه یک offset، با `INVALID_TIME_INTERVAL` رد می‌کند. جزییات در TIMEZONE_POLICY آمده است.
- `evaluateAvailability(...)` یک تابع Pure deterministic با خروجی `code,available,capacityChecked:false,resourceConflictChecked:false` است. `CatalogService.evaluateInTransaction(client,...)` Ruleهای tenant-safe را از DB روی Client تراکنش دریافت و به همین تابع می‌سپارد؛ Caller فاز ۰۶ باید ابتدا مجوز لازم و قفل‌های موردنیاز را بگیرد.

## Return codes

| Code | معنی |
|---|---|
| `AVAILABLE` | فقط از منظر قوانین هفتگی و Exception مجاز، نه تأیید ظرفیت |
| `OUTSIDE_BUSINESS_HOURS` | شعبه در این بازه به‌اندازهٔ کافی Rule فعال ندارد |
| `BRANCH_CLOSED` | استثنای CLOSED شعبه با بازه تقاطع دارد |
| `RESOURCE_UNAVAILABLE` | Resource غیرفعال، فاقد پنجرهٔ کافی یا دارای CLOSED است |
| `INVALID_TIME_INTERVAL` | بازه نامعتبر یا زمان محلی DST مبهم/ناموجود |
| `SCHEDULE_EXCEPTION_CONFLICT` | هنگام ذخیره Rule، تداخل فعال با SQLSTATE 23P01 به HTTP 409 تبدیل می‌شود؛ کد ارزیابی در نسخه فعلی به‌جای این، اولویت CLOSED را به‌کار می‌برد |

## مرز ادعا

در این فاز Session، Booking و API عمومی «آیا ظرفیت وجود دارد؟» ایجاد نشده است. `AVAILABLE` هیچ‌وقت بدون قفل Session، کنترل ظرفیت و GiST Allocation به معنای قابل‌رزروبودن قطعی نیست. Snapshot Ruleها ممکن است پس از Commit تغییر کنند؛ Phase 06 موظف به هماهنگ‌سازی قفل‌هاست.
