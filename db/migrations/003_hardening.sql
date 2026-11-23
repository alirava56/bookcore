-- B-06 remediation: hard-stop domain reparenting, immutable histories, and
-- invalidate both old and new affected aggregates at the deferred boundary.
-- PostgreSQL 17; migration owner must not be used by the application.
CREATE FUNCTION guard_booking_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
   RAISE EXCEPTION 'booking history cannot be deleted' USING ERRCODE='23514';
 END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.status<>'CONFIRMED' THEN
     RAISE EXCEPTION 'new booking must be confirmed' USING ERRCODE='23514';
   END IF;
   RETURN NEW;
 END IF;
 IF (OLD.id,OLD.tenant_id,OLD.session_id,OLD.customer_id,OLD.created_by_actor_id,OLD.created_at)
    IS DISTINCT FROM
    (NEW.id,NEW.tenant_id,NEW.session_id,NEW.customer_id,NEW.created_by_actor_id,NEW.created_at) THEN
   RAISE EXCEPTION 'booking identity is immutable' USING ERRCODE='23514';
 END IF;
 IF OLD.status <> NEW.status AND NOT
  (OLD.status='CONFIRMED' AND NEW.status IN ('CANCELLED','ATTENDED','NO_SHOW')) THEN
   RAISE EXCEPTION 'invalid booking transition' USING ERRCODE='23514';
 END IF;
 IF NEW.status IN ('ATTENDED','NO_SHOW') AND OLD.status<>NEW.status AND
    NOT EXISTS (SELECT 1 FROM sessions WHERE tenant_id=OLD.tenant_id
      AND id=OLD.session_id AND status='FINISHED') THEN
   RAISE EXCEPTION 'attendance allowed only on finished session' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_identity_guard BEFORE INSERT OR UPDATE OR DELETE ON bookings
 FOR EACH ROW EXECUTE FUNCTION guard_booking_identity();

CREATE FUNCTION guard_allocation_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
   RAISE EXCEPTION 'allocation history cannot be deleted' USING ERRCODE='23514';
 END IF;
 IF (OLD.id,OLD.tenant_id,OLD.session_id,OLD.resource_id,OLD.created_at)
    IS DISTINCT FROM
    (NEW.id,NEW.tenant_id,NEW.session_id,NEW.resource_id,NEW.created_at) THEN
   RAISE EXCEPTION 'allocation identity is immutable' USING ERRCODE='23514';
 END IF;
 IF NOT OLD.active AND NEW.active THEN
   RAISE EXCEPTION 'historical allocation cannot be reactivated' USING ERRCODE='23514';
 END IF;
 IF OLD.active AND NOT NEW.active AND NOT EXISTS (
  SELECT 1 FROM sessions WHERE id=OLD.session_id AND tenant_id=OLD.tenant_id AND status='CANCELLED'
 ) THEN
   RAISE EXCEPTION 'allocation release requires cancelled session' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER allocation_identity_guard BEFORE UPDATE OR DELETE ON resource_allocations
 FOR EACH ROW EXECUTE FUNCTION guard_allocation_identity();

CREATE FUNCTION guard_session_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (OLD.id,OLD.tenant_id,OLD.created_by,OLD.created_at)
    IS DISTINCT FROM (NEW.id,NEW.tenant_id,NEW.created_by,NEW.created_at) THEN
   RAISE EXCEPTION 'session identity is immutable' USING ERRCODE='23514';
 END IF;
 IF (OLD.branch_id,OLD.service_id,OLD.trainer_resource_id,OLD.room_resource_id,
   OLD.start_at,OLD.end_at,OLD.timezone_snapshot)
    IS DISTINCT FROM
    (NEW.branch_id,NEW.service_id,NEW.trainer_resource_id,NEW.room_resource_id,
     NEW.start_at,NEW.end_at,NEW.timezone_snapshot) THEN
   IF OLD.status <> 'DRAFT' OR NEW.status <> 'DRAFT' OR EXISTS (
    SELECT 1 FROM bookings WHERE tenant_id=OLD.tenant_id AND session_id=OLD.id) THEN
     RAISE EXCEPTION 'published or booked session schedule is immutable' USING ERRCODE='23514';
   END IF;
 END IF;
 IF OLD.status<>NEW.status THEN
   IF NOT ((OLD.status='DRAFT' AND NEW.status IN ('PUBLISHED','CANCELLED')) OR
      (OLD.status='PUBLISHED' AND NEW.status IN ('CANCELLED','FINISHED'))) THEN
     RAISE EXCEPTION 'invalid session transition' USING ERRCODE='23514';
   END IF;
   IF (NEW.status IN ('PUBLISHED','CANCELLED') AND clock_timestamp() >= OLD.start_at)
     OR (NEW.status='FINISHED' AND clock_timestamp() < OLD.end_at) THEN
     RAISE EXCEPTION 'invalid session transition time' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER session_identity_guard BEFORE UPDATE ON sessions
 FOR EACH ROW EXECUTE FUNCTION guard_session_identity();

