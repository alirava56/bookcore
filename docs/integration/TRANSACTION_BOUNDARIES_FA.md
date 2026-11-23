# مرز تراکنش‌ها و ترتیب قفل‌ها — فاز ۱۱

## ترتیب پیش‌بینی‌شده
برای عملیات Tenant Write: Organization نخست (`lock_bookcore_organization`) → کنترل AuthSession/Membership و در صورت لزوم Consent → Claim Idempotency → Session/Booking یا Resource در ترتیب ثابت → Audit/Outbox → COMMIT. کد `BookingService`, `SessionService`, `GovernanceService`, `CatalogService` با همین هدف نوشته شده‌اند؛ برخی مسیرها ترتیب فرعی متفاوت دارند و تضمین فقدان Deadlock بدون اجرای PG معتبر نیست. Refresh/Logout مستقل از گراف قفل Tenant هستند ولی مسابقهٔ آن‌ها باید آزمایش شود.

**Booking:** `UnitOfWork` و `BookingService.runIdempotent` با ثبت Response در رکورد idempotency داخل تراکنش، سپس سطر Session را FOR UPDATE می‌گیرند. Unique Partial Index روی Booking مؤثر و CHECK شمارنده همچنان محافظ نهایی‌اند. شکست شبکه هنگام COMMIT نامعلوم می‌ماند و هرگز به Rollback قطعی تبدیل نمی‌شود؛ Retry صرفاً همان Key/Payload.

**Session:** DRAFT + Allocations در یک Commit، Publication با کنترل وابستگی‌ها/قوانین؛ ظرفیت/لغو با قفل Session؛ زمان‌های تصمیم‌گیری Transaction از clock_timestamp در PostgreSQL. فواصل نیمه‌باز و Bufferهای منابع حفظ می‌شوند.

**Governance:** Invitation/Acceptance و Consent Grant/Revoke با Tenant/AuthSession Lock، Audit و Outbox اتمی هستند؛ ترتیب و رفتار هنگام رقابت در PG17 `NOT VERIFIED`.

**Outbox:** Claim کوتاه `SKIP LOCKED`، اجرای Handler داخلی و Receipt/Fence در تراکنش نهایی؛ پردازش at-least-once و تحمل Crash نیازمند اجرای دو Worker است.

**Inspector:** هر صفحه تنها `BEGIN READ ONLY` دارد و **Snapshot واحد بین چند صفحه وجود ندارد**. `asOf` فقط مرز زمانی درج رکوردهای جدید است و به‌تنهایی جلوی تغییر هم‌زمان رکوردهای قبلی را نمی‌گیرد. خروجی هرگز Integrity Certification نیست.
