-- BookCore Phase 02 technical spike, PostgreSQL 17, deliberately limited to core invariants.
-- Run on a fresh isolated database with the migration owner. Not a complete production schema.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(name) BETWEEN 2 AND 160),
 timezone text NOT NULL DEFAULT 'Asia/Tehran', cancellation_cutoff_min int NOT NULL DEFAULT 120 CHECK(cancellation_cutoff_min BETWEEN 0 AND 10080),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUSPENDED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUSPENDED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE memberships (
 tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK(role IN ('OWNER','MANAGER','RECEPTIONIST','TRAINER')),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED')),
 revoked_at timestamptz,
 PRIMARY KEY(tenant_id,user_id),
 CONSTRAINT membership_revoked_consistency CHECK ((status='ACTIVE' AND revoked_at IS NULL) OR (status='REVOKED' AND revoked_at IS NOT NULL))
);
CREATE TABLE branches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(length(name)>=2), active boolean NOT NULL DEFAULT true,
 UNIQUE(tenant_id,id)
);
CREATE TABLE resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 branch_id uuid, type text NOT NULL CHECK(type IN ('TRAINER','ROOM')),
 trainer_user_id uuid, display_name text NOT NULL, active boolean NOT NULL DEFAULT true,
 buffer_before_min int NOT NULL DEFAULT 0 CHECK(buffer_before_min BETWEEN 0 AND 240),
 buffer_after_min int NOT NULL DEFAULT 0 CHECK(buffer_after_min BETWEEN 0 AND 240),
 CHECK ((type='TRAINER' AND branch_id IS NULL AND trainer_user_id IS NOT NULL)
     OR (type='ROOM' AND branch_id IS NOT NULL AND trainer_user_id IS NULL)),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,trainer_user_id) REFERENCES memberships(tenant_id,user_id) ON DELETE RESTRICT,
 UNIQUE(tenant_id,id)
);
CREATE UNIQUE INDEX unique_tenant_trainer_resource ON resources(tenant_id,trainer_user_id) WHERE type='TRAINER';
CREATE TABLE services (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 title text NOT NULL, duration_min int NOT NULL CHECK(duration_min BETWEEN 5 AND 1440), active boolean NOT NULL DEFAULT true,
 UNIQUE(tenant_id,id)
);
CREATE TABLE sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 branch_id uuid NOT NULL, service_id uuid NOT NULL, trainer_resource_id uuid NOT NULL, room_resource_id uuid,
 start_at timestamptz NOT NULL, end_at timestamptz NOT NULL, timezone_snapshot text NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','CANCELLED','FINISHED')),
 capacity_total int NOT NULL CHECK(capacity_total BETWEEN 1 AND 1000),
 seats_committed int NOT NULL DEFAULT 0, version bigint NOT NULL DEFAULT 0,
 created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 cancel_reason text, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(end_at > start_at AND end_at-start_at <= interval '24 hours'),
 CHECK(seats_committed >= 0 AND seats_committed <= capacity_total),
 CHECK(room_resource_id IS NULL OR room_resource_id<>trainer_resource_id),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,service_id) REFERENCES services(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,trainer_resource_id) REFERENCES resources(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,room_resource_id) REFERENCES resources(tenant_id,id) ON DELETE RESTRICT,
 UNIQUE(tenant_id,id)
);
CREATE INDEX sessions_tenant_start ON sessions(tenant_id,start_at,id);
CREATE TABLE resource_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 session_id uuid NOT NULL, resource_id uuid NOT NULL,
 start_at timestamptz NOT NULL, end_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), deactivated_at timestamptz,
 CHECK(end_at>start_at),
 CHECK((active AND deactivated_at IS NULL) OR (NOT active AND deactivated_at IS NOT NULL)),
 FOREIGN KEY(tenant_id,session_id) REFERENCES sessions(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,resource_id) REFERENCES resources(tenant_id,id) ON DELETE RESTRICT,
 UNIQUE(tenant_id,session_id,resource_id), UNIQUE(tenant_id,id),
 CONSTRAINT no_exclusive_resource_overlap EXCLUDE USING gist
   (tenant_id WITH =, resource_id WITH =, tstzrange(start_at,end_at,'[)') WITH &&) WHERE (active)
);
CREATE INDEX allocations_by_session ON resource_allocations(tenant_id,session_id);
CREATE TABLE bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 session_id uuid NOT NULL, customer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_by_actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('CONFIRMED','CANCELLED','ATTENDED','NO_SHOW')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), cancelled_at timestamptz,
 cancel_reason text, updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK ((status='CANCELLED' AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL) OR
        (status<>'CANCELLED' AND cancelled_at IS NULL AND cancel_reason IS NULL)),
 FOREIGN KEY(tenant_id,session_id) REFERENCES sessions(tenant_id,id) ON DELETE RESTRICT,
 UNIQUE(tenant_id,id)
);
CREATE UNIQUE INDEX unique_effective_booking ON bookings(tenant_id,session_id,customer_id)
 WHERE status IN ('CONFIRMED','ATTENDED','NO_SHOW');
