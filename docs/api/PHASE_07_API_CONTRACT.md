# Phase 07 API Surface — قرارداد و شکاف‌ها

همه مسیرها زیر `/api/v1` و با Bearer JWT هستند. OpenAPI کامل `docs/api/openapi.yaml` مرجع طراحی باقی مانده و فقط چهار عملیات Booking در این فاز در Controller کدنویسی شده است. همه POSTها به `Idempotency-Key: UUID` نیاز دارند.

| HTTP Path | Body | Success | رفتار |
|---|---|---|---|
| POST `/organizations/{orgId}/sessions/{sessionId}/bookings` | `{}` برای خود؛ `customerId` فعلاً ممنوع | 201 Booking | Counter +۱ و یک Initial Event/Outbox |
| GET `/organizations/{orgId}/bookings/me` | فیلتر `from`, `to`, `limit`, `cursor` | 200 BookingList | Customer و Tenant در SQL؛ صفحه‌بندی نزولی CreatedAt/ID |
| POST `/organizations/{orgId}/bookings/{bookingId}/cancel` | `reason?` | 200 Booking | لغو مالک یا Staff مجاز؛ Reason برای Staff ضروری |
| POST `/organizations/{orgId}/bookings/{bookingId}/attendance` | `status: ATTENDED/NO_SHOW`, `reason?` | 200 Booking | فقط بعد از Finish؛ Reason اختیاری در Audit ذخیره می‌شود نه در BookingEvent |

Schema خروجی Receipt Allowlist است: `id`, `tenantId`, `sessionId`, `customerId`, `status`, `createdAt`, `cancelledAt`؛ فیلدهای داخلی `created_by_actor_id`, Token, Audit و SQL در آن نیستند. `createdAt` زمان رویدادی UTC است، نه ورودی زمان‌بندی. خطاها RFC9457 با کدهای پایدار هستند؛ `CANCELLATION_WINDOW_CLOSED` = 422، Full/Duplicate/Invalid Transition = 409 و Unknown Commit = 503.

**شکاف عمدی قرارداد:** طراحی اصلی بدنهٔ `customerId` برای رزرو کارکنان را مجاز می‌داند ولی نسخهٔ فعلی تا تأیید Consent آن را 403 رد می‌کند. این یک شکاف اجرایی مستند است و نباید به عنوان تکمیل کل MVP معرفی شود. هیچ مسیر عمومی جدیدی تعریف نشده است.
