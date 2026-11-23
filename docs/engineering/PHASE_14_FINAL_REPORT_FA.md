# BookCore — Phase 14 Final Engineering Report

**تاریخ:** ۲۳ نوامبر ۲۰۲۶  
**حکم:** `PHASE14 SOURCE REMEDIATION CANDIDATE — CRITICAL RUNTIME RELEASE GATES BLOCKED`  
**Production:** NO-GO. فاز ۱۵ آغاز نشده؛ هیچ Push یا Deploy انجام نشده است.

## ورودی و ممیزی

آرشیو Phase13 با CRC صحیح و Manifest شامل ۵۴۵ فایل معتبر بررسی شد. ممیزی مستقل فاز ۱۳ نیز خوانده و یافته‌های P1/P2 با فایل‌های واقعی منطبق شدند. Migrationهای 001–012 تاریخی بدون ویرایش حفظ شدند. سابقهٔ فازهای قبل و تست‌های اصلی حذف نشده‌اند.

## اصلاحات واقعی در سورس

۱. `scripts/recovery/policy.cjs`: امکان اجرای Restore با ابزار انتخاب‌شده از PATH در محیط توسعه/تست حذف شد. مسیرهای Absolute و Trust مالکیت/Permission و پوشه‌های والد برای عملیات دارای اختیار بررسی می‌شوند.

۲. `scripts/recovery/restore.cjs` و `verify-backup.cjs`: فراخوانی‌های دارای اختیار به ابزارهای پین‌شده ارجاع می‌دهند؛ فایل Private Identity قبل از Decrypt کنترل می‌شود. گواهی CA عمومی می‌تواند مجوز خواندن عادی داشته باشد و نباید نیازمند حالت Secret=0600 باشد.

۳. `apps/api/test/integration/booking-postgres.test.ts`: اعتبارسنجی صریح ۱۰۰ نتیجه؛ تنها 201 معتبر و 409/SESSION_FULL معتبر پذیرفته می‌شود. Timeout هر درخواست ۲۰ ثانیه است. 503/429/409 نامعتبر و خطاهای انتقال FAIL می‌شوند؛ بازشماری رکوردهای Commitشده و دو Worker موجود حفظ شدند.

۴. `contention-result.ts` و تست‌های Phase14: پنج سناریوی مثبت/منفی دربارهٔ ظرفیت و خطای 5xx، به‌علاوهٔ هفت تست امنیتی فایل/ابزار اجرا شدند.

۵. `phase14-runtime-smoke.test.ts`, `phase14-runtime-preflight.cjs`, `phase14-verify-runtime.sh`, Compose مستقل و Workflow CI اضافه شدند. **وجود این ابزارها گواه اجرای واقعی آن‌ها نیست.**

## شواهد واقعی فرمان‌ها

| آزمون | وضعیت | شاهد |
|---|---|---|
| Pure/Mock فازهای ۰۵–۱۴ | 115 PASS، صفر FAIL | `evidence/phase14/test_*.log`, `pure_summary.log` |
| TypeScript Parse/relative imports | PASS، 115 فایل TS | `command_node_tools_phase09_syntax_check.cjs.log` |
| Strict Typecheck دامنهٔ Pure جدید | PASS | `typecheck_pure_phase14.log` |
| Source Static و Reference | PASS | `command_npm_run_verify_static.log`, `verify_reference.log` |
| OpenAPI | PASS، ۴۶ عملیات/۵۰۷ ارجاع | `command_python_tools_phase09_validate_openapi.py.log` |
| npm Lockfile generation | TIMEOUT، Exit 124 | `npm_lock_attempt.log`, `npm_lock_exit.txt` |
| `npm ci --offline` | FAIL، Exit 1؛ Lockfile وجود ندارد | `command_npm_ci___offline___ignore_scripts___no_audit___no_fund.log` |
| Full Typecheck | FAIL، Exit 2؛ Missing npm types | `command_npm_run_typecheck.log` |
| ESLint | FAIL، Exit 127؛ وابستگی نصب نیست | `command_npm_run_lint.log` |
| Full Build | FAIL، Exit 1؛ وابستگی موجود نیست | `command_npm_run_build.log` |
| Unit Test Runner compiled | FAIL، Exit 2؛ Build موجود نیست | `command_npm_run_test_unit.log` |
| PostgreSQL17, HTTP, two-Worker, Restore, PITR | NOT RUN / NOT VERIFIED | ابزارهای اجرایی در این محیط موجود نیستند |
| CI GitHub Actions | NOT RUN / NOT VERIFIED | Workflow منبع موجود است، اجرای GitHub صورت نگرفته |

**توضیح:** آزمون‌های Mock و Pure فقط خود منطق ارزیاب/Policy را می‌سنجند. هیچ Benchmark، SQLSTATE واقعی، تأیید ظرفیت دیتابیس یا نتیجهٔ Restore تولید نشده است. AST بدون Typecheck کامل معادل Build نیست.

## Gateها: پیاده‌سازی / اجرا / نتیجه

| Gate | موضوع | Implementation | Execution | Result |
|---|---|---|---|---|
| G1 | ایرادهای فاز ۱۳ | IMPLEMENTED (source) | EXECUTED (Pure) | NOT VERIFIED (runtime) |
| G2 | Reproducible Dependencies | PARTIAL | BLOCKED | FAIL |
| G3 | TypeScript/NestJS Build | PARTIAL | EXECUTED (failed) | FAIL |
| G4 | PG17 Migration | PARTIAL | NOT RUN | NOT VERIFIED |
| G5 | MVP HTTP Integration | PARTIAL | NOT RUN | NOT VERIFIED |
| G6 | Booking Concurrency | PARTIAL | NOT RUN | NOT VERIFIED |
| G7 | Idempotency/Unknown Commit | PARTIAL | NOT RUN | NOT VERIFIED |
| G8 | Tenant Auth/Security | PARTIAL | NOT RUN | NOT VERIFIED |
| G9 | Worker Runtime | PARTIAL | NOT RUN | NOT VERIFIED |
| G10 | Metrics/Readiness | PARTIAL | NOT RUN | NOT VERIFIED |
| G11 | Backup/Restore | PARTIAL | EXECUTED (Mock only) | NOT VERIFIED |
| G12 | CI Reproducibility | PARTIAL | NOT RUN | NOT VERIFIED |

## پذیرش بعدی

در محیط واقعی و مجاز: Lockfile اصیل از npm تولید، `npm ci/typecheck/lint/build` اجرا، PG17 ایزوله با نقش‌های مستقل آماده، Migration 001–012 دو بار اجرا، Runtime Smoke و همهٔ تست‌های HTTP/PG/Worker اجرا، سناریوهای ظرفیت ۱ و ۲۰ با دو Process و سه تکرار بر اساس Commit بررسی، و Restore واقعی + WAL/PITR Drill مستقل انجام شود. هر Failure جدید باید با سورس و تست رگرسیون اصلاح شود؛ از کاهش قیدها برای سبز کردن تست خودداری شود.

**حکم Release:** `NO-GO — ARCHITECTURAL/RUNTIME RELEASE BLOCKERS REMAIN`. وضعیت پیاده‌سازی اصلاحات سورسی اجازهٔ ادامهٔ ممیزی مهندسی می‌دهد، نه استفاده از دادهٔ واقعی یا Production.
