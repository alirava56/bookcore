# BookCore — Phase 09 Final Engineering Report (فارسی)

**تاریخ:** ۲۳ نوامبر ۲۰۲۶  
**ارزیابی نهایی:** `SOURCE IMPLEMENTATION CANDIDATE — SECURITY RUNTIME NOT VERIFIED`  
**مرز:** فقط Phase09؛ فاز دهم، انتشار Production و Push به GitHub انجام نشده‌اند.

## ۱. خلاصهٔ مدیریتی
Source فاز هشتم BookCore با حفظ آرشیو و ۹ Migration موجود استخراج و به یک کپی جداگانه منتقل شد. صحت ۳۶۲ هش Manifest مبدا تأیید شد. سپس اصلاحات R09-01 تا R09-05، دعوت و پذیرش عضویت، رضایت مشتری برای رزرو کارکنان، سیاست امن بازیابی Refresh، Optional Session Idempotency، ابزار عملیاتی Outbox و Migration 010 در سورس پیاده‌سازی شدند. کلیهٔ اصلاحات دیتابیسی و امنیتی **هنوز نیازمند اجرای PostgreSQL واقعی و آزمون NestJS** هستند.

## ۲. اصلاحات واقعی انجام‌شده

1. **Runner:** `scripts/test-booking-domain-pure.cjs` دیگر عدد ثابت ۵ را جستجو نمی‌کند. تعداد واقعی TAP و Fail/Cancelled/Skipped/Todo را تحلیل می‌کند و برای شمارش‌های متغیر و صفر تست Selftest دارد؛ ۶ تست واقعی Booking با Exit Code صفر اجرا شدند.
2. **Outbox Payload:** `outbox.domain.ts` اکنون جفت Event/Aggregate، نسخهٔ Schema، UUID، وضعیت، فیلدهای مجاز و ساختار Payload را بررسی می‌کند. `BookingConfirmed:{}` رد می‌شود و شکل تاریخی مجاز `OrganizationCreated:{}` حفظ شده است. شکل منسوخ `{id}` برای Producer قدیمی فقط در حالت خاص `BookingConfirmed` مجاز مانده است.
3. **Lease و Receipt:** Worker ادعای یک Event در هر Poll، `FOR UPDATE SKIP LOCKED`، Fence مالک/Lease زنده در Commit، Receipt منحصر‌به‌فرد و Projection پایدار شمارندهٔ پردازش داخلی دارد. `published_at` نشان‌دهندهٔ تکمیل **داخلی** است، نه ارسال خارجی.
4. **Outbox Recovery:** CLI غیر HTTP با Credential جدا برای دیدن Eventهای قرنطینه‌ای و Requeue همراه Tenant/Owner/Reason، با تابع محدود DB و Audit افزوده شده است.
5. **Staff Invitation:** Endpoint ایجاد مستقیم Membership با 409 بسته شده است؛ توکن امن یک‌بارمصرف و ذخیرهٔ Hash، پذیرش صریح توسط Invitee، Revoke/Decline، بررسی نقش فعلی Invite‌کننده، Audit و Outbox افزوده شدند. Membershipهای قدیمی تخریب نشده‌اند.
6. **Consent:** رضایت مشتری در Tenant مشخص با مدت محدود، لغو و فهرست شخصی؛ Booking پرسنل تنها با Role جاری، Consent جاری، تفکیک actor/customer و قیود ظرفیت و Unique اصلی مجاز است. Consent داخل تراکنش Book بررسی می‌شود.
7. **Refresh:** در COMMIT نامعلوم، پاسخ `REFRESH_OUTCOME_UNKNOWN_REAUTH_REQUIRED` و سیاست ورود دوباره اعمال شد؛ هیچ Grace ناامن برای Token مصرف‌شده اعمال نشده است.
8. **Session Create:** `Idempotency-Key` اختیاری با Claim/Finalize تراکنشی و تغییر OpenAPI افزوده شد؛ برای کلاینت بدون Key تضمین Recovery وجود ندارد.
9. **Migration 010:** Staff Invitations، Customer Consents، Immutable identity triggers، Outbox projection، نقش عملیاتی و تابع Requeue مجاز، و Grantهای ستون‌محدود.
10. **Contract/Tests:** OpenAPI Design با ۸ مسیر جدید، مسیر قدیمی Deprecated/409، Schemaهای Token-safe، تست‌های Pure و PostgreSQL افزوده شده، تاریخچه و تست‌های فازهای قبل حفظ شد.

