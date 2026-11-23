# سیاست لاگ و حذف دادهٔ حساس

`JsonLogger.event()` اکنون قبل از Serializing، فیلدها را به Allowlist کوچک محدود می‌کند. کلیدهای `password`, `authorization`, `refreshToken`, `secret`, `customerId`, Body خام و Error object ثبت نمی‌شوند. `requestId` فقط UUID سروری است؛ `route` باید الگوی مسیرِ کنترلر باشد. برای خطاهای SQL، کد دسته‌بندی‌شده ثبت می‌شود، نه SQL یا DSN.

در فرایند Backup/Restore فقط Error Code ثابت و وضعیت مرحله چاپ می‌شود؛ کلید `age`، محتوای بکاپ و `PGPASSWORD` هرگز لاگ نمی‌شوند. JSON Worker فقط شمارش رویدادهای Poll را ثبت می‌کند. Logging در سطح Debug نیز مجوز ثبت Payload مشتری نیست.

تست Pure فاز ۱۳ از لاگ شامل Token آزمایشی و شناسهٔ مشتری، عدم عبور از Allowlist را بررسی می‌کند. Audit جامع همهٔ Loggingهای موروثی در Runtime همچنان `NOT VERIFIED` است.
