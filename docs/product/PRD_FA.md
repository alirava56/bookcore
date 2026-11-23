# BookCore — PRD طراحی MVP، نسخه 1.1

**محصول:** API-first رزرو قطعی یک نفر برای Session ظرفیت‌دار در باشگاه‌ها و جلسات مربی. **مرجع:** BC-SENG-001، §0–2. **وضعیت:** پیشنهاد فنی؛ اعتبارسنجی بازار انجام نشده. قرارداد اصلاح‌شده 1.1.1-design، بدون پیاده‌سازی.

## مسئله و ارزش
هماهنگی دستی تماس/پیام‌رسان/اکسل، رزرو دوباره، تداخل مربی/سالن و خطای ظرفیت ایجاد می‌کند. BookCore باید تصمیم رزرو و ظرفیت را به تراکنش معتبر DB تبدیل کند و از Client وب/موبایل/پذیرش مستقل باشد. شاخص موفقیت مهندسی، عدم Overbooking و Audit کامل است؛ صرفاً در پایلوت می‌توان زمان پاسخ انسانی و ارزش تجاری را اندازه گرفت.

## مخاطبان، سفر کاربر، خروجی
| Actor | سفر MVP | شرط موفقیت |
|---|---|---|
| Customer | Register/Login → مشاهده Session منتشرشده → مشاهده ظرفیت غیرتضمینی → POST Booking با Key → دریافت Receipt → مشاهده/لغو پیش از cutoff | یک Booking مؤثر و عدم ثبت دوگانه |
| Owner | ساخت Organization → تنظیم Tenant → افزودن کارمند → شعبه/خدمت/منبع → ساخت Session → Publish → گزارش | داده فقط متعلق به Tenant |
| Manager | تعریف ساعات/استثنا → تنظیم Session و ظرفیت → کنسل Session قبل از شروع → گزارش | تخصیص منابع تداخل نکند |
| Receptionist | ثبت رزرو برای User موجود، با هویت Actor مستقل؛ لغو با دلیل؛ حضور با مجوز | اثر دقیق و Audit قابل انتساب |
| Trainer | تقویم جلسات مرتبط با Resource خود → ثبت حضور/غیبت بعد از پایان | هیچ مجوز مدیریتی از Trainer بودن استنتاج نشود |
| Operations | لایونس/ردینس، مشاهده Trace و Alert، Restore Drill | صحت بازیابی باید سنجیده شود |

## شمول و استثنا
**شامل FR-01..FR-16:** احراز هویت و refresh، سازمان/شعبه/عضویت، Resource مربی و سالن، Service، برنامه هفتگی/استثنا، Session و چرخه وضعیت، Capacity GET، رزرو قطعی، لغو، ثبت حضور، تقویم/گزارش، Outbox DB، Health.

**صریحاً خارج:** پرداخت، Hold، Waitlist خودکار، چندنفر در یک Booking، ایجاد خودکار جلسات تکراری، انتقال خودکار Booking، رزرو مهمان بدون حساب، قیمت پویا، پیامک و Subscription، رفع تداخل مربی میان دو Tenant مستقل (نیازمند توافق داده مشترک و حریم خصوصی)، پورتال طراحی‌شده کامل.

## User Stories و آزمون اصلی
- `US-01` مشتری با هویت معتبر بتواند Session منتشرشده‌ای را که هنوز شروع نشده رزرو کند؛ در 100 درخواست برای یک صندلی، فقط یک CONFIRMED (FR-09,T-01).
- `US-02` مشتری بتواند با همان Key درخواست ناتمام شبکه را تکرار کند؛ اگر Commit شده، همان Receipt را بگیرد (FR-10,T-03).
- `US-03` مدیر بتواند مربی یا سالن اختصاصی را زمان‌بندی کند؛ تخصیص هم‌پوشان توسط PostgreSQL رد شود (FR-07,T-08).
- `US-04` مدیر بتواند Session آینده را لغو کند؛ تک‌تک Bookingها History بگیرند، شمارنده صفر شود (FR-06/12/15,T-25).
- `US-05` مشتری تنها Booking خود را ببیند یا طبق cutoff لغو کند؛ Tenant دیگر حتی existence را کشف نکند (FR-02/11,T-12).
- `US-06` Trainer فقط برای Session منتسب به خودش در حالت FINISHED حضور ثبت کند (FR-12,T-27).
- `US-07` پذیرش با `customerId` یک User از قبل ثبت‌شده، رزرو را با actor جدا ثبت کند (FR-03/09,T-29).
- `US-08` تغییر `BusinessHours` آینده نباید Session منتشرشده یا رزرو مشتری را بی‌صدا حذف کند (FR-05,T-36).

