-- Phase 07: additive permission correction; older migration files are immutable.
-- The runtime role is intentionally not a database owner; immutable history remains append-only.
GRANT SELECT,INSERT ON bookings TO bookcore_app;
GRANT SELECT,INSERT ON booking_events TO bookcore_app;
GRANT SELECT,INSERT ON outbox_events,audit_events TO bookcore_app;
GRANT SELECT,INSERT,UPDATE(state,response_status,response_body,response_headers) ON idempotency_records TO bookcore_app;
GRANT UPDATE(seats_committed,version,updated_at) ON sessions TO bookcore_app;
GRANT UPDATE(status,cancelled_at,cancel_reason,updated_at) ON bookings TO bookcore_app;
-- Identity-generated event_order uses an identity sequence. INSERT grants do not
-- automatically grant sequence usage to a restricted database role.
GRANT USAGE ON SEQUENCE booking_events_event_order_seq TO bookcore_app;
-- Explicitly deny history rewrites and direct persisted booking ownership mutation.
REVOKE UPDATE,DELETE ON booking_events,audit_events FROM bookcore_app;
REVOKE DELETE ON bookings FROM bookcore_app;
