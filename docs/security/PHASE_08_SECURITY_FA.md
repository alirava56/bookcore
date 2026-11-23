# کنترل‌های امنیتی فاز ۰۸

Reporting از APP_GUARD موجود استفاده می‌کند و بدون Public Decorator است؛ CTE عضویت/نشست/کاربر/سازمان را همراه با Scope داده می‌سنجد. فقط OWNER و MANAGER گزارش می‌خوانند؛ Receptionist/Trainer/Customer نباید دسترسی بگیرند. خروجی صرفاً شمارنده است. Query بازهٔ ۳۱ روزه و پارامتری بوده و از SQL Identifier ورودی استفاده نمی‌کند.

Worker هیچ HTTP Endpoint اضافه نمی‌کند؛ فقط با Login محدود PostgreSQL کار می‌کند. Payload با نوع، نسخه و مالکیت Aggregate کنترل می‌شود و Secret-patternها Reject می‌شوند. Log خطا به کد امن محدود است و شامل متن Exception، Token، Password یا SQL نیست. اجازهٔ تغییر Audit Events یا Userها به Worker داده نمی‌شود. مرور منظم Role Grants، عدم استفاده از Owner و Secret Rotation ضروری است.

ریسک‌های موروثی: Refresh Token Lost-Acknowledgement، Consent رزرو توسط کارکنان، Membership دعوت‌نشده، SQL Constraints معوق، Unknown COMMIT، تعارض Lock بین Moduleها، و تمام Test Gateهای فاز دوم هنوز باقی‌اند. هیچ تست مستقل امنیتی PostgreSQL اجرا نشده است.
