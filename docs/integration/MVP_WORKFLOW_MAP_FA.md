# BookCore Phase 11 — نقشهٔ جریان‌های MVP

**منبع حقیقت:** ماژول‌های موجود در `apps/api/src/modules`، کنترلرهای استخراج‌شده در `API_IMPLEMENTATION_MATRIX.json`، و قرارداد `docs/api/openapi.yaml`.

## A — ایجاد سازمان و پیکربندی
`POST /auth/register` → `POST /auth/login` → `POST /organizations` → عضویت اولیهٔ OWNER در تراکنش ایجاد سازمان → `POST /organizations/{orgId}/branches` → `services` → `resources` → `business-hours`. هر مرحله دارای عملیات DB مستقل است؛ **تراکنش مشترک بین کل onboarding وجود ندارد**. لغو مرحلهٔ آخر، مراحل Commitشدهٔ قبلی را برنمی‌گرداند. در ساخت سازمان، Owner + Audit + Outbox در یک `UnitOfWork` قرار می‌گیرند.

## B — دعوت و فعال‌سازی کارکنان
`POST /organizations/{orgId}/staff-invitations` با توکن محرمانهٔ یک‌بارمصرف؛ سپس `POST /me/staff-invitations/accept` توسط کاربر هدف. ایجاد دعوت، ایجاد عضویت ACTIVE نیست. مسیر مستقیم افزودن عضو بدون پذیرش در `OrganizationsService.add` با `STAFF_INVITATION_REQUIRED` مسدود است. لغو دعوت و رقابت Accept/Revocation باید با PostgreSQL واقعی اجرا شوند.

## C — زمان‌بندی Session
مدیر شعبه/خدمت/Resource/ساعات/استثنا را ایجاد می‌کند؛ `POST /organizations/{orgId}/sessions` یک DRAFT با Allocationها می‌سازد؛ Publish آن را قابل مشاهده در `/public/organizations/{orgId}/sessions` می‌کند. موتور Availability فقط سیاست زمانی را ارزیابی می‌کند؛ قید Exclusion منابع در PostgreSQL شرط نهایی است. ساخت Session با کلید Idempotency اختیاری؛ درخواست بدون کلید Recovery قطعی پاسخ ازدست‌رفته ندارد.

## D — رزرو شخصی
مشتری با User مستقل از Staff Membership وارد می‌شود؛ `POST /organizations/{orgId}/sessions/{sessionId}/bookings` با Idempotency-Key اجباری و `{}`. سرویس، Organization/AuthSession و Session Lock را در همان تراکنش کنترل می‌کند. رزرو CONFIRMED، شمارنده، Event، Outbox و پاسخ Replay در همان Commit. `GET /organizations/{orgId}/bookings/me` فیلتر User/Organization در SQL دارد.

## E — رزرو با رضایت
مشتری با `POST /organizations/{orgId}/booking-consents` اجازهٔ محدود سازمانی می‌دهد؛ کارکنان مجاز هنگام ایجاد Booking برای customerId دیگر باید Membership و Consent زنده را در تراکنش بررسی کنند. UUID یا Membership کارمند جایگزین رضایت نیست؛ Event/Booking مشتری و Actor متفاوت ذخیره می‌شوند.

## F — لغو، اتمام و حضور
لغو مشتری Cutoff سازمان را رعایت می‌کند. لغو مدیر/Session باید رزروهای مؤثر، Counters، ResourceAllocation، تاریخچه و Outbox را اتمی تغییر دهد؛ مسیر ۱۵ رزرو و Rollback آزمایش واقعی نیاز دارد. ثبت ATTENDED/NO_SHOW فقط پس از FINISHED و بدون تغییر ظرفیت مؤثر است.

## G — گزارش و پردازش Outbox
`GET /organizations/{orgId}/reports/occupancy` با نقش OWNER/MANAGER و SQL تجمیعی tenant-scoped در یک Statement؛ Worker با at-least-once، lease، receipt داخلی و projection کار می‌کند. Receipt داخلی مساوی تحویل SMS/ایمیل نیست.

## H — بازرسی و بازیابی عملیاتی
فقط CLI/LOGIN عملیاتی مجزا؛ `operational-inspection-v2` صفحات محدود و فقط‌خواندنی شش مجموعه را می‌خواند؛ Recovery قرنطینهٔ Outbox توسط اپراتور bindشده انجام می‌شود. هیچ بازسازی خودکار BookingEvent/Audit/Counter وجود ندارد.

**وضعیت:** این زنجیره بر اساس سورس و قرارداد ترسیم شده؛ فایل تست سرتاسری `phase11-mvp-http.test.ts` نوشته شده اما اجرای HTTP/PostgreSQL تا فراهم‌شدن زیرساخت `NOT VERIFIED` است.
