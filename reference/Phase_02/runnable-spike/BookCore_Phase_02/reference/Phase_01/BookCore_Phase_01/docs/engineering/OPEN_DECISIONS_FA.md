# BookCore — تصمیم‌های باز محصول و تحقیق فنی

مقادیر زیر **پیشنهاد موقت مهندسی**‌اند، نه سیاست تاییدشده توسط باشگاه یا واقعیت بازار. تا پیش از Pilot باید صاحب تصمیم، شواهد و تاریخ تأیید ثبت شود. تغییر هر تصمیم مستلزم تست قرارداد و به‌روزرسانی PRD/API است.

| ID | نیازمند تأیید | Default فقط برای طراحی/Spike | تصمیم‌گیر و سند شواهد | زمان الزام |
|---|---|---|---|---|
| PD-01 | ثبت‌نام اجباری یا مهمان؟ (R-01) | حساب User فعال، Email+password؛ بدون guest | Product + نمونه فرایند پذیرش، مصاحبه | پیش از MVP pilot |
| PD-02 | چند شعبه و منابع واقعی؟ (R-02,R-03) | چند Branch در یک Org، یک Trainer و 0/1 Room انحصاری در Session؛ trainer across branches | 2–3 مدیر باشگاه + برنامه واقعی کلاس | پیش از acceptance دامنه |
| PD-03 | مهلت و استثنای لغو (R-04) | `120min` مشتری؛ Staff با reason تا قبل از شروع؛ بعد از شروع ممنوع | مالک باشگاه + نمونه قرارداد | پیش از pilot |
| PD-04 | رضایت و احراز هویت رزرو توسط پذیرش (R-05) | Staff با `customerId` user existing و Audit؛ بدون lookup PII | حقوقی/پذیرش + مشاهده workflow | پیش از رزرو حضوری |
| PD-05 | Draft آیا منابع را نگه دارد و مدت آن چقدر باشد؟ (A-14) | Draft resource blocking تا لغو دستی؛ بدون expiry خودکار | مدیر باشگاه/عملیات | پیش از scheduling UX |
| PD-06 | ساعت کاری/استثنا و Override چگونه باشد؟ (FR-05,R-07) | branch+resource weekly; CLOSED و OPEN_OVERRIDE دلیل‌دار؛ قبلی‌ها بی‌تغییر | مدیر عملیاتی + تقویم واقعی | پیش از pilot |
| PD-07 | حفظ داده، انصراف و ناشناس‌سازی، ارسال پیام (R-08,R-11) | هیچ hard delete رزرو، PII minimal، اعلان واقعی خارج MVP | حقوقی/Privacy/Business | پیش از داده واقعی |
| PD-08 | MFA، Token lifetime، recovery، استقرار عمومی (NFR-05) | Owner/Manager MFA production prerequisite؛ access 15min provisional | Security/Ops/Product | پیش از production |
| PD-09 | KPI، SLA و حجم واقعی (NFR-02/03/04, R-09) | p95<300ms فقط تست پیشنهادی، SLO 99.9%، RPO15m RTO60m | Product/Ops + load & restore evidence | پس از benchmarking |

## Engineering spikes — NOT YET VERIFIED
| ID | آزمایش دقیق | Success شرط تصمیم | Owner |
|---|---|---|---|
| TS-01 | PostgreSQL واقعی، 2 API replica، 100 requests برای ظرفیت 1 و 20 | دقیقاً 1/20 مؤثر، counter برابر COUNT، عدم overbook با timeout | Backend/DB |
| TS-02 | `btree_gist`, GiST exclusion `[start,end)`, buffers, late-night, cancelled allocation | overlap 23P01؛ adjacency accepted at buffer0؛ branch-cross conflict for same resource | DB |
| TS-03 | Compare Prisma v7 vs Drizzle transaction raw SQL + SQL migrations, schema drift | migration reproducible، همان connection/locks، error mapping، reasonable DX | Tech Lead |
| TS-04 | race concurrent Membership revoke, Refresh replay, CancelAll | هیچ write پس از revoke commit، family revoke، atomic 15 cancel | Security/QA |
| TS-05 | Idempotency lost response & unknown COMMIT + domain rejection commit | exactly one side effect، correct 201 replay و 409 terminal، no cached 5xx | Backend/QA |
| TS-06 | Deferred trigger or restricted DB write & invariant reconciler | enforce or detect Counter/Allocation drift on deliberate out-of-band SQL | DB/QA |
| TS-07 | migration + restore drill + time zones | no data loss، actual RPO/RTO measured، ambiguous DST rejected/disambiguated | Ops/QA |

## Implementation risk register
| Risk | Severity | Mitigation |
|---|---|---|
| Counter vs bookings drift if DB role bypasses service | HIGH | code-only write port, restricted grants, trigger spike, reconciliation monitor |
| System claims global trainer conflicts across organizations | HIGH | explicitly Tenant-local guarantee; cross-org coordination OUT OF SCOPE |
| Long 15+ Booking cancellation TX and lock contention | MEDIUM | small batches? **not** for domain transition: one atomic TX required; measure on pilot max class size |
| In-flight revocation lock order and refresh deadlock | HIGH | global lock hierarchy; 2-instance race test |
| Session timezone/IANA updated after creation | MEDIUM | `timezone_snapshot`, preserve instant, forbid retroactive reinterpretation |
| Unbounded Draft allocations block resources | MEDIUM | staff tooling to view/cancel, pilot product decision PD-05 |
| Snapshot/outbox duplicates after PITR restore | MEDIUM | event id dedup + retained durable sink; don't assert exactly-once |
| ORM schema drift around SQL-native features | HIGH | migration first, drift check DB catalog, SQL test, TS-03 |

**Status:** Product assumptions open; Technical Spikes unexecuted. A design review can still grant `DESIGN-READY FOR TECHNICAL SPIKE`; never infer release readiness from that verdict.

## Contract correction acceptance (no fabricated stakeholder approval)
Public view now has an explicitly defined technical allowlist `id,serviceTitle,branchName,startAt,endAt,timezone,status,seatsAvailable`. Whether a gym approves a service title/branch label for publication remains within **PD-07 privacy/publication review**; no publication consent or interviews were obtained. The new `monitorAuth` describes required future readiness protection; no monitor credential, infrastructure, or operational approval exists. API compatibility for already deployed consumers is **not** a concern in this design-only phase because no deployment exists; real clients must use the new `/public/...` paths, not the staff endpoint. Technical Spike checks TS-01..07 remain **NOT VERIFIED**. Runtime authorization/field-level enforcement needs T-44..T-47 after implementation.
