# ADR-015 — Explicit offsets, IANA validation and stable REST semantics

- **Status:** Accepted for design.
- **Decision:** API only RFC3339 timestamps with explicit offset; Session converts to UTC instants and snapshots IANA Tenant zone. Reject local nonexistent/mismatched offset; ambiguous local time requires valid offset. Business hours weekly local with overnight day offset; buffer stored on Allocation intervals; Gregorian internal, Persian calendar UI. API root /api/v1, machine-readable Problem Details 9457, 404 cross-tenant camouflaging and stable pagination (startAt,id). GET available seats non-reservation snapshot.
- **Rationale:** invariant-safe clock and publicly testable client contract; avoid server timezone and DST ambiguity.
- **Trade-offs:** clients must calculate offset correctly for target day; timezone library must be pinned/tested; changing org timezone does not reinterpret saved Session instants.
- **Verification:** T-14,T-21,T-36,T-42,T-43; Product decisions on override and branch timezone PD-06.

- **Phase 01 correction, same decision status:** Two disjoint GET Session contracts: anonymous `/public/organizations/{orgId}/sessions[/{sessionId}]` using a *strict PublicSession* allowlist (PUBLISHED only), versus bearer staff `/organizations/{orgId}/sessions[/{sessionId}]` using `StaffSession`. Conditional schema unions on a shared optional-auth endpoint are forbidden as an accidental staff-data exposure risk.
- **`/me` consistency:** Response is exactly `MeResponse` with `user` and `memberships: ActiveMembership[]` (ACTIVE only). An empty membership array is valid for a Customer.
- **Temporal specificity:** validate schedule *inputs* with an explicit RFC3339 numeric offset matching organization IANA zone; normalize to UTC instant. API **outputs** of persisted instants (`startAt`, `endAt`, `createdAt`, `cancelledAt`, report range) are canonical UTC `Z`. Event timestamps are NOT subject to schedule-input offset matching. Query `from/to` are offset-aware instants converted to UTC and do not require tenant offset matching.
- **Verification additions:** T-44 public response privacy, T-45 `/me` schema, T-46 timestamps, T-47 readiness auth. Structural/static validation only; future API E2E NOT VERIFIED.
