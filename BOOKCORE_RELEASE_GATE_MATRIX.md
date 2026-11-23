# ماتریس نهایی Release Gate

تاریخ محلی ۲۰۲۶-۱۱-۲۴. PASS در این جدول به محیط مصنوعی همین اجرا محدود است. وضعیت انتشار نهایی NO-GO است.

| گیت | الزام | پیاده‌سازی | اجرا | نتیجه | فرمان دقیق و کد خروج | شاهد در evidence/final | محدودیت |
|---|---|---|---|---|---|---|---|
| G01 | قفل واقعی | IMPLEMENTED | EXECUTED | PASS | npm install --package-lock-only --ignore-scripts --no-audit --no-fund، ۰ | npm-ci-audit.log و package-lock.json | نصب از npm Registry |
| G02 | نصب تمیز | IMPLEMENTED | EXECUTED | PASS | npm ci --no-audit --no-fund، ۰ | npm-ci-audit.log | Node 22.23.5 |
| G03 | TypeScript | IMPLEMENTED | EXECUTED | PASS | npm run typecheck، ۰ | final-cert.log | strict فعال |
| G04 | ESLint | IMPLEMENTED | EXECUTED | PASS | npm run lint، ۰ | final-cert.log | پیکربندی سخت‌گیرانه حفظ شد |
| G05 | Build | IMPLEMENTED | EXECUTED | PASS | npm run build و docker build --pull=false -f infra/docker/Dockerfile -t bookcore-final-app:verified .، هر دو ۰ | final-cert.log و image-final.log | build محلی |
| G06 | Bootstrap | IMPLEMENTED | EXECUTED | PASS | docker run و درخواست‌های HTTP با Node fetch، ۰ | production-image.log | پردازهٔ OCI با UID 10001 اجرا و با کد ۰ متوقف شد |
| G07 | مهاجرت PostgreSQL 17 | IMPLEMENTED | EXECUTED | PASS | npm run migrate دوبار و node scripts/verify-migration-checksums.cjs، ۰ | final-cert.log و database-acl.log | ۱۵ مهاجرت، ۱۲ فایل تاریخی دست‌نخورده |
| G08 | گردش‌کار HTTP | IMPLEMENTED | EXECUTED | PASS | npm run test:database و npm run test:concurrency، ۰ | final-cert.log و http-coverage.json | ۴۶ عملیات دامنه و Metrics |
| G09 | ظرفیت و هم‌زمانی | IMPLEMENTED | EXECUTED | PASS | npm run test:concurrency، ۰ | capacity.json و final-cert.log | ۶ اجرای ۱۰۰‌درخواستی در دو پردازه |
| G10 | Idempotency و ایمنی تراکنش | IMPLEMENTED | EXECUTED | PASS | npm run test:database و npm run test:concurrency، ۰ | final-cert.log | خطای ACK پس از COMMIT واقعی در مرز درایور تزریق شد |
| G11 | احراز هویت و مجوز | IMPLEMENTED | EXECUTED | PASS | npm run test:unit و npm run test:database و npm run test:concurrency، ۰ | final-cert.log | پوشش محلی در دامنهٔ آزمون |
| G12 | جداسازی مستأجر | IMPLEMENTED | EXECUTED | PASS | npm run test:database و npm run test:concurrency، ۰ | final-cert.log و database-acl.log | محیط مصنوعی |
| G13 | اطمینان‌پذیری Outbox | IMPLEMENTED | EXECUTED | PASS | npm run test:concurrency و drill دو پردازه و SIGKILL، ۰ | final-cert.log، workers.log و worker-crash.log | ارسال خارجی جزو این اجرا نبود |
| G14 | Backup، Restore و PITR | IMPLEMENTED | EXECUTED | PASS | npm run test:recovery، pg_basebackup -X stream -c fast، pg_verifybackup و بازپخش WAL، ۰ | recovery-final.log و pitr.log | جداسازی سازمانی provenance و RPO/RTO محیط هدف بازند |
| G15 | Metrics و Readiness | IMPLEMENTED | EXECUTED | PASS | npm run test:database و بررسی HTTP تصویر Docker، ۰ | production-image.log و final-cert.log | کلید مصنوعی، مسیر ناشناس رد شد |
| G16 | CI | PARTIAL | BLOCKED | NOT VERIFIED | actionlint 1.7.7، ۰؛ GitHub Actions اجرا نشد | actionlint.log | اجرای Actions در مقصد تحویل جداگانه ثبت می‌شود |
| G17 | ممیزی امنیت نهایی | PARTIAL | EXECUTED | NOT VERIFIED | npm audit --json، ۰؛ gitleaks dir --redact=100، ۱ با ۸۴ علامت نمونهٔ تاریخی، Fixture یا checksum | npm-ci-audit.log و secret-adjudication.log | تأیید مستقل و بررسی محیط هدف باز است |
| G18 | یکپارچگی بسته | IMPLEMENTED | EXECUTED | PASS | npm run manifest:freeze و npm run verify:release-manifest، ۰؛ بررسی CRC و Manifest ZIP | MANIFEST.md و فایل SHA-256 کنار ZIP | digest یکپارچگی، بدون امضای ناشر |
