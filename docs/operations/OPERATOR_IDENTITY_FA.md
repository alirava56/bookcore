# هویت اپراتور، جداسازی نقش‌ها و Provisioning

**مسئلهٔ اصلاح‌شده:** در Phase09 ابزار Recovery یک Actor UUID را از CLI می‌پذیرفت. مالکیت Tenant برای UUID اعلام‌شده کافی نبود تا ثابت کند فردی که به دیتابیس وصل شده همان Actor است.

**راه‌حل سورس Phase10:** Registry `bookcore_operator_identities(login_role,actor_user_id,enabled)` توسط Migration Owner/DBA مدیریت می‌شود. هر اپراتور LOGIN اختصاصی PostgreSQL دارد. تابع SECURITY DEFINER با `session_user` (نه `current_user` یا Custom GUC) هویت اتصال واقعی را می‌گیرد، Role مجاز/OWNER Tenant را بررسی می‌کند و سپس Audit متصل به همان User و نام LOGIN ثبت می‌کند. `SET ROLE` نمی‌تواند `session_user` را جعل کند. `bookcore_ops`، `bookcore_inspector` و `bookcore_maintenance` همگی گروه‌های `NOLOGIN` هستند. Credential مشترک، PgBouncer transaction pool با هویت مشترک یا Login superuser برای اجرا ممنوع است.

DBA خارج از ریپازیتوری باید برای هر شخص Login مستقل بسازد، یک گروه متناسب اعطا کند و Registry را با User واقعیِ از پیش تأییدشده پر کند:

```sql
-- EXAMPLE ONLY: execute as DB administrator, NOT the API runtime user.
-- CREATE ROLE operator_alice LOGIN PASSWORD '<set securely outside git>';
-- GRANT bookcore_ops TO operator_alice;
-- INSERT INTO bookcore_operator_identities(login_role,actor_user_id,enabled)
-- VALUES('operator_alice','<real verified BookCore user UUID>',true);
```

`REVOKE` تابع Legacy از `bookcore_ops` و حذف SELECT مستقیم روی جدول‌های Outbox برای این نقش در Migration 011 اعمال می‌شود. تابع جدید مستقیماً در SQL عضویت جاری و وضعیت Tenant را بررسی کرده و قبل از Outbox Row، قفل Organization/Membership می‌گیرد. هیچ REST Endpoint مدیریتی اضافه نشده است.

**محدودیت:** دارندهٔ Migration Owner/Superuser در نهایت قدرت DB دارد؛ سیاست پاسخ‌گویی سازمانی و ساخت Credential باید در خارج از اپلیکیشن اجرا شود. تا اجرای منفی با Login واقعی، Gate امنیت عملیاتی NOT VERIFIED است.
