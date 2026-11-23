# ماتریس یکپارچگی پایگاه‌داده

| Invariant | سند/اجرای دیتابیس | لایه برنامه | آزمون موردنیاز | وضعیت اجرایی |
|---|---|---|---|---|
| Bound ظرفیت 0..capacity | `001_core.sql`/Constraint | Booking transaction | ۱۰۰ رزرو ظرفیت ۱/۲۰ | NOT VERIFIED |
| `seats_committed` = effective bookings | migration triggers و Session lock | Booking/Session | Counter reconciliation زیر Race | NOT VERIFIED |
| یکتایی رزرو مؤثر | Partial Unique Index `unique_effective_booking` | BookingService | دو کلید/یک مشتری و race | NOT VERIFIED |
| Resource exclusivity | `002_resource_guard.sql` / Exclusion | Session allocation | دو مربی/اتاق هم‌زمان | NOT VERIFIED |
| tenant-safe references | Composite FK در migrations | tenant predicates | Cross-tenant FK منفی | NOT VERIFIED |
| Booking transition/event order | `004_history_consistency.sql`, `012` | Booking domain | زنجیره event_order، terminal states | NOT VERIFIED |
| Audit immutability | triggerهای history | Audit/Outbox | UPDATE/DELETE مستقیم غیرمجاز | NOT VERIFIED |
| Last-owner | `005_identity_security.sql` | Membership transaction | آخری REVOKED ممنوع | NOT VERIFIED |
| Invitation/Consent | `010_security_governance.sql` | GovernanceService | قبول تک‌بار و revocation races | NOT VERIFIED |
| Outbox lease/receipt | `009` و `010` | Worker fenced claim | دو Worker، Crash و Retry | NOT VERIFIED |
| Operational identity | `011` | CLI ops | LOGIN binding, SET ROLE negative | NOT VERIFIED |
| Inspection event history | `012` | bounded CLI | Full keyset + event_order | NOT VERIFIED |

تمام Migrationهای ۰۰۱–۰۱۲ در ZIP فاز ۱۶ نسبت به Snapshot فاز ۱۵ byte-for-byte حفظ می‌شوند. فقط Checksum محلی و بررسی سورس PASS شده‌اند؛ SQL واقعی اجرا نشده و Migration جدید ساخته نشده است.
