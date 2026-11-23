# Runbook انتشار BookCore — فعلاً NO-GO

۱. رفع مانع Lockfile اصیل و `npm ci` از Registry معتبر؛ ثبت SBOM و نتیجهٔ Audit وابستگی. ۲. `npm run typecheck && npm run lint && npm run build` و Boot واقعی. ۳. اجرای Migrationهای ۰۰۱–۰۱۲ روی PG17 دورریختنی و تکرار Runner؛ سپس تست دادهٔ موجود. ۴. اجرای ۱۸ Workflow اصلی روی HTTP و تطبیق دادهٔ Commitشده. ۵. انجام آزمایش ظرفیت ۱/۲۰ با ۱۰۰ نفر، دو Process، سه تکرار. ۶. تست‌های امنیتی Tenant/JWT/Consent و دو Worker. ۷. Backup و Restore مستقل و، در صورت تعهد DR، تمرین PITR. ۸. تأیید CI، Runtime secrets و مشاهدهٔ Metrics. ۹. Freeze دقیق سورس آزمایش‌شده، تأیید SHA Manifest و approval انسانی پیش از انتشار.

تا اجرای همهٔ شرط‌ها، **Deploy ممنوع**. این Runbook هیچ عملیات Production را اجرا نمی‌کند.
