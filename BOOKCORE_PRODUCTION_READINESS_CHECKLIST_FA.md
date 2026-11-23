# چک‌لیست Production Readiness — BookCore

موارد خالی `NOT VERIFIED` یا `BLOCKED` هستند، نه موفقیت مستتر.

- [ ] Lockfile اصیل و npm ci موفق از مخزن معتبر
- [ ] Typecheck strict، ESLint، Build و NestJS bootstrap
- [ ] اجرای Migrationهای ۰۰۱–۰۱۲ روی PostgreSQL17 و ارتقای دیتابیس پرشده
- [ ] نقش‌های جدا و آزمون SECURITY DEFINER / Last-owner / Tenant FK
- [ ] تمام ۴۶ عملیات دامنه در HTTP واقعی مطابق DTO، Problem Details و auth
- [ ] تست‌های منفی JWT، Consent، Invitation، Cross-tenant و Metrics
- [ ] رزرو ظرفیت ۱ و ۲۰ × ۱۰۰ مشتری × دو Process × سه تکرار، بدون ۵xx
- [ ] Cross-operation races و Unknown COMMIT recovery
- [ ] Outbox دو Worker، Lease fencing و crash/retry
- [ ] مانیتورینگ، readiness، backlog و alertها در محیط واقعی
- [ ] Backup واقعی، provenance معتبر مستقل، Restore کامل و حفظ ACL
- [ ] تمرین PITR با base backup + WAL replay
- [ ] Credential provisioning، Rotation و دسترسی عملیاتی تأییدشده
- [ ] طرح Rollback و Incident Response آزمایش و تصویب‌شده
- [ ] Retention، RPO و RTO تأییدشدهٔ کسب‌وکار
- [ ] اسکن تأمین زنجیره، CVE و secret scanning با ابزار معتبر
- [ ] اجرای واقعی همه Jobهای CI، نگهداری لاگ و تأیید نسخهٔ دقیق
- [ ] Release artifact امضاشده/قابل ردگیری و تصویب مستقل GO

**نتیجهٔ امروز:** NO-GO.
