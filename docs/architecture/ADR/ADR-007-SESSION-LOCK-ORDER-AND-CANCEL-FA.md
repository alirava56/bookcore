# ADR-007 — Session locking, persisted UTC checks and atomic cancel

**Status: provisional implementation decision; PostgreSQL runtime verification pending.**

- Admin write acquisition order: organization row lock (same as Catalog/Membership), authenticated session+actor membership, sorted Resources, Session row for lifecycle, then Bookings/Allocations and history. Eliminates scheduling-rule-write race with Session creation **when all participants follow it**. Legacy Phase02 booking order starts with Session and must be reconciled before shared deployment.
- Use Session-row FOR UPDATE for all lifecycle and capacity changes; rely on PostgreSQL GiST exclusion/constraints for conflicts. An app-level availability result does not reserve a Resource.
- Store UTC Instants; publishing validates stored UTC without erroneously applying local offset-input rules. The original Create still validates supplied zone offset.
- Use same-key transaction-bound Idempotency for Cancel/Capacity; avoid caching SQL failures or unknown COMMIT results. Domain rejections are cached only after authorization.
- Public projection independent from StaffSession projection to prevent accidental data widening.

**Alternatives rejected:** application-only mutex/Redis locks; naive timestamp math; public projection derived via spreading internal entity; deleting Booking history on session cancel.

**Risks:** runtime Trigger behavior, deferred trigger deadlocks, legacy lock-order mismatch, HTTP role revocation racing with session writes, ambiguous COMMIT recovery UX. Acceptance: clean PG17 tests, two processes, 100 attempts, full 15-Booking cancellation and safety audit.
