# ممیزی امنیت فاز ۱۳

| تهدید | وضعیت اصلاح در سورس | آزمون / ریسک باقیمانده |
|---|---|---|
| جعل PGUSER در Restore | تطبیق با `session_user` واقعی قبل از تغییر | Mock مثبت/منفی PASS؛ PG17 واقعی NOT VERIFIED |
| Backup رمز‌شده با کلید خصوصی روی Producer | کلید خصوصی از مسیر Producer حذف شد | تست بدون Identity PASS؛ `age` واقعی NOT VERIFIED |
| Remote DB با SSL غیرفعال | `verify-full` و CA برای Remote اجباری | تست Policy PASS؛ TLS Handshake واقعی NOT VERIFIED |
| Manifest و Archive هم‌زمان دستکاری شوند | دریافت SHA Manifest از Trust Store مستقل برای Verification محیط Production | Mock PASS؛ Provisioning واقعی Trust Root لازم است |
| اجرای Executable جعلی از PATH | مسیر مطلق و Permission محدود در Production | تست Pure PASS؛ Permission Host در محیط واقعی NOT VERIFIED |
| Metrics عمومی / نشت UUID | MonitorGuard + Template Label + سنجش Cardinality | Pure PASS؛ Nest HTTP test تعریف‌شده، NOT VERIFIED |
| حملهٔ Burst/Pool Exhaustion | Admission 503 قبل از تراکنش و Timeout Pool | Source/Unit PASS؛ آزمون بار واقعی NOT VERIFIED |
| نویسندهٔ رقیب در Restore | الزام ایزولاسیون Recovery Host + بررسی Sessionهای لحظه‌ای | Race با Writer در محیط واقعی **باز و مسدودکنندهٔ انتشار** است |

هیچ‌کدام از این اصلاحات به‌تنهایی صلاحیت Production را اثبات نمی‌کنند. حداقل، مقایسۀ نقش‌های واقعی PostgreSQL، اجرای Restore جداشده، RBAC، سطح دسترسی Monitoring و تست Incident باید واقعی اجرا شود.
