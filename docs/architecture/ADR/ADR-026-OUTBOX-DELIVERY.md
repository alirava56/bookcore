# ADR-026 — At-least-once PostgreSQL Outbox

**وضعیت:** پیاده‌سازی کاندیدا؛ PostgreSQL Runtime معوق.

گزینهٔ انتخابی: `FOR UPDATE SKIP LOCKED` + Lease کوتاه + Idempotent Durable Projection با Unique(event_id). Side effect داخلی و `published_at` در یک Transaction؛ Workerهای چندگانه با Claim Ownership از Double Claim محافظت می‌شوند. Backoff محدود و Quarantine برای Poison Event وجود دارد. Worker Process از Monolith جدا اجرا می‌شود ولی کد و DB مشترک است. پیام‌رسان خارجی در MVP پیاده‌سازی نشده است.

گزینهٔ حذف‌شده: Redis Counter، Queue حافظه‌ای یا ادعای exactly-once Network Delivery. Trade-off: Worker می‌تواند event را بعد از Failure مجدداً Handle کند، اما Receipt واحد است. ترتیب per Aggregate با `(created_at,id)` بهترین تلاش است و اثبات Total Causal Order نیست؛ Payload V1 برای Producerهای موجود از نوع Object است و یک Contract Registry کامل هنوز نیازمند گسترش است.
