-- Phase 08: additive, preserves the complete 001-008 history and all existing events.
-- Worker delivery is at least once; the durable local projection is idempotent by event_id.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='bookcore_worker') THEN
  CREATE ROLE bookcore_worker NOLOGIN;
 END IF;
END $$;
ALTER TABLE outbox_events
 ADD COLUMN claimed_by uuid,
 ADD COLUMN claim_started_at timestamptz,
 ADD COLUMN failed_at timestamptz,
 ADD COLUMN schema_version smallint NOT NULL DEFAULT 1 CHECK(schema_version=1);
-- Phase 01 had no claim owner. Clear any stale legacy lease before enabling owner invariants.
UPDATE outbox_events SET lease_until=NULL WHERE lease_until IS NOT NULL;
ALTER TABLE outbox_events
 ADD CONSTRAINT outbox_claim_consistency CHECK (
  (claimed_by IS NULL AND lease_until IS NULL AND claim_started_at IS NULL)
   OR (claimed_by IS NOT NULL AND lease_until IS NOT NULL AND claim_started_at IS NOT NULL)),
 ADD CONSTRAINT outbox_delivery_terminal CHECK (
  (failed_at IS NULL OR published_at IS NULL) AND
  (published_at IS NULL OR claimed_by IS NULL) AND
  (failed_at IS NULL OR claimed_by IS NULL));
CREATE INDEX outbox_claimable_v1 ON outbox_events(available_at,created_at,id)
 WHERE published_at IS NULL AND failed_at IS NULL;
CREATE INDEX outbox_aggregate_order_v1 ON outbox_events(tenant_id,aggregate_type,aggregate_id,created_at,id)
 WHERE published_at IS NULL;
CREATE TABLE processed_outbox_events (
 event_id uuid PRIMARY KEY REFERENCES outbox_events(id) ON DELETE RESTRICT,
 tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 aggregate_type text NOT NULL,
 aggregate_id uuid NOT NULL,
 event_type text NOT NULL,
 schema_version smallint NOT NULL CHECK(schema_version=1),
 handled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,event_id)
);
REVOKE ALL ON processed_outbox_events FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO bookcore_worker;
GRANT SELECT ON outbox_events,organizations,bookings,sessions,resources,branches,services,
 memberships,business_hours,schedule_exceptions TO bookcore_worker;
GRANT UPDATE (claimed_by,claim_started_at,lease_until,available_at,published_at,
 attempts,last_error_code,failed_at) ON outbox_events TO bookcore_worker;
GRANT INSERT,SELECT ON processed_outbox_events TO bookcore_worker;
GRANT SELECT ON processed_outbox_events TO bookcore_app;
-- Neither API nor worker may rewrite/erase processed delivery history.
REVOKE UPDATE,DELETE ON processed_outbox_events FROM bookcore_app,bookcore_worker;

-- Optional known local development login. Production grants use a separately audited login role.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='bookcore_worker_login') THEN
  GRANT bookcore_worker TO bookcore_worker_login;
 END IF;
END $$;
