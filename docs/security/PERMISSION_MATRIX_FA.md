# ماتریس مجوز اجرایی فاز ۰۹

**مبنای اصلی:** `docs/security/AUTHORIZATION_MATRIX.md`، در تضادهای امنیتی اصلاح‌شده اولویت با ADRهای Phase09 و خود سرویس فعلی است. «احراز هویت» حق ورود به دادهٔ Tenant ایجاد نمی‌کند.

| عملیات | عمومی | مشتری Global | TRAINER | RECEPTIONIST | MANAGER | OWNER | شرط اضافی |
|---|---|---|---|---|---|---|---|
| Health live | بله | بله | بله | بله | بله | بله | فقط liveness |
| Health ready | خیر | خیر | خیر | خیر | خیر | خیر | credential و محدودیت مانیتورینگ جداگانه |
| Auth register/login/refresh | طبق قرارداد | بله | بله | بله | بله | بله | throttling جداگانه، session لازم برای سایر عملیات |
| GET /me | خیر | خود | خود | خود | خود | خود | فقط هویت و عضویت‌های فعال |
| Staff invitation create/list | خیر | خیر | خیر | خیر | بله* | بله | MANAGER صرفاً نقش پایین‌تر، داده Tenant |
| Staff invitation revoke | خیر | خیر | خیر | خیر | بله* | بله | دلیل اجباری؛ سطح نقش دعوت |
| Staff invitation accept/decline | خیر | خود | خود | خود | خود | خود | token و invitee واقعی، inviter هنوز مجاز |
| Consent grant/list/revoke | خیر | خود | خود | خود | خود | خود | کاربر به‌عنوان **مشتری خودش**، نه مدیر؛ Tenant معتبر |
| Booking on behalf | خیر | خیر | خیر | بله* | بله* | بله* | رضایت فعال مشتری برای همان سازمان؛ قیود ظرفیت/یکتایی |
| Booking self | خیر | خود | خود | خود | خود | خود | customerId از principal |
| Admin occupancy | خیر | خیر | خیر | خیر | بله | بله | شرط Tenant در SQL |
| Outbox quarantined retry | خیر | خیر | خیر | خیر | خیر | خیر* | CLI + role عملیاتی جدا + OWNER فعلی + دلیل |

`*` شرط اضافی سخت‌گیرانه‌تر از صرف عضویت است.

**کنترل Race:** قفل Organization پیش از قفل AuthSession/Membership/Consent/Idempotency/Session در مسیرهای هم‌پوشان، و بازبینی اعتبار Staff داخل تراکنش. سیاست Revocation پس از Commit قبلی را به گذشته تغییر نمی‌دهد؛ درخواست تازهٔ بعدی مجوز باید جدید بگیرد. نتیجهٔ اجرای واقعی این قفل‌ها هنوز `NOT VERIFIED` است.

**مسیرهای موجود دیگر:** کنترل دقیق Session/Catalog/Reporting طبق ماتریس اصلی بدون تضعیف نگه داشته شده است. اسناد ماتریس اصل لزوماً تأیید عملی تمام Controllerها نیستند.
