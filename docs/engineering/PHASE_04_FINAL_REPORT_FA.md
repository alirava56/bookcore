# BookCore Phase 04 — گزارش نهایی مهندسی (فارسی)

**حکم فنی: `SOURCE IMPLEMENTATION CANDIDATE — RUNTIME VERIFICATION DEFERRED`، نه محصول Production-Ready.**

## خلاصهٔ اجرایی
پیاده‌سازی کاندیدای فاز چهارم در پوشهٔ پروژه انجام شد: ماژول‌های Identity و Organizations، گارد سراسری، سرویس رمز Argon2id، JWT HS256 با kid rotation، AuthSession، Refresh Rotation، ثبت‌نام/ورود/خروج/Me، سازمان/Owner و مدیریت اعضا. Migrationهای ۰۰۱–۰۰۴ تغییر نکرده و Migration ۰۰۵ افزایشی اضافه شده است. Outbox و Audit تغییرات سازمان/عضویت در همان Transaction نوشته می‌شوند.

هیچ اجرای واقعی NestJS، تست PostgreSQL، `npm ci` موفق یا GitHub Actions در این محیط اتفاق نیفتاده است. اجرای منبعِ تایپ‌اسکریپت به‌تنهایی به معنی اثبات امنیت و صحت تراکنش نیست.

## خروجی‌ها و منبع حقیقت
- فایل‌های سورس: `apps/api/src/modules/identity`, `organizations`, `common/security`, `config`, `bootstrap`, `app.module`, `infrastructure`.
- Schema جدید: `db/migrations/005_identity_security.sql`؛ چهار Migration اصلی byte-for-byte با منبع فاز سوم برابرند.
- تست‌ها: 12 فایل TypeScript با 39 فراخوانی `test()` در سورس؛ **۰** تست NestJS/PostgreSQL در محیط حاضر اجرا شده.
- قرارداد طراحی همچنان `docs/api/openapi.yaml` است. Generator فقط Endpointهای فعلی را پس از نصب وابستگی‌ها خروجی می‌دهد؛ فایل Generated واقعی ساخته نشد.
- تاریخچهٔ Phase01/02/03، ADRها، کد Spike و Register معوق حفظ شده‌اند.

## اصلاحات معماری
۱. R-01: `APP_GUARD` واقعی در Composition Root ثبت شد؛ دسترسی عمومی محدود به Decorator متد مشخص است. Ready با MonitorGuard مستقل محافظت می‌شود.
۲. R-02: `AppModule.forRoot(config)` و تست عدم تطابق Config، یک شیء Config معتبر را به Nest و Bootstrap منتقل می‌کند.
۳. R-03: Database Readiness به وجود پنج Migration و جدول‌های Identity نیاز دارد؛ جایگزین Deep Integrity Check نیست.
۴. R-04: CORS با GET/HEAD/POST/PATCH/OPTIONS و Content-Type/Authorization، Allowlist و بدون Wildcard/Credentials.
۵. R-05: تلاش برای Lockfile واقعی با خطای Registry متوقف شد؛ Hash ساختگی اضافه نشده است.
۶. Auth: JWT با kid/issuer/audience/exp/alg pinning و Session/User check در DB برای هر عملیات محافظت‌شده؛ Revocation فوری نسبت به DB.
۷. Membership: Organization lock، AuthSession + Membership recheck داخل TX، Role Matrix، Last Owner trigger، AuditEvent و Outbox.
۸. Read isolation: GET سازمان و List عضویت Query مجوز Actor را همراه با داده محدود می‌کنند تا یک Precheck قدیمی منجر به افشای داده نشود.

## اعتبارسنجی‌های واقعاً اجراشده
| کنترل | نتیجه | شواهد |
|---|---|---|
| TypeScript AST parse، بدون بررسی نوع | PASS؛ ۴۵ فایل | `evidence/phase04/syntax_scan.log` |
| Structural source assertions | PASS | `evidence/phase04/invariant_audit.log` |
| SHA256 چهار Migration قدیمی | PASS | `invariant_audit.log` |
| YAML Strict + Duplicate Key + ۴۲۳ `$ref` | PASS | `contract_check.log` |
| تطبیق ۱۲ عملیات فاز ۰۴ با OpenAPI Design | PASS (Static) | `contract_check.log` |
| Manifest/Reference source | PASS | `reference_check.log` |
| Zero-test runner selftest | PASS | `zero_runner.log` |
| npm lockfile | FAIL؛ ENOTCACHED | `npm_lockfile_attempt.log` |
| npm ci | FAIL؛ Lockfile موجود نیست | `npm_ci_attempt.log` |
| Typecheck و Build با Dependency واقعی | FAIL؛ Dependencyها نصب نشده‌اند | `typecheck_attempt.log`,`build_attempt.log` |
| ESLint | FAIL؛ نصب نیست | `lint_attempt.log` |
| Unit tests اجراشده | ۰؛ NOT VERIFIED | `test_unit_attempt.log` |
| PostgreSQL/Migration/Concurrency/CI | NOT VERIFIED | پیش‌نیاز اجرایی در محیط نیست |

