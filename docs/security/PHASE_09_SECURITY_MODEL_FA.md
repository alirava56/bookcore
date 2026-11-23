# BookCore — مدل امنیت فاز نهم

## مبنا و دامنه
این سند شرح **سورس پیاده‌سازی‌شده** است، نه گواه تأیید امنیت در محیط PostgreSQL. مرجع قبلی: `docs/security/AUTHORIZATION_MATRIX.md`، قرارداد `docs/api/openapi.yaml` و گزارش فاز هشتم. تمام مسیرهای قدیمی رزرو، سازمان، Session، Catalog، Reporting و Worker در سورس اصلی باقی مانده‌اند.

## تفکیک سه مفهوم
- **Authentication**: JWT با Issuer/Audience/Signature و Active `auth_sessions`؛ کاربر سراسری بدون عضویت سازمانی ممکن است مشتری باشد.
- **Authorization**: اعتبارسنجی نقش Staff در همان Tenant و در خدمت کاربردی. درخواست UUID یا OrgId از کلاینت اثبات مالکیت نیست. Global Guard با Default Deny حفظ شده است.
- **Consent**: اعطای اختیار مستقل، صریح، زمان‌دار و قابل‌لغو توسط صاحب حساب برای رزرو به نمایندگی، در جدول `booking_consents`؛ مجوز نقش پرسنل به‌تنهایی کافی نیست.

## ریسک‌های کلیدی و پاسخ سورس
| تهدید | کنترل منبع | وضعیت اثبات |
|---|---|---|
| Affiliation ناخواسته | ایجاد مستقیم Membership از Endpoint قبلی با `STAFF_INVITATION_REQUIRED` بسته شده؛ Invite/Accept جداست | PostgreSQL/HTTP NOT VERIFIED |
| Role escalation | `mayInvite`: MANAGER فقط TRAINER/RECEPTIONIST؛ OWNER نقش‌های دیگر را مجاز می‌کند؛ مجوز داخل TX تکرار می‌شود | Unit PASS؛ PG NOT VERIFIED |
| Booking بدون رضایت | Grant فقط توسط Customer، Lock سازمان، Recheck رضایت در TX و ثبت actor/customer جداگانه | Source؛ PG race NOT VERIFIED |
| Refresh replay | توکن یک‌بارمصرف، Hash ذخیره‌شده؛ نتیجهٔ Commit نامعلوم → Re-authentication | Source؛ PG NOT VERIFIED |
| Outbox poison event | Event type/schema/version/aggregate/allowed fields/secret checks | Pure PASS؛ نسخه‌های تاریخی هنوز نیازمند corpus SQL |
| Outbox stale lease | claim تک‌رویدادی و fence با `lease_until > clock_timestamp()` قبل از تکمیل | PG NOT VERIFIED |
| Cross tenant | tenant predicate در داده و سرویس؛ FKهای تاریخی حفظ شده‌اند | PG BOLA NOT VERIFIED |
| Ops privilege | CLI مجزا، Database Role `bookcore_ops`، SECURITY DEFINER با search_path ثابت و owner-check | PG grants NOT VERIFIED |

## سیاست Proxy/Rate Limit
برای دعوت/رضایت Guard پایگاه‌داده‌ای مبتنی بر شناسهٔ احراز هویت‌شده به کار می‌رود؛ صرفاً آدرس IP مشترک NAT نباید مجوزهای کاربرهای متفاوت را یکی کند. حفاظت حجمی ناشناس در Edge و پروکسی مورد اعتماد لازم است. Headerهای forwarded ورودیِ غیرمورداعتماد نباید منبع هویت باشند. کالیبراسیون Rate Limit و Cleanup رکوردها در چند Replica تأیید نشده است.

## مرز انتشار
تا پیش از `npm ci`، semantic typecheck، HTTP E2E، مهاجرت ۰۰۱–۰۱۰ بر PostgreSQL17، و آزمایش تراکنش/قفل دو پردازش مستقل، این ماژول صرفاً کاندیدای سورس است. کلید امضا و URL دیتابیس نباید در فایل artifact یا Logging قرار گیرند.
