# BookCore — ممیزی مستقل سورس Phase04

**دامنه:** فقط بازبینی استاتیک سورس تولیدشده، تست‌ها، قرارداد و Migration افزایشی. تست واقعی PostgreSQL، NestJS، CI و امنیت نفوذ اجرا نشده و هیچ ادعایی دربارهٔ آن‌ها نداریم.

| ریسک | بازبینی و اصلاح | وضعیت اثبات |
|---|---|---|
| Global Guard فقط Provider باشد | `APP_GUARD` در CommonModule ثبت شد؛ Public صرفاً Metadata سطح متد | Source بررسی شد، runtime NOT VERIFIED |
| Config دوگانه | `AppModule.forRoot(config)` و بررسی هویت آبجکت در Bootstrap | Source بررسی شد، runtime NOT VERIFIED |
| JWT header injection/`none` | kid allowlist، HS256 ثابت، iss/aud/exp/type/sub/sid | Source بررسی شد، واحد NOT VERIFIED |
| Refresh replay و Rollback | برگرداندن نتیجهٔ REPLAY از TX، ابطال خانواده در Commit، خطای 401 بعد از Commit | Source بررسی شد، DB NOT VERIFIED |
| Session Revocation | DB lookup در Guard هر Request محافظت‌شده، TX recheck برای Mutation | Source بررسی شد، runtime NOT VERIFIED |
| آخرین OWNER در Race | org row lock + BEFORE UPDATE/DELETE DB Trigger + Negative PostgreSQL test | Source بررسی شد، DB NOT VERIFIED |
| Tenant Data TOCTOU | Membership Actor در همان SQL Query خواندن سازمان/اعضا لحاظ شد | Source بررسی شد، DB NOT VERIFIED |
| Password Disclosure | Argon2id، Query پارامتری، DTO Projection بدون Hash | Source بررسی شد، لاگ/HTTP NOT VERIFIED |
| CORS/Mass Assignment | Allowlist/headers/methods؛ ValidationPipe whitelist و forbid extra | Source بررسی شد، HTTP NOT VERIFIED |
| Auth brute force | UPSERT اتمیک DB Rate Limit؛ نگرانی NAT/Proxy ثبت شد | Source بررسی شد، DB/Soak NOT VERIFIED |
| Authorization bypass in DB | role محدود، Grants و SECURITY DEFINER محدود | Source بررسی شد، privilege tests NOT VERIFIED |
| Audit/Outbox consistency | درج AuditEvent و OutboxEvent در همان UnitOfWork | Source بررسی شد، PG NOT VERIFIED |
| Migration integrity | 001-004 byte-identical؛ 005 افزایشی؛ Ledger checksum از فاز قبل | SHA256 PASS، SQL execution NOT VERIFIED |
| Commit uncertainty | UoW سیگنال `UNKNOWN_COMMIT_OUTCOME` می‌دهد، با 503 نقشه می‌شود | Source بررسی شد، Fault Injection NOT VERIFIED |

## یافتهٔ باز و مهم

**Refresh unknown outcome:** اگر COMMIT موفق باشد و پاسخ به کلاینت نرسد، تکرار توکن قبلی می‌تواند Replay شناخته شود و نشست را به‌طور عمدی باطل کند. این رفتار از نظر امنیت fail-closed است اما تجربهٔ بازیابی مناسبی ندارد. قبل از نسخهٔ تجاری باید Recovery Token/Protocol و تجربهٔ کاربری آن طراحی و در PostgreSQL تحت قطع اتصال آزموده شود.

**Runtime role bypass:** قیدهای جدول نمی‌توانند به‌تنهایی مدیر مجاز HTTP را از Raw SQL impersonation تشخیص دهند؛ اگر اعتبار دیتابیس Runtime لو برود، برخی تغییرات عضویت هنوز با SQL مستقیم ممکن‌اند. امنیت به لایهٔ سرویس، Queryهای پارامتری، مدیریت Secrets و Defense-in-Depth وابسته است. این موضوع در Security Foundation مستند است.

**مانع اجرایی:** npm registry unavailable و PostgreSQL/Docker absent؛ Typecheck واقعی، SQL compile و تست End-to-End قابل انجام نبوده‌اند. تحلیل سورس یا Syntax PASS جایگزین PASS runtime نیست.