## Gateهای Phase 04 (Implementation مستقل از Verification)
| Gate | موضوع | Implementation | Verification |
|---|---|---|---|
| G1 | Global fail-closed authorization | IMPLEMENTED | NOT VERIFIED |
| G2 | Identity/password security | IMPLEMENTED | NOT VERIFIED |
| G3 | Login/token validation | IMPLEMENTED | NOT VERIFIED |
| G4 | Refresh/session revocation | PARTIAL | NOT VERIFIED |
| G5 | Organization ownership | IMPLEMENTED | NOT VERIFIED |
| G6 | Membership/RBAC | IMPLEMENTED | NOT VERIFIED |
| G7 | Cross-tenant isolation | PARTIAL | NOT VERIFIED |
| G8 | Migration/codebase integration | PARTIAL | NOT VERIFIED |
| G9 | API contract consistency | PARTIAL | NOT VERIFIED |
| G10 | Tests and reproducibility | PARTIAL | FAIL |

**توجه:** PASS استاتیک برای برخی زیرآزمون‌ها، هیچ Gate امنیتی/دیتابیسی را به PASS عملیاتی تبدیل نمی‌کند.

## Findings و باقیمانده‌ها
- **Blocker A:** npm Registry در محیط در دسترس نبود؛ `package-lock.json` واقعی و `npm ci` موفق در دست نیست. بدون Install، Typecheck و Build واقعی معتبر نیستند.
- **Blocker B:** PostgreSQL 17 و Docker نصب نیستند؛ SQL 005، Trigger آخرین Owner، Race دو Refresh، DB grants و ارتباط چند Replica اثبات نشده‌اند.
- **Blocker C:** خطای COMMIT نامعلوم در Refresh ممکن است با Retry به Replay و ابطال Family منجر شود؛ Recovery Protocol/UX باید قبل از Pilot تعیین و تست شود.
- **Blocker D:** Registry، CI و Generated OpenAPI نیازمند اجرای محیط حقیقی‌اند؛ هیچ اجرای GitHub Actions یا Push انجام نشده است.
- **ریسک P2:** Core Capacity / resource exclusion / deferred triggers و تست‌های ۱۰۰ درخواستی Phase02 همچنان NOT VERIFIED و Gate Reproducibility آن FAIL است؛ هیچ‌کدام در این فاز تضعیف نشده‌اند.
- **ریسک امنیتی:** محدودسازی Role در DB جانشین Authorization در سرویس نیست؛ کاربر Runtime در صورت Compromise ممکن است SQL مستقیم اجرا کند. Scope/Secrets/SQL injection tests ضروری‌اند.
- **ریسک تجاری:** Email Confirmation/MFA و Token delivery در Cookie تعویق یافته؛ Authentication Rate Limits برای NAT/Proxy به تنظیم در Edge نیاز دارند.

## دستورهای عملیاتی بعدی
در محیط دارای Node22، npm Registry و PostgreSQL17، ابتدا از `README.md` راه‌اندازی را دنبال کنید و Lockfile واقعی بسازید؛ سپس `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run migrate` دوبار، `npm run test:unit`, `npm run test:integration`, `npm run openapi:current`. Pending 100-request Phase02 را نیز مستقل اجرا کنید. در صورت وقوع هر Failure، سورس/مهاجرت افزایشی را اصلاح و دوباره اجرا کنید.

## نتیجه و مرز فاز
**Implementation سطح سورس انجام شده، اما تأیید Runtime و Release Gateها معوق است.** ورود به Phase05 تنها به‌عنوان ادامهٔ توسعه مجاز است و هیچ ادعای Production Readiness یا Security Validation نباید انجام شود. Backend رزرو، پرداخت و لیست انتظار در این فاز پیاده‌سازی نشده‌اند. هیچ Push انجام نشده است.
