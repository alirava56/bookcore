# ADR-024 — Lock ordering, consent fail-closed and idempotent Booking

**Status:** source-level decision / database behavior not runtime-verified.

- **Lock order:** Organization SHARE برای Booking، پیش از AuthSession SHARE، Membership SHARE در عملیات کارمندی، Idempotency row, Session UPDATE, Booking UPDATE، سپس Event/Audit/Outbox. عملیات مدیریتی فاز ۰۶ Organization UPDATE دارد؛ این قفل با SHARE سازگار از حیث ترتیب (نه قابلیت هم‌زمانی) است.
- **Reason:** جلوگیری از بن‌بست Org/Session و از Head-of-line Blocking غیرضروری برای مشتریان Sessions مختلف.
- **Cost:** Write اداری ممکن است تا اتمام رزروهای درحال‌جریان صبر کند؛ بار بالا و Transaction Duration نیازمند اندازه‌گیری است.
- **Consent:** ارسال `customerId` برای on-behalf فعلاً خطای 403 و بدون Side Effect دارد. افزودن mandate/invitation بعد از تایید محصول و Threat Model انجام شود.
- **Cutoff:** `cancellation_cutoff_min` فقط لغو مشتری را محدود می‌کند. ایجاد Booking تا پیش از شروع Session مجاز است.
- **Idempotency:** Key scope Tenant+Actor+Operation، Fingerprint کاننیکال، ثبت نتیجه در همان TX، Reuse نامعتبر 409، COMMIT نامعلوم 503 و Retry همان Key. قفل Idempotency قبل از Session؛ Authorization کارمندی قبل از Claim.
- **Evidence:** Pure domain tests executed; PG concurrency / rollback / role races remain NOT VERIFIED. No historical migration was altered.
