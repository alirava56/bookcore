# Core invariant enforcement matrix — Source and evidence

| Invariant | PostgreSQL reference | Application reference | Verification |
|---|---|---|---|
| 0≤seats_committed≤capacity_total | `001_core.sql` sessions CHECK | `booking.service.ts`, `session.service.ts` | PG NOT VERIFIED |
| Effective bookings match counter | `002_resource_guard.sql`, `003_hardening.sql`, deferred triggers | `booking.service.ts` | PG NOT VERIFIED; Inspector 012 reports drift only |
| Unique effective Booking/customer/Session | `001_core.sql` index `unique_effective_booking` | `booking.service.ts` | PG NOT VERIFIED |
| Trainer and Room no overlapping allocation | `001_core.sql` GiST `no_exclusive_resource_overlap` | `session.service.ts` | PG NOT VERIFIED |
| Composite tenant reference | `001_core.sql` composite FK | tenantId in SQL predicates | PG NOT VERIFIED |
| Terminal states and event history | `004_history_consistency.sql`, event_order; `012_integrity_inspection_paging.sql` | booking/session domain | ۱۱ Phase11 Pure PASS; PG NOT VERIFIED |
| Idempotency scope and Replay | `001_core.sql` PK and deferred checks | Booking/Session runIdempotent | PG/Unknown COMMIT NOT VERIFIED |
| Consent revoked cannot authorize new Staff Booking | `010_security_governance.sql` + Row Lock | `governance.service.ts`, `booking.service.ts` | PG race NOT VERIFIED |
| Operator authenticated identity | `011_operational_integrity.sql` `session_user` binding, new 012 | `operational-inspection-v2.ts` | Static/Pure PASS; negative PG NOT VERIFIED |
| Outbox durable receipt and Counter | `009_outbox_delivery.sql`, `010_security_governance.sql` | `outbox.worker.ts` | PG multi-worker NOT VERIFIED |
| Inspect full bounded keyset | `012_integrity_inspection_paging.sql` keyset, 6 kinds | `inspection.domain.ts`, paged CLI | Pure PASS; real PG NOT VERIFIED |

An Inspector finding is a diagnostic; it cannot override the database's integrity enforcement. All SQL/DB `PASS` statuses require actual PostgreSQL 17 execution.
