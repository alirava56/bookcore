# BookCore — ممیزی مستقل Design Baseline 1.0

**ورودی تغییرناپذیر:** `BOOKCORE_SOFTWARE_ENGINEERING_BLUEPRINT_FA.md`، شناسه BC-SENG-001، 2026-11-21، 802 خط. **خروجی:** نسخه طراحی 1.1 / Phase 01 در `docs/`؛ تاریخ بررسی 2026-11-22. هیچ کد برنامه، migration یا آزمایش اجرایی تولید/اجرا نشده است.

## روش
۱. همه فصل‌های 0 تا 19 سند اصلی خوانده شدند. ۲. FR-01..16 و INV-01..14 و NFR-01..10 و T-01..25 استخراج شد. ۳. سناریوهای نقض هم‌زمانی، امنیت، تاریخچه، مجوز و API بررسی و با تصمیم‌های متقاطع در اسناد وابسته بسته شدند. ۴. «تصمیم فنی قابل تعیین» از «فرض محصول نیازمند مشتری» تفکیک شد. ۵. اسناد با یک سیاست واحد مورد بازبینی متقاطع قرار گرفتند. این فرایند تحلیل کاغذی است، نه اثبات عملکرد.

## یافته‌ها و اصلاحات
| شناسه | شواهد در Blueprint | نقص/تناقض واقعی | تصمیم طراحی 1.1 | اثر/صحت‌سنجی |
|---|---|---|---|---|
| A-01 | §4.2, §4.3, T-25 | لغو Session نحوهٔ لغو گروهی Booking و شمارنده و رویداد را تعیین نکرده | فقط قبل از شروع، قفل Session، لغو تمام `CONFIRMED`ها و صفرکردن Counter، غیرفعال‌کردن Allocations و Outbox در یک Commit | T-25, T-26 |
| A-02 | §4.3, INV-02, T-23 | زمان ثبت ATTENDED/NO_SHOW و اثر FINISHED مبهم است | فقط پس از `FINISHED`، از CONFIRMED به ATTENDED/NO_SHOW، بدون تغییر Counter | T-23,T-27 |
| A-03 | §7.3, §15.3 | هم‌زمان ادعای Rollback و ذخیره رد قطعی امکان‌پذیر نیست | رد دامنه‌ای پیش‌بینی‌شده را بدون mutation کسب‌وکاری همراه با نتیجهٔ Idempotency در TX *COMMIT* می‌کنیم؛ Failure زیرساختی ROLLBACK و بدون Cache | T-03,T-04,T-28 |
| A-04 | §4.1, §15.1, R-01 | Customer هم نقش Membership است و هم احتمالاً کاربر بدون Membership | Customer حساب جهانی Authenticated بدون نیاز به Membership دارد؛ Role کارمندی صرفاً در Membership، مالک Booking = Customer | T-12,T-29 |
| A-05 | §4.1, §15.4, R-03 | Trainer و Resource و شعبه مالکیت متفاوت دارند | Trainer Resource در Tenant یکتا به User عضو Trainer وصل می‌شود؛ `branch_id` مربی تهی؛ Room شعبه‌دار؛ تخصیص مربی بین شعبه‌های یک Tenant هم تداخل دارد | T-08,T-30 |
| A-06 | §4.5, §8.1, T-24 | Guard قبل از Transaction، ابطال Membership حین درخواست را نمی‌بندد | قفل `auth_sessions FOR SHARE` و `memberships FOR SHARE` در TX پیش از Claim/Session؛ Revocation با UPDATE ناسازگار و منتظر می‌ماند | T-24,T-31 |
| A-07 | §4.7, INV-07, T-11 | «رد یا لغو+ایجاد» انتخاب نشده | MVP فقط رد ویرایش بازه/مربی در Session دارای رزرو مؤثر؛ راهکار عملی لغو پیش از شروع و ساخت Session جدید، بدون انتقال خودکار | T-11 |
| A-08 | §3 INV-05, §5.1 | زمان Allocation می‌تواند از Session مستقل و ناسازگار شود | buffer به Interval تخصیص اعمال؛ FK مرکب و Constraint Trigger تعویقی برای consistency تخصیص/جلسه در Spike بررسی شود | T-08,T-19,T-32 |
| A-09 | §5, R-08 | FK و حذف Cascade تاریخچه مشخص نشده | همه FKهای سازمانی مرکب؛ RESTRICT برای تاریخچه/هویت حیاتی؛ رویداد append-only و soft-deactivation | T-12,T-19,T-33 |
| A-10 | §7, §15.1 | عملیات Manager/Receptionist در ماتریس و API متفاوت است | Scope واحد Owner/Manager مدیریت برنامه، Receptionist فقط booking/cancel/attendance، Trainer فقط جلسهٔ خود؛ واگذاری موردی بعداً | T-13,T-34 |
| A-11 | §7, FR-05/06/11 | API برای ساعات کاری، استثنا، لغو Session، تغییر ظرفیت و عضو تعلیق‌شده ناقص است | Endpointهای دقیق اضافه شده و OpenAPI طراحی شده است | API contract coverage |
| A-12 | §5.2, T-14 | offset و زمان محلی مبهم قطعی نیست | ورودی Session فقط RFC3339 با offset، تطبیق offset با IANA Tenant؛ offset نامعتبر و local nonexistent رد؛ local ambiguous فقط با offset صحیح | T-14 |
| A-13 | §10.1 | Outbox تحویل در ازای crash بدون تعریف تحویل/تکرار | انتشار حداقل یک بار، dispatcher `SKIP LOCKED`، lease و `published_at`، dedupe بر اساس event_id؛ crash replay مجاز | T-15,T-16,T-35 |
| A-14 | §4.4, §15.4 | رزرو منبع برای Draft و تغییر ساعات بعد از انتشار مبهم | Draft نیز ResourceAllocation فعال و انحصاری دارد؛ ویرایش Policy گذشته، Sessionهای قبلی را پنهانی تغییر نمی‌دهد | T-08,T-36 |
| A-15 | §9.2 | Refresh replay نیازمند تاریخچه Token است | `auth_sessions` + `refresh_tokens` با چرخش، ثبت مصرف و ابطال Family در Replay | T-37 |
| A-16 | §5.1 | `capacity_total` Check مانع Counter drift منطقی نیست | همه Mutationها با قفل Session و Event; Audit Query جهت تطبیق شمارنده با COUNT؛ Spike برای DB trigger/controlled write permissions | T-01,T-06,T-38 |
| A-17 | §12.1 | Release Gates با Design Gate اشتباه گرفته می‌شوند | Gate طراحی را جدا ارزیابی کرده، تمام Gateهای اجرایی G1..G8 تا اجرا `NOT VERIFIED` باقی می‌مانند | final report |
| A-18 | §6.3, R-12 | «ترجیح Prisma» فاقد تصمیم فنی روشن است | پیش‌فرض موقت Drizzle + SQL سفارشی با TX raw؛ انتخاب منوط به Spike مقایسه؛ مهاجرت PostgreSQL-native منبع حقیقت | T-19,T-39 |

