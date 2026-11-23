# Phase 14 — آزمون Worker و At-Least-Once

Worker باید با PostgreSQL مشترک و دو Process مستقل آزموده شود. سناریوها: Claim با `FOR UPDATE SKIP LOCKED`، رقابت Claim، Lease منقضی، Crash قبل/بعد از ثبت Receipt، Process دوباره بدون Side Effect مضاعف، Quarantine و Recovery مجاز، Fencing و رد تأیید Worker پس از از دست دادن Lease.

برای هر رویداد، وضعیت Outbox، Receipt و Projection پایدار را از دیتابیس بخوانید. «درج Receipt داخلی» با «ارسال ایمیل/SMS/Webhook» متفاوت است؛ در پروژه Provider خارجی واقعی وجود ندارد. هیچ آزمایش دو Worker در این نشست اجرا نشده است. مجوز Role `bookcore_worker` نیز باید با Credential مستقل راستی‌آزمایی شود.