CREATE OR REPLACE FUNCTION guard_resource_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (OLD.id,OLD.tenant_id) IS DISTINCT FROM (NEW.id,NEW.tenant_id) THEN
   RAISE EXCEPTION 'resource identity is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER resource_identity_guard BEFORE UPDATE ON resources
 FOR EACH ROW EXECUTE FUNCTION guard_resource_identity();

-- A booking transition without an append-only event is not a valid committed state.
CREATE FUNCTION verify_booking_history(p_tenant uuid,p_booking uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE b bookings%ROWTYPE; last_state text; first_count integer;
BEGIN
 SELECT * INTO b FROM bookings WHERE tenant_id=p_tenant AND id=p_booking;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT count(*) INTO first_count FROM booking_events
 WHERE tenant_id=p_tenant AND booking_id=p_booking AND from_status IS NULL AND to_status='CONFIRMED';
 SELECT to_status INTO last_state FROM booking_events
 WHERE tenant_id=p_tenant AND booking_id=p_booking ORDER BY at DESC,id DESC LIMIT 1;
 IF first_count<>1 OR last_state IS DISTINCT FROM b.status THEN
  RAISE EXCEPTION 'booking history disagrees with current state' USING ERRCODE='23514';
 END IF;
END $$;

-- A deferred integrity check of a reparented row must examine both affected
-- sessions, even though identity guards above reject reparenting in supported paths.
CREATE OR REPLACE FUNCTION verify_integrity_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='sessions' THEN
   IF TG_OP='UPDATE' THEN
     IF (OLD.tenant_id,OLD.id) IS DISTINCT FROM (NEW.tenant_id,NEW.id) THEN
       PERFORM verify_session_integrity(OLD.tenant_id, OLD.id);
     END IF;
   END IF;
   PERFORM verify_session_integrity(NEW.tenant_id, NEW.id);
 ELSIF TG_OP='DELETE' THEN
   PERFORM verify_session_integrity(OLD.tenant_id, OLD.session_id);
 ELSE
   IF TG_OP='UPDATE' THEN
     IF (OLD.tenant_id,OLD.session_id) IS DISTINCT FROM (NEW.tenant_id,NEW.session_id) THEN
       PERFORM verify_session_integrity(OLD.tenant_id, OLD.session_id);
     END IF;
   END IF;
   PERFORM verify_session_integrity(NEW.tenant_id, NEW.session_id);
   IF TG_TABLE_NAME='bookings' THEN
     PERFORM verify_booking_history(NEW.tenant_id,NEW.id);
   END IF;
 END IF;
 RETURN NULL;
END $$;

-- Original Phase-02 did not fire the deferred Booking check on DELETE.
DROP TRIGGER booking_integrity_deferred ON bookings;
CREATE CONSTRAINT TRIGGER booking_integrity_deferred
 AFTER INSERT OR UPDATE OR DELETE ON bookings
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_integrity_trigger();

-- Date/room/trainer changes to DRAFT sessions must still pass resource-kind checks.
DROP TRIGGER session_resources_guard ON sessions;
CREATE TRIGGER session_resources_guard BEFORE INSERT OR UPDATE OF
 branch_id,trainer_resource_id,room_resource_id ON sessions
 FOR EACH ROW EXECUTE FUNCTION validate_new_session_resources();

-- Restrict direct mutation of event log data. This role demonstration is
-- intentionally handled in infra/SQL and negative tests, not as a deployment RBAC model.

-- Serialize resource metadata edits with allocation creation, including an
-- as-yet-unallocated resource; the FK's KEY SHARE alone is not sufficient
-- because an UPDATE of non-key buffer columns normally takes NO KEY UPDATE.
CREATE FUNCTION lock_resource_for_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.active THEN
   PERFORM 1 FROM resources WHERE tenant_id=NEW.tenant_id AND id=NEW.resource_id FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'allocation resource not found' USING ERRCODE='23503'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER allocation_resource_lock_guard BEFORE INSERT OR UPDATE OF
 resource_id,active,start_at,end_at ON resource_allocations
 FOR EACH ROW EXECUTE FUNCTION lock_resource_for_allocation();
