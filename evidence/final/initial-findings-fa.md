# بررسی مبنا و محیط اولیه

ZIP فاز ۱۶ و کپی کاری اولیه ۶۹۲ ورودی Manifest منطبق داشتند. ZIP با آزمون CRC بررسی و جداگانه استخراج شد. SHA-256 مبنا 3bbb7de9e3f921bf02f6c0d2c8e1ec64bd106efd1b08f8663a5fb40502171930 و SHA-256 Manifest مبنا e182d7435c75a619e18b34c929390252e2d9b40d095b8ec5dd7c86f9ebc432e است.

میزبان Windows به‌صورت اولیه Node 24.18 و npm 11.16 داشت. Docker Engine 29.6.2 در دسترس و psql و gh در PATH میزبان غایب بودند. آزمون‌ها با Node 22.23.5، npm 10.9.9 و PostgreSQL 17.6 در Docker اجرا شدند. کپی اولیه Git و lockfile نداشت. مسیرهای apps/api/src، scripts و مهاجرت‌ها فعال بودند. پروژه‌های reference در build مشارکت نداشتند.

اجرای اولیهٔ node scripts/run-tests.cjs recovery با پرچم‌های محیط موقت و بدون digest با کد خروج ۲ متوقف شد. npm ci سپس موانع واقعی TypeScript، ESLint، قفل PG و پارامتر SQL را نمایان کرد. نتیجهٔ نهایی در ماتریس گزارش شده است. دستورهای اولیهٔ git remote -v و git branch --show-current با کد ۱۲۸ شکست خوردند و جست‌وجوی نصب‌های احراز‌شدهٔ GitHub صفر مقصد BookCore نشان داد.
