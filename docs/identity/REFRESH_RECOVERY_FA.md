# Refresh Token — سیاست بازیابی فاز نهم

**واقعیت رمزنگاری:** Bearer Token بدون اثبات مالکیت دستگاه، در برخورد «Retry مشروع با پاسخ گم‌شده» و «Replay مهاجم» نشانهٔ قطعی تفکیک ندارد.

## پروتکل سورس فعلی
- توکن Refresh با ۳۲ بایت Random ساخته، هش SHA-256 آن ذخیره می‌شود؛ یک‌بارمصرف است.
- تراکنش Rotation با AuthSession lock و سپس Refresh Token lock اجرا می‌شود. اولین مصرف یک Descendant جدید می‌سازد.
- استفادهٔ مجدد از توکن مصرف‌شده برای جلوگیری از سوءاستفاده، Session/Family را ابطال می‌کند. Side Effect ابطال باید Commit شود و قبل از Commit پاسخ Success داده نشود.
- در حالت `UnknownCommitOutcome` سرویس به‌جای توصیهٔ Retry کورکورانه، `503 REFRESH_OUTCOME_UNKNOWN_REAUTH_REQUIRED` می‌دهد؛ کلاینت به ورود مجدد نیاز دارد.
- اگر نتیجهٔ Rotation با قطعیت دریافت شد، کلاینت از توکن جدید استفاده می‌کند. توکن خام نه در Log نه در DB ذخیره نمی‌شود.

## سناریوها
| رخداد | رفتار پیشنهادی/پیاده‌شده | شواهد باقیمانده |
|---|---|---|
| درخواست اول | توکن یک‌بارمصرف، descendant جدید | PG NOT VERIFIED |
| درخواست موازی با همان Token | یکی ممکن است موفق شود، دیگری Replay و Family Revocation | Race test NOT VERIFIED |
| پاسخ پس از Commit گم شده | Client re-auth، بدون Reply مخفیانه با رمز قبلی | Controlled loss test NOT VERIFIED |
| Token دزدیده شده | Replay revokes session | E2E NOT VERIFIED |
| خطای COMMIT نامعلوم | پاسخ `REFRESH_OUTCOME_UNKNOWN_REAUTH_REQUIRED` | Network fault NOT VERIFIED |

**تصمیم امنیتی:** بازهٔ Grace که Token مصرف‌شده را دوباره پذیرا کند، اضافه نشده است. امنیت قوی‌تر به بهای UX ورود مجدد تحت برخی Raceها انتخاب شده است. Sender-constrained token و پروتکل Device-bound، موضوع خارج از Phase09 و نیازمند تصمیم محصول هستند.