CREATE INDEX booking_customer_history ON bookings(tenant_id,customer_id,created_at DESC,id);
CREATE INDEX booking_session_status ON bookings(tenant_id,session_id,status);
CREATE TABLE booking_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 booking_id uuid NOT NULL, from_status text, to_status text NOT NULL,
 actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 reason text, at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(tenant_id,booking_id) REFERENCES bookings(tenant_id,id) ON DELETE RESTRICT,
 CHECK((from_status IS NULL AND to_status='CONFIRMED') OR from_status IS NOT NULL)
);
CREATE INDEX booking_events_by_booking ON booking_events(tenant_id,booking_id,at,id);
CREATE TABLE audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 action text NOT NULL, aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
 reason text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE idempotency_records (
 tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, operation text NOT NULL,
 key uuid NOT NULL, request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK(state IN ('PROCESSING','FINAL')),
 response_status smallint, response_body jsonb, response_headers jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '24 hours'),
 PRIMARY KEY(tenant_id,actor_id,operation,key),
 CHECK(expires_at>created_at),
 CHECK((state='PROCESSING' AND response_status IS NULL AND response_body IS NULL) OR
  (state='FINAL' AND response_status BETWEEN 200 AND 499 AND response_body IS NOT NULL))
);
CREATE INDEX idempotency_expiry ON idempotency_records(expires_at);
CREATE TABLE outbox_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 aggregate_type text NOT NULL, aggregate_id uuid NOT NULL, event_type text NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 available_at timestamptz NOT NULL DEFAULT clock_timestamp(), lease_until timestamptz,
 published_at timestamptz, attempts int NOT NULL DEFAULT 0 CHECK(attempts>=0), last_error_code text
);
CREATE INDEX outbox_ready ON outbox_events(available_at,created_at) WHERE published_at IS NULL;

-- Append-only audit and event records, even if a mistakenly privileged DML role writes to them.
CREATE FUNCTION forbid_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable history table' USING ERRCODE='23514'; END $$;
CREATE TRIGGER booking_history_immutable BEFORE UPDATE OR DELETE ON booking_events
 FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER audit_history_immutable BEFORE UPDATE OR DELETE ON audit_events
 FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();

-- At commit no PROCESSING state may survive; a rolled back claim leaves no row.
CREATE FUNCTION enforce_terminal_idempotency() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM idempotency_records
  WHERE tenant_id=NEW.tenant_id AND actor_id=NEW.actor_id AND operation=NEW.operation
  AND key=NEW.key AND state <> 'FINAL') THEN
  RAISE EXCEPTION 'idempotency must be FINAL at commit' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER idempotency_must_finish AFTER INSERT OR UPDATE ON idempotency_records
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_terminal_idempotency();

