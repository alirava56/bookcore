# ADR-011 — Session-lock atomic booking/cancellation

- **Status:** Accepted for design, operational proof pending.
- **Context:** INV-01/02/03/06 and T-01/02/06/07/10/25 demand no overbooking and no double release; blueprint omitted bulk Session cancellation policy.
- **Decision:** PostgreSQL READ COMMITTED; lock Session row `FOR UPDATE`; read DB clock; immutable valid transition; change Booking, Counter, BookingEvent and Outbox in one TX. PUBLISHED Session before start can cancel all CONFIRMED with per-booking history and counter zero in one TX. ATTENDED/NO_SHOW only after Session FINISHED and maintain Counter. Time/trainer changes on Published forbidden.
- **Alternatives rejected:** Redis counters (not authoritative), independent COUNT without lock (race), distributed saga for Session cancel (partial results), auto-transfer bookings (out of MVP).
- **Trade-offs:** hotspot lock contention and potentially large atomic cancel; measure with max pilot class size. Additional write privileges/trigger-based reconciliation required to avoid out-of-protocol writes.
- **Assumptions:** each Booking=one seat; no Hold/Payment; Session must start in future; pilot class size bounded.
- **Verification:** T-01,T-02,T-06,T-07,T-10,T-25,T-26,T-27,T-38; no runtime results in Phase 01.
