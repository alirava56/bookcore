# BookCore Phase 04 — مدل هویت و عضویت

**وضعیت: پیاده‌سازی سورس انجام شده؛ صحت اجرایی PostgreSQL و NestJS هنوز تأیید نشده است.**

## حدود مالکیت
- `users` هویت جهانی است، نه وابسته به سازمان؛ عضویت یک رکورد در `memberships(tenant_id,user_id)` با نقش‌های صرفاً کارکنان است. Customer نقش کارکنان نیست.
- `password_credentials` رابطهٔ یک‌به‌یک با User دارد. حساب‌های Legacy فاقد Credential حفظ می‌شوند؛ تا فراهم‌کردن فرایند امن بازیابی/تعیین رمز، ورود رمزدار ندارند.
- شناسهٔ ایمیل برای ثبت‌نام با `trim().toLowerCase()` نرمال می‌شود و UNIQUE روی `lower(btrim(email))` در دیتابیس پیاده شده است. اگر داده‌های Legacy پس از نرمال‌سازی تضاد داشته باشند، Migration 005 با خطا متوقف می‌شود و داده به‌طور خودکار تغییر نمی‌کند.
- وضعیت User `ACTIVE/SUSPENDED` مستقل از وضعیت Membership `ACTIVE/REVOKED` است. Suspension مانع Login و استفاده از Session موجود می‌شود، بدون حذف تاریخچه.
- مالکیت Booking به Customer User تعلق دارد؛ فاز چهارم هیچ Booking HTTP endpoint جدیدی نمی‌سازد.

## قرارداد پاسخ `/me`
```json
{"user":{"id":"<uuid>","email":"user@example.invalid","status":"ACTIVE"},"memberships":[]}
```
آرایه صرفاً عضویت‌های `ACTIVE` در Tenant را شامل می‌شود، هر Membership شامل `tenantId,userId,role,status` و فاقد هرگونه اطلاعات محرمانه است؛ مطابق `docs/api/openapi.yaml`.

## مرزهای تراکنش
- ثبت‌نام: `users + password_credentials` در یک تراکنش و ایمیل یکتا در DB.
- Login: بررسی Argon2id خارج از TX، سپس بررسی مجدد Active User در TX و درج Session و Refresh verifier اتمیک.
- Refresh: ابتدا Session row lock، سپس Refresh token row lock، مصرف توکن و درج یک Child داخل همان TX؛ Replay شناخته‌شده با Revocation در همان TX Commit می‌شود.
- Organization create: AuthSession تحت قفل خوانده می‌شود؛ Organization + OWNER Membership + AuditEvent در همان تراکنش ثبت می‌شوند.
- Member mutation: `lock_bookcore_organization()` → `AuthSession FOR SHARE` → Actor Membership FOR SHARE → Target Membership FOR UPDATE. تغییر و AuditEvent اتمیک هستند.

## سیاست عضویت
OWNER می‌تواند نقش‌های مجاز کارکنان، از جمله OWNER دیگر، را ایجاد/تغییر دهد. MANAGER فقط RECEPTIONIST/TRAINER را ایجاد/ویرایش می‌کند و اجازهٔ تغییر نقش خودش را ندارد. آخرین OWNER فعال را نمی‌توان لغو/تنزل داد. RECEPTIONIST و TRAINER مدیریت اعضا ندارند. Tenant ناموجود یا خارج از دسترس با 404 پنهان می‌شود و نقش ممنوع در Tenant شناخته‌شده با 403 رد می‌شود.

**محدودیت:** آزمون‌های Lock، رفتار Migration و امنیت بین Replicaها بدون PostgreSQL واقعی `NOT VERIFIED` هستند.