-- Cross-table database integrity: checked at COMMIT after all temporary intermediate writes.
-- All normal mutation paths lock sessions first. The trigger also obtains that lock to prevent
-- non-cooperating INSERT on bookings from silently creating a second committed counter value.
CREATE FUNCTION verify_session_integrity(p_tenant uuid, p_session uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s sessions%ROWTYPE; committed_count bigint; allocation_count bigint;
BEGIN
 SELECT * INTO s FROM sessions WHERE tenant_id=p_tenant AND id=p_session FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT count(*) INTO committed_count FROM bookings
 WHERE tenant_id=p_tenant AND session_id=p_session AND status IN ('CONFIRMED','ATTENDED','NO_SHOW');
 IF s.seats_committed <> committed_count THEN
   RAISE EXCEPTION 'session counter drift' USING ERRCODE='23514';
 END IF;
 IF s.status='CANCELLED' THEN
   IF committed_count<>0 OR EXISTS(SELECT 1 FROM resource_allocations
      WHERE tenant_id=p_tenant AND session_id=p_session AND active) THEN
     RAISE EXCEPTION 'cancelled session retains commitment or allocation' USING ERRCODE='23514';
   END IF;
 ELSE
   SELECT count(*) INTO allocation_count FROM resource_allocations a JOIN resources r
     ON r.tenant_id=a.tenant_id AND r.id=a.resource_id
     WHERE a.tenant_id=p_tenant AND a.session_id=p_session AND a.active
     AND a.start_at = s.start_at-(r.buffer_before_min * interval '1 minute')
     AND a.end_at = s.end_at+(r.buffer_after_min * interval '1 minute')
     AND ((r.type='TRAINER' AND r.id=s.trainer_resource_id AND r.branch_id IS NULL)
       OR (r.type='ROOM' AND r.id=s.room_resource_id AND r.branch_id=s.branch_id));
   IF allocation_count <> (1 + CASE WHEN s.room_resource_id IS NULL THEN 0 ELSE 1 END)
     OR EXISTS(SELECT 1 FROM resource_allocations WHERE tenant_id=p_tenant
         AND session_id=p_session AND active AND resource_id NOT IN
         (s.trainer_resource_id,coalesce(s.room_resource_id,s.trainer_resource_id))) THEN
     RAISE EXCEPTION 'session allocation drift' USING ERRCODE='23514';
   END IF;
 END IF;
END $$;
CREATE FUNCTION verify_integrity_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='sessions' THEN PERFORM verify_session_integrity(NEW.tenant_id, NEW.id);
 ELSIF TG_TABLE_NAME='bookings' THEN
   PERFORM verify_session_integrity(NEW.tenant_id, NEW.session_id);
 ELSIF TG_OP='DELETE' THEN
   PERFORM verify_session_integrity(OLD.tenant_id, OLD.session_id);
 ELSE
   PERFORM verify_session_integrity(NEW.tenant_id, NEW.session_id);
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER session_integrity_deferred AFTER INSERT OR UPDATE ON sessions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_integrity_trigger();
CREATE CONSTRAINT TRIGGER booking_integrity_deferred AFTER INSERT OR UPDATE ON bookings
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_integrity_trigger();
CREATE CONSTRAINT TRIGGER allocation_integrity_deferred AFTER INSERT OR UPDATE OR DELETE ON resource_allocations
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_integrity_trigger();

-- Enforce resource kind/branch/trainer active membership at creation time; revocation preserves history.
CREATE FUNCTION validate_new_session_resources() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tr resources%ROWTYPE; rm resources%ROWTYPE;
BEGIN
 SELECT * INTO tr FROM resources WHERE tenant_id=NEW.tenant_id AND id=NEW.trainer_resource_id;
 IF tr.id IS NULL OR tr.type<>'TRAINER' OR NOT tr.active OR
    NOT EXISTS(SELECT 1 FROM memberships WHERE tenant_id=NEW.tenant_id AND user_id=tr.trainer_user_id
        AND status='ACTIVE') THEN
   RAISE EXCEPTION 'invalid trainer resource' USING ERRCODE='23514'; END IF;
 IF NEW.room_resource_id IS NOT NULL THEN
   SELECT * INTO rm FROM resources WHERE tenant_id=NEW.tenant_id AND id=NEW.room_resource_id;
   IF rm.id IS NULL OR rm.type<>'ROOM' OR NOT rm.active OR rm.branch_id<>NEW.branch_id THEN
     RAISE EXCEPTION 'invalid room resource' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER session_resources_guard BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION validate_new_session_resources();