## ۳. دامنهٔ بررسی و شواهد واقعی

| کنترل | فرمان | نتیجهٔ مشاهده‌شده |
|---|---|---|
| Manifest مرجع | `npm run verify:reference` | PASS، ZIP مرجع شناخته‌شده |
| Static + ۱۰ migration source checksum | `npm run verify:static` | PASS؛ اجرای SQL محسوب نمی‌شود |
| Availability Pure | `npm run test:availability:isolated` | ۱۳ PASS / ۰ FAIL |
| Session Pure | `npm run test:session-domain:isolated` | ۸ PASS / ۰ FAIL |
| Booking Pure | `npm run test:booking:isolated` | ۶ PASS / ۰ FAIL |
| Phase08/09 Outbox Pure | `npm run test:phase08:isolated` | ۲۴ PASS / ۰ FAIL |
| Governance Pure | `npm run test:phase09:isolated` | ۶ PASS / ۰ FAIL |
| OpenAPI strict YAML and local refs | `python tools/phase09_validate_openapi.py` | PASS؛ ۴۶ عملیات، ۴۶ operationId یکتا، ۵۰۷ ref قابل حل |
| npm Lockfile genuine | npm registry attempt | FAIL؛ Timeout/Registry unavailable |
| `npm ci` | real execution | FAIL؛ Lockfile معتبر در بسته موجود نیست |
| Typecheck/Lint/Build | `npm run typecheck`, `npm run lint`, `npm run build` | FAIL؛ Dependencyها نصب نشده‌اند |
| NestJS HTTP / PostgreSQL / multi-worker | Integration suite | NOT VERIFIED؛ زیرساخت در محیط نبود |
| GitHub Actions | Workflow created | NOT VERIFIED؛ هیچ اجرای واقعی/Push انجام نشد |

**جمع تست‌های Pure واقعاً اجراشده: ۵۷ موفق، صفر ناموفق.** هیچ نتیجهٔ فوق اثبات ظرفیت، RBAC واقعی، Refresh race یا SQL migrations نیست. لاگ‌های خام `evidence/phase09/` مبنای نتایج‌اند.

## ۴. یافته‌های ممیزی و تصمیم‌های مهم

- افزودن پرسنل با UUID بدون پذیرش، نقص امنیتی بود و عمداً با خطای ثابت بسته شد؛ مصرف‌کنندهٔ قدیمی باید مهاجرت کند.
- دورزدن Consent از طریق درخواست Staff یا UUID مشتری مجاز نیست؛ Staff Role و Consent هر دو با دادهٔ سازمان در Transaction کنترل می‌شوند.
- Consumed Refresh Token بدون اثبات دستگاه نمی‌تواند Retry مشروع را از حمله جدا کند؛ ورود مجدد امن‌تر از Grace Bearer است.
- قفل Organization پیش از Permission/Consent/Idempotency/Session در مسیرهای هم‌پوشان پیشنهاد و در سورس اعمال شده؛ Deadlock و سازگاری با تمام مسیرهای تاریخی **هنوز آزمون نشده**.
- Outbox Payloadها در نسخهٔ اول تاریخی یکسان نبوده‌اند؛ قرارداد Versioned سازگاری `{}` معتبر را حفظ می‌کند و Payloadهای دارای دادهٔ محرمانه را می‌بندد.
- مدل Projection شمارندهٔ داخلی Outbox جای ارسال پیام خارجی و مدل Exactly Once Distributed را نمی‌گیرد.
- Migration 010 شامل تابع `SECURITY DEFINER` و DB Role جدید است؛ تا آزمایش محدودیت Permission روی PostgreSQL، نتیجهٔ امنیتی قطعی نیست.

## ۵. ماتریس ۱۲ Gate (پیاده‌سازی جدا از اثبات)

