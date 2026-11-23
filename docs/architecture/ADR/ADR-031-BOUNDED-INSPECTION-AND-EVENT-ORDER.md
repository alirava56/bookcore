# ADR-031 — Keyset inspection and logical event order (Phase 11)

**Decision:** Preserve migrations 001–011; add 012 with one bounded, tenant-scoped SECURITY DEFINER reader per paged Kind. BookingEvent chain is interpreted strictly by immutable `event_order`, never by timestamp/UUID ordering. Legacy backfilled event provenance must be classified instead of automatically reconstructed.

**Alternatives rejected:** OFFSET deep scans (non-resumable, expensive), long-lived REPEATABLE READ transaction across all pages (connection/snapshot resource risk), unbounded full-table read in a privileged CLI, auto-repair of business history, and trusting a client-controlled Cursor or GUC for identity.

**Implementation:** server role requires bound `session_user` and active OWNER; source CLI signs a JSON continuation with HMAC-SHA256, 256-bit key, tenant/kind/asOf/after; PostgreSQL validates role on each page; keyset uses UUID IDs. `asOf` is an insertion watermark, NOT a consistent cross-page MVCC snapshot. New inserts backdated by privileged principals and concurrent updates may affect observations. `coverageComplete` means enumerated eligible IDs, not an integrity certificate. Read-only SQL only.

**Compatibility:** existing `bookcore_inspect_tenant()` remains a truthful sample-only wrapper. The 011 SQL remains unchanged. Separate dedicated credentials for inspection and migration are mandatory. Production validation is deferred until PostgreSQL 17 migration/permissions/concurrency tests pass.
