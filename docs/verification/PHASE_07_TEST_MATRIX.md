# ماتریس تست Phase07

| ID | دسته | سناریو / Assert | پیاده‌سازی تست | شواهد |
|---|---|---|---|---|
| U07-01 | Pure | Effective/Terminal/Transition | `booking-domain.test.ts` | Executed pure harness |
| U07-02 | Pure | Full/cutoff/clock/negative | همان | Executed pure harness |
| U07-03 | Pure | Deadline staff/customer | همان | Executed pure harness |
| U07-04 | Pure | Cursor حد و ترتیب | همان | Executed pure harness |
| U07-05 | Pure | Canonical payload Idempotency | همان | Executed pure harness |
| U07-06 | DTO | Nullable Room UUID و customerId | `phase07-dto.test.ts` | NOT VERIFIED |
| I07-01 | PostgreSQL/two processes | 100 کاربر ظرفیت ۱ ×۳ + ۱۰۰ کاربر ظرفیت ۲۰ ×۳؛ Counts/Event/Outbox | `booking-postgres.test.ts` | NOT VERIFIED |
| I07-02 | PostgreSQL | Replay، Duplicate customer، Self/history، Double cancel | همان | NOT VERIFIED |
| I07-03 | PostgreSQL | ۱۵ رزرو و لغو کامل Session | همان | NOT VERIFIED |
| I07-04 | PostgreSQL | Payload mismatch، Staff cancel، Drift و AuthSession revoked | همان | NOT VERIFIED |
| I07-05 | PostgreSQL | Capacity reduction × Booking | همان | NOT VERIFIED |
| I07-06 | PostgreSQL | Attendance پس از FINISHED با مربی اختصاصی | TBD: تست تکمیلی لازم | NOT VERIFIED |
| I07-07 | PostgreSQL | Real unknown-COMMIT network failure and same-key recovery | TBD: fault-injection harness | NOT VERIFIED |
| I07-08 | PostgreSQL | Membership revoked during staff cancellation, real interleaving | TBD | NOT VERIFIED |
| I07-09 | PostgreSQL | Cross-tenant forged Booking FK and history UPDATE/DELETE | Phase02 negative suite + Phase07 expansion TBD | NOT VERIFIED |
| HTTP07 | HTTP | 401, 403, 404, 409, 422, 429, default-deny, projection | Existing HTTP suites + Phase07 integration subset | NOT VERIFIED |

موفقیت Source Presence یا Parse Syntax به‌معنی انجام تست نیست. تمام تست‌های PostgreSQL به PostgreSQL 17، npm install و Migrationهای 001–008 نیاز دارند. دستورات محلی در README ثبت می‌شوند.