| Gate | Implementation | Verification | نکته |
|---|---|---|---|
| G1 — Inherited Phase08 repairs | IMPLEMENTED | NOT VERIFIED | Pure تست Runner و Payload موفق؛ Worker/PG نه |
| G2 — Authorization governance | PARTIAL | NOT VERIFIED | ماتریس جامع مستند؛ سیاست ماژول‌های قدیمی به‌صورت متمرکز بازنویسی نشده |
| G3 — Tenant/object isolation | PARTIAL | NOT VERIFIED | کنترل در مسیرهای جدید و مسیرهای قدیمی؛ E2E/PG لازم است |
| G4 — Staff invitation and acceptance | IMPLEMENTED | NOT VERIFIED | تراکنش دعوت/پذیرش بدون DB runtime |
| G5 — Customer consent/on-behalf booking | IMPLEMENTED | NOT VERIFIED | Race revoke/booking تأیید نشده |
| G6 — Refresh/session recovery | PARTIAL | NOT VERIFIED | Reauth ایمن، ولی تجربهٔ بازیابی بدون ورود مجدد طراحی نشده |
| G7 — Session creation retry safety | PARTIAL | NOT VERIFIED | کلید اختیاری؛ درخواست بدون Key تضمین Recovery ندارد |
| G8 — Rate limiting/abuse | PARTIAL | NOT VERIFIED | DB actor quota و Edge وابسته به محیط |
| G9 — Database role hardening | PARTIAL | NOT VERIFIED | Migration/CLI نوشته؛ Grants اجرا نشده |
| G10 — Outbox operational security | IMPLEMENTED | NOT VERIFIED | تک-Claim/CLI/Receipt؛ دو Worker تست نشده |
| G11 — API contract consistency | IMPLEMENTED | NOT VERIFIED | Static PASS؛ HTTP واقعی اجرا نشده |
| G12 — Tests/reproducibility | PARTIAL | FAIL | Lockfile، npm ci، build، PostgreSQL و CI بلاک شدند |

## ۶. ریسک‌های باقی‌مانده و اقدامات موردنیاز

۱. **Blocking infrastructure:** دسترسی npm Registry، ایجاد genuine `package-lock.json`، `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build` و رفع خطاهای واقعی احتمالی.
۲. **PostgreSQL17:** مهاجرت 001–010 تازه و روی دادهٔ موجود؛ نقش‌های least-privileged؛ Trigger امنیتی، `SECURITY DEFINER`، Query Permission و Constraintهای تاریخی.
۳. **Race tests:** دو Refresh، Concurrent Invitation Accept/Revoke، Consent Revocation در حین Booking، Session Creation Lost Response، Outbox Lease Loss/Crash، 100 booking x capacity 1/20 در دو Process.
۴. **Security E2E:** Global guard، JWT invalid/expired، AuthSession revoked، عضویت باطل، دادهٔ بین سازمانی، Tenant query، Rate Limiting مشترک، No PII.
۵. **Product validation:** روش انتقال توکن دعوت، متن حقوقی رضایت، حدود مدت و دامنهٔ رضایت، رفتار UX پس از Reauth؛ بدون ادعای موافقت ذی‌نفع.
۶. **Historical source debt:** Gateهای باز Phase02–08 همچنان باز مانده‌اند؛ هیچ Pass استاتیک جای اجرای آن‌ها را نگرفته است.

## ۷. دستورات اپراتور برای تکمیل Runtime

```bash
# From a clean extraction and environment with Node 22, npm network and PostgreSQL 17
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm ci --no-audit --no-fund
npm run verify:reference && npm run verify:static
npm run typecheck && npm run lint && npm run build
# Create the required separate PostgreSQL roles with migration-owner credentials.
npm run migrate && npm run migrate
npm run test:unit && npm run test:integration
npm run openapi:current
# With dedicated operational DB role only:
# npm run outbox:recovery -- list TENANT_UUID
```

حساب اجرای API باید `bookcore_app` و Worker جداگانه باشد. موفقیت این دستورها **در این محیط مشاهده نشده** است؛ CI طراحی شده اما اجرا نشده است.

## ۸. حکم نهایی

`SOURCE IMPLEMENTATION CANDIDATE — SECURITY RUNTIME NOT VERIFIED`

**فاز نهم به‌عنوان سورس قابل‌بررسی و کاندیدای ادامهٔ توسعه تحویل می‌شود؛ تأیید امنیت/یکپارچگی در Runtime و اجازهٔ انتشار تجاری صادر نشده است.** هیچ دادهٔ تست ساختگی، Lockfile با Hash جعلی، ادعای Production Ready یا Push به GitHub ثبت نشده و فاز دهم آغاز نشده است.