## قواعد محصول برای «طراحیِ موقتِ قابل پیاده‌سازی»
1. Customer یک `User` جهانی فعال است؛ برای رزرو شخصی نیازی به `Membership` کارمندی ندارد؛ هدف Session سازمان مقصد باید منتشر و در دسترس عمومی باشد. Tenant می‌تواند در نسخه‌های بعد ورود خصوصی بگذارد، نه MVP.
2. Booking هر بار برای یک User و یک Session است. Staff فقط با `customerId` یک User موجود عمل می‌کند؛ جست‌وجوی آزاد PII مشتری در MVP وجود ندارد. تأیید رضایت در فرایند پذیرش و ثبت actor لازم و نیازمند بررسی کسب‌وکار است.
3. Tenant cutoff برای لغو مشتری به‌صورت `cancellation_cutoff_min` با پیش‌فرض پیشنهادی 120 دقیقه؛ زمان DB، نه ساعت کلاینت. لغو Staff قبل از شروع با reason الزامی و امکان عبور از cutoff، اما نه بعد از شروع.
4. یک Session دقیقاً یک Trainer Resource، و صفر یا یک Room Resource دارد؛ Room انحصاری است؛ Trainer می‌تواند در شعبه‌های متعدد همان Tenant برنامه داشته باشد.
5. Draft بازه منبع را اشغال می‌کند تا Publish باعث رقابت جدید نشود؛ Cancel کردن Draft مجاز است. بافر Resource با Session end متفاوت است.
6. Session با Booking مؤثر تا قبل از شروع می‌تواند Cancel شود؛ بعد از شروع ویرایش ساختاری و Cancel در MVP رد می‌شود. Finish پس از پایان؛ حضور/غیبت فقط پس از Finish.
7. گزارش‌ها Snapshot تحلیلی هستند؛ API موجودی در GET تضمین رزرو نمی‌دهد. همه شمارش‌ها در یک Tenant انجام می‌شوند.
8. خود سازمان هنگام ایجاد، Owner عضو می‌سازد؛ تنها Owner آخر نباید تعلیق/حذف شود. مدیریت Role با قفل Transaction.

## معیارهای کسب‌وکار و تجربه (همگی پیشنهادی)
دقت و عدم Overbooking در تست‌های واقعی باید صفر خطا باشد. `p95 < 300ms` فقط هدف آزمایشگاه رزرو و مشروط به پروفایل بار؛ SLO آزمایشی 99.9% و RPO 15min / RTO 60min نیازمند زیرساخت و Restore Drill. KPIهای Conversion، کاهش تماس و رضایت ذی‌نفعان عددی نیستند تا مصاحبه واقعی انجام شود. `NFR-01..10` و شرایط PASS/FAIL در گزارش نهایی تعریف شده‌اند.

## Definition of Ready و تغییر دامنه
قبل از Spike: قرارداد State, Capacity, SQL exclusion, Idempotency, Authorization و آزمون T-01..T-25 مستند است؛ مسائل تجاری `PD-01..09` برای تأیید نام‌گذاری شده‌اند. قبل از پایلوت: تصمیم‌های P0 و مصاحبه حداقل دو کسب‌وکار، تست CI و Postgres و امنیت و Backup لازم‌اند. هر Feature فقط با به‌روزرسانی همزمان PRD + OpenAPI + tests + ADR می‌تواند Scope را تغییر دهد.

## قراردادهای پاسخ و زمان — اصلاح نهایی Phase 01
- **تفکیک مسیر واقعی:** نمایش عمومی صرفاً از `GET /api/v1/public/organizations/{orgId}/sessions` و `GET /api/v1/public/organizations/{orgId}/sessions/{sessionId}` با `PublicSession` و `PublicSessionList` انجام می‌شود: فقط `PUBLISHED`، بدون دادهٔ مدیریتی (counter committed/total، Resource UUID، version، status داخلی). `serviceTitle` و `branchName` صرفاً برچسب‌های عمومی‌اند؛ انتخاب/رضایت نشر اطلاعات عمومی در PD-07 پیش از Pilot باید اعتبارسنجی شود.
- **تقویم Staff:** `GET /api/v1/organizations/{orgId}/sessions` و `GET /api/v1/organizations/{orgId}/sessions/{sessionId}` نیازمند Bearer + Membership کارمندی فعال در همان Tenant هستند و به `StaffSession`/`StaffSessionList` محدودند؛ Trainer فقط سشن‌های تخصیص‌یافته به خودش را می‌بیند. مشتری بدون Membership کارمندی مجاز به Staff GET نیست.
- **`GET /api/v1/me`:** دقیقاً `{ user: User, memberships: ActiveMembership[] }` را برمی‌گرداند؛ عضویت‌های `REVOKED` نمایش داده نمی‌شوند، آرایه می‌تواند خالی باشد؛ Customer یک عضویت کارمندی ساختگی نیست.
- **زمان:** ورودی ساخت/تغییر استثنای تقویم و ساخت Session باید offset صریح RFC3339 داشته باشد و با IANA سازمان در زمان محلی منطبق شود. خروجی `startAt`,`endAt`,`createdAt`,`cancelledAt` و گزارش، همگی UTC `Z` هستند؛ `createdAt` یک event timestamp است نه ورودی زمان‌بندی. فیلترهای `from/to` فقط instant offset-aware هستند و timezone سازمان برای تطبیق offset بر آنها اعمال نمی‌شود.
- **Health:** `/health/live` عمومی و بدون جزئیات است؛ `/health/ready` برای پایش داخلی با network policy و `monitorAuth` تعریف شده، هنوز استقرار/کلید واقعی ندارد.