## حفظ اصول اصلی
- حفظ Modular Monolith، PostgreSQL ACID، قرارداد `/api/v1`، عدم پرداخت و Hold و Waitlist و recurring در MVP.
- حفظ شناسه‌های FR-01..16، INV-01..14، NFR-01..10، T-01..25؛ تست‌های T-26..43 مکمل‌اند.
- اصل `INV-02` شمارش حضور/غیبت در Counter حفظ شد؛ عدد `seats_committed` «تعداد تعهدهای تاریخی مؤثر» است، نه ظرفیت قابل استفادهٔ گذشته.

## موارد نیازمند تأیید واقعی
`PD-01..PD-09` در `OPEN_DECISIONS_FA.md`. پیش‌فرض‌های اجرایی موقت فقط برای Spike در نظر گرفته می‌شوند. تغییر سیاست تجاری بعداً باید PRD، دامنه، DB، OpenAPI و تست‌ها را باهم اصلاح کند.

## محدودیت ممیزی
نه سورس اپلیکیشن و نه DB اجرایی و نه ذی‌نفع تجاری در محیط حاضر در دسترس نبوده؛ پس قیدهای SQL و پاسخ‌ها **Design Contract** هستند، نه نتیجهٔ تست. بررسی فایل اصلی و اسناد خروجی انجام شده؛ هیچ سندی ادعای آزمایش عملی ندارد.

## Phase 01 independent final correction findings (source baseline unchanged)
| ID | Confirmed contract discrepancy in 1.1 design | Correction to actual artifacts | Future test |
|---|---|---|---|
| C-01 | Optional-auth GET Sessions referenced Staff `Session`/`SessionList`, causing field-level leakage on public response | Separate anonymous `/public/organizations/{orgId}/sessions[/{sessionId}]` and bearer staff GETs, define disjoint PublicSession/StaffSession models, update PRD/Security/Domain | T-44 |
| C-02 | `/me` description said active memberships deferred while MeResponse included them | Authoritative `MeResponse` now includes User + ACTIVE-only `ActiveMembership[]`; no revoked/no secrets | T-45 |
| C-03 | `createdAt` and all timestamps described as if they were scheduling inputs requiring IANA offset match | Input scheduling validation separated from persisted UTC `Z` instants and event timestamps; query filters clarified | T-46 |
| C-04 | Readiness claimed internal/proxy but OpenAPI explicitly allowed anonymous access | `monitorAuth` plus network policy specified, anonymous access removed from contract; secret not generated | T-47 |
| C-05 | Previous validation omitted strict duplicate-YAML, structural model, path parameter/security and public-field tests | Executable static validation script, report and cross-doc checks added to package; runtime still unverified | Static report |

This is a correction of Phase 01 design artifacts, **not** an alteration of historical BC-SENG-001 or proof of backend behavior.
