# نگه‌داری فاز ۱۲

## ابزارها

- `npm run ops:backup -- --dir <absolute-private-dir>`: backup با pg_dump، فایل .pending، Manifest و Verify آرشیو
- `npm run ops:backup:verify -- --manifest <absolute-path>`: SHA-256 و `pg_restore --list`
- `npm run ops:restore -- --manifest <path> --target-db <disposable>`: پیش‌نمایش فقط‌خواندنی؛ `--execute` نیازمند شرط‌های چندلایه
- `npm run ops:retention:preview -- --dir <path>`: Preview بدون Delete
- `npm run ops:storage:inspect`: نمای تخمینی از حجم جداول منتخب `pg_stat_user_tables`، بدون اسکن دقیق شمارنده‌ها
- `npm run ops:inspect:paged`: Inspection موروثی، با خروجی جدید `selectedScopeComplete` و `allSupportedKindsCovered`

نگه‌داری RateLimit موروثی در `scripts/lifecycle-maintenance.ts` دست‌نخورده است؛ پاک‌سازی Idempotency، Audit یا Booking همچنان ممنوع است. Cron/Scheduler خودکار Backup هنوز فعال نشده است، چون تأیید مسیر مخزن/رمزنگاری/کلید لازم است. ترجیح با Job Runner بیرون از API و Credential اختصاصی است.

## خطا و Exit Code

Backup/Restore روی هر شکست Exit 1 و فقط کد خطای ایمن می‌دهند؛ موفقیت Mock در تست‌ها ربطی به PostgreSQL ندارد. Inspector در حالت انتخاب تنها یک Kind: Exit0 فقط با پیمایش کامل آن Kind بدون Finding؛ Exit2 با Finding؛ Exit3 با ناتمام‌ماندن محدودهٔ انتخابی. `coverageComplete` برای سازگاری یعنی اتمام همهٔ شش Kind؛ `consistentSnapshot=false` و `certifiedIntegrity=false` همیشه پابرجاست.

## خطاهای هم‌زمانی

هیچ Cleanup جدیدی Lock طولانی روی Booking نمی‌گیرد. روی Backups هش و پروندهٔ Artifact را در Storage مستقل نگه دارید؛ در صورت خرابی File، نسخهٔ خراب را Quarantine و به‌هیچ‌وجه با فایل دیگری جایگزین بی‌لاگ نکنید.
