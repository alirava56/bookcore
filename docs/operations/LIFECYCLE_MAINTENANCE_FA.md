# نگه‌داری عمر رکوردها

تنها Cleanup عملی در این فاز حذف **Bucket قدیمی Rate Limit** است. `bookcore_prune_auth_rate_buckets(limit,hours,reason,apply)` به LOGIN مستقل `bookcore_maintenance` نیاز دارد و اتصال را با `session_user` به Registry هویت واقعی متصل می‌کند. `limit ∈ [1,100]`، `hours ∈ [48,8760]`، دلیل ۱۰ تا ۵۰۰ نویسه. در حالت Preview هیچ حذفی صورت نمی‌گیرد. عملیات APPLY از `FOR UPDATE SKIP LOCKED`، تراکنش کوتاه و Audit الحاقی استفاده می‌کند.

```bash
BOOKCORE_MAINTENANCE_DATABASE_URL='postgres://MAINT_LOGIN@localhost:5432/bookcore' npm run ops:maintenance -- preview 50 48 'Old authentication buckets cleanup'
BOOKCORE_MAINTENANCE_DATABASE_URL='postgres://MAINT_LOGIN@localhost:5432/bookcore' npm run ops:maintenance -- apply 50 48 'Approved rotation of old auth buckets'
```

دستورات مثال نیازمند ساخت Login واقعی خارج از بسته هستند. `scripts/prune-auth-rate-limits.ts` نامحدود قبلی دیگر اجرا نمی‌شود.

## تعویق آگاهانه
- `idempotency_records`: پاک‌سازی غیرفعال (`IDEMPOTENCY_PURGE_ALLOWED=false`)؛ دلیل: ابهام دورهٔ بازیابی، Expired Key و Commit نامعلوم؛ قابلیت هنوز PARTIAL.
- دعوت و رضایت منقضی: در پذیرش و مجوز جدید معتبر نیستند؛ تاریخچه به‌صورت غیرمخرب باقی می‌ماند.
- Outbox: Lease منقضی مطابق Fence موجود بازیابی می‌شود؛ حذفی روی Event/Receipt وجود ندارد.
- AuthSession، Refresh و Audit: بدون سیاست Retention تأییدشده حذف نمی‌شوند.

آزمایش هم‌زمانی Cleanup/Request و آزمون پایداری PostgreSQL هنوز NOT VERIFIED است.
