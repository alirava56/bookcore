# نتایج آزمون واقعی BookCore

| فرمان | خروجی | شاهد |
|---|---|---|
| `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` و به‌روزرسانی `typescript-eslint@8.74.0` | قفل تولیدشده از npm Registry | `package-lock.json` و `evidence/final/npm-ci-audit.log` |
| `npm ci --no-audit --no-fund` | ۰، نصب ۲۶۷ بسته در Node 22 | `evidence/final/npm-ci-audit.log` |
| `npm audit --json` | ۰، صفر advisory در گراف بررسی‌شده | `evidence/final/npm-ci-audit.log` |
| `npm run typecheck`، `npm run lint` و `npm run build` | ۰ برای هر فرمان | `evidence/final/final-cert.log` |
| `npm run migrate` دو بار | ۰، اعمال و سپس تطبیق هر ۱۵ مهاجرت | `evidence/final/final-cert.log` |
| `npm run test:unit` | ۰، ۱۴۴ قبول | `evidence/final/final-cert.log` |
| `npm run test:database` | ۰، ۳۶ قبول | `evidence/final/final-cert.log` |
| `npm run test:concurrency` | ۰، ۲۲ قبول | `evidence/final/final-cert.log` |
| `npm run test:recovery` | ۰، یک قبول در محیط جدا با dump رمزنگاری‌شده | `evidence/final/recovery-final.log` |
| `python tools/phase09_validate_openapi.py docs/api/implemented.openapi.json` | ۰، تطبیق ۴۶ عملیات طراحی | `evidence/final/checks.log` |

در مجموع ۲۰۳ آزمون در مجموعه‌های فوق قبول شدند و هیچ آزمون آن‌ها skip یا cancel نشد. آزمون‌های تاریخیِ خالص و بررسی‌های ساختاری نیز جدا اجرا شدند. تطبیق ترافیک واقعی ۴۶ عملیات طراحی و Metrics خصوصی در `evidence/final/http-coverage.json` ثبت شده است. `POST /organizations/{orgId}/members` طبق سیاست دعوت با 409 رد می‌شود. آزمون روش‌های HTTP همراه با بررسی‌های وضعیت پایگاه داده و مقایسهٔ OpenAPI انجام شد.
