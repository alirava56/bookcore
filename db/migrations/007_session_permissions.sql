-- Phase 06: additional permissions only; migrations 001-006 must remain byte-for-byte intact.
-- The API runtime role is NOT the migration owner. Existing integrity triggers remain active.
GRANT SELECT,INSERT ON sessions,resource_allocations TO bookcore_app;
GRANT UPDATE(status,capacity_total,seats_committed,version,updated_at,cancel_reason) ON sessions TO bookcore_app;
GRANT UPDATE(active,deactivated_at) ON resource_allocations TO bookcore_app;
GRANT SELECT,UPDATE(status,cancelled_at,cancel_reason,updated_at) ON bookings TO bookcore_app;
GRANT SELECT,INSERT ON booking_events TO bookcore_app;
GRANT SELECT,INSERT,UPDATE(state,response_status,response_body,response_headers) ON idempotency_records TO bookcore_app;
-- The deferred integrity trigger validates completed booking histories and allocation state.
-- Do not grant DELETE on immutable history or UPDATE on session ownership/timing/resource identities.
