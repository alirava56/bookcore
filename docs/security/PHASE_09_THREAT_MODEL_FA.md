# تهدیدسنجی Phase09 — بازبینی خصمانهٔ سورس

| تهدید | پیش‌شرط مهاجم | محل | کنترل انجام‌شده | شواهد واقعی / خطر باقیمانده |
|---|---|---|---|---|
| Forced affiliation | Staff مجاز با UUID قربانی | `organizations.service.ts`, `governance.service.ts` | Endpoint مستقیم 409 و Invite/Accept | Source reviewed؛ Race/SQL NOT VERIFIED |
| Invite theft | افشای Raw invite token | `governance.service.ts` | ۲۵۶ بیت entropy، هش SHA-256 ذخیره، expiry 72h، single-use | Token delivery channel هنوز تعریف نشده |
| Cross-tenant consent replay | staff Tenant A، consent Tenant B | `booking.service.ts` | `tenant_id`+`customer_id` و قفل/شروط SQL | PG integration NOT VERIFIED |
| Consent forgery | staff با customer UUID | `governance.controller/service.ts` | CustomerId از JWT، staff حق grant ندارد | HTTP integration NOT VERIFIED |
| Stale membership | Revocation هم‌زمان با Booking | `authorization.service.ts`, `booking.service.ts` | Fresh Role در Transaction و Org lock | real concurrency NOT VERIFIED |
| Refresh replay | Token دزدیده یا duplicate legitimate | `identity.service.ts` | Hash, one-use, family revoke | lost response باعث reauth، حمله واقعی تأیید نشده |
| Public route accidentally unguarded | خطای developer | global APP_GUARD | Default Deny، public metadata محدود | full Nest bootstrap NOT VERIFIED |
| Outbox malicious payload | توانایی Inject صف | `outbox.domain.ts` | Schema per event/aggregate/version، whitelist، secret-key reject | Unit tests PASS، تاریخی DB corpus NOT VERIFIED |
| Lease hijack/double processing | Worker slow + replica | `outbox.worker.ts` | claim 1/fencing current lease/receipt unique | multi-process PG NOT VERIFIED |
| Ops elevation | سرقت ops credential | `010_security_governance.sql`, CLI | Separate role, `SECURITY DEFINER`, owner+reason check | PG grants NOT VERIFIED؛ compromise همچنان ریسک |
| Data exfiltration via logs | خطای handler | logging, worker | sanitized codes، عدم نمایش raw token | full logging review/runtime NOT VERIFIED |
| SQL injection | ورودی attacker | governance + CLI | Parameterized queries، no dynamic table name from input | E2E fuzz NOT VERIFIED |
| Abuse behind NAT | clients shared IP / spoofed headers | DB rate guard / edge | actor-keyed authenticated rate, ingress requirement | production edge config NOT VERIFIED |

**تأیید فنی:** PASS واحد صرفاً به آزمون Pure اجراشده اطلاق می‌شود. هیچ مورد «Exploit confirmed» بدون بازتولید نباید ثبت شود. امتیاز و قابلیت بهره‌برداری در محیط واقعی قابل تعیین نیست. دسترسی به دادهٔ Customer و الزامات قانونی Consent نیازمند تأیید Product/Privacy است.
