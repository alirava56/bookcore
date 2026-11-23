# ممیزی کنترل دسترسی فاز یازدهم

۱. گارد سراسری: `CommonModule` با `APP_GUARD=GlobalAuthGuard`؛ عمومی فقط Routeهایی با `@Public` (ثبت‌نام/ورود/Refresh، Live، Session Discovery). Readiness به MonitorGuard/مدار شبکه وابسته است و عمومیِ آزاد نیست. صحت Runtime `NOT VERIFIED`.

۲. User مستقل از Staff Membership: Self Booking با `AuthenticatedPrincipal` و CustomerId مشتق‌شده از توکن، ولی Calendar/CRUD سازمان تنها Membership مناسب دارد. TRAINER در خواندن Session به Resource خودش محدود است. OWNER/MANAGER در گزارش‌گیری مجاز؛ Staff دیگر ممنوع. Cross-tenant Query باید OrgId و Actor Scope هم‌زمان داشته باشد.

۳. Consent: یک Grant مرتبط با User و Tenant نمی‌تواند توسط کارمند ساخته شود. قبل از Staff Booking باید Consent زنده و Role همان Tenant در همان تراکنش دوباره بررسی شود. رقابت Revocation در DB واقعی هنوز تأیید نشده است.

۴. Ops: `bookcore_inspector` تنها از SQL تابع امن و LOGIN واقعی استفاده می‌کند. در 012، `session_user` با `bookcore_operator_identities` و ACTIVE OWNER مرتبط می‌شود و `bookcore_app`/Worker/PUBLIC حق فراخوانی تابع را ندارند. تغییرات Registry نیازمند پروسهٔ DBA و Audit اختصاصی است. Credential مشترک انتساب را مخدوش می‌کند؛ در Production ممنوع.

۵. تهدیدهای باقیمانده: JWT و Rate Limit پشت Proxy، جعل GUC/SET ROLE، SQL Injection، Least Privilege واقعی، Event-Schema تاریخی و توکن Invitation. آزمون‌های منفی PostgreSQL فاز ۱۱ تعریف شدند اما اجرا نشده‌اند.
