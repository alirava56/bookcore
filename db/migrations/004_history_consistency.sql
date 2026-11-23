-- BookCore Phase 02: additional domain-history integrity guards.
-- WARNING: SQL candidate. Requires real PostgreSQL 17 migration and regression execution.
-- This migration is intentionally additive; 001/002/003 retain their original hashes.

-- Logical ordering is independent of wall-clock timestamps and UUID sort order.
-- On a non-empty upgrade the migration owner must check historic event provenance;
-- existing row backfill order is not by itself proof of correct historic chronology.
ALTER TABLE booking_events ADD COLUMN event_order bigint GENERATED ALWAYS AS IDENTITY;
CREATE UNIQUE INDEX booking_event_logical_order ON booking_events(event_order);
CREATE INDEX booking_event_chain ON booking_events(tenant_id,booking_id,event_order);

-- Database assigns event time, rather than accepting a client-selected historical time.
-- Physical event chronology is *observed* by at, logical order by event_order.
CREATE FUNCTION enforce_booking_event_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT (
   (NEW.from_status IS NULL AND NEW.to_status='CONFIRMED' AND NEW.reason IS NULL)
   OR (NEW.from_status='CONFIRMED' AND NEW.to_status IN ('CANCELLED','ATTENDED','NO_SHOW')
     AND (NEW.to_status<>'CANCELLED' OR length(btrim(coalesce(NEW.reason,'')))>0))
 ) THEN
   RAISE EXCEPTION 'invalid booking event transition' USING ERRCODE='23514';
 END IF;
 NEW.at := clock_timestamp();
 RETURN NEW;
END $$;
CREATE TRIGGER booking_event_insert_guard BEFORE INSERT ON booking_events
 FOR EACH ROW EXECUTE FUNCTION enforce_booking_event_insert();

-- Validate the ENTIRE append-only event chain, rather than only the last event.
-- All supported booking paths lock Session before Booking. This routine is called
-- after the Session lock has been acquired at the deferred constraint boundary.
CREATE OR REPLACE FUNCTION verify_booking_history(p_tenant uuid,p_booking uuid)
 RETURNS void LANGUAGE plpgsql AS $$
DECLARE
 b bookings%ROWTYPE;
 e record;
 n integer := 0;
 terminal text := NULL;
BEGIN
 SELECT * INTO b FROM bookings WHERE tenant_id=p_tenant AND id=p_booking FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 FOR e IN SELECT from_status,to_status,reason,at,event_order
          FROM booking_events WHERE tenant_id=p_tenant AND booking_id=p_booking
          ORDER BY event_order
 LOOP
  n := n+1;
  IF n=1 THEN
    IF e.from_status IS NOT NULL OR e.to_status<>'CONFIRMED' OR e.reason IS NOT NULL THEN
      RAISE EXCEPTION 'invalid initial booking event' USING ERRCODE='23514';
    END IF;
  ELSIF n=2 THEN
    IF e.from_status IS DISTINCT FROM 'CONFIRMED' OR
      e.to_status NOT IN ('CANCELLED','ATTENDED','NO_SHOW') THEN
      RAISE EXCEPTION 'invalid terminal booking event' USING ERRCODE='23514';
    END IF;
    IF e.to_status='CANCELLED' AND e.reason IS DISTINCT FROM b.cancel_reason THEN
      RAISE EXCEPTION 'cancellation event reason differs from booking' USING ERRCODE='23514';
    END IF;
    IF e.to_status<>'CANCELLED' AND e.reason IS NOT NULL THEN
      RAISE EXCEPTION 'unexpected reason in attendance event' USING ERRCODE='23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'unexpected extra booking event' USING ERRCODE='23514';
  END IF;
  terminal := e.to_status;
 END LOOP;
 IF terminal IS DISTINCT FROM b.status OR
    (b.status='CONFIRMED' AND n<>1) OR
    (b.status<>'CONFIRMED' AND n<>2) THEN
   RAISE EXCEPTION 'booking history does not match committed state' USING ERRCODE='23514';
 END IF;
END $$;

-- An Event INSERT must itself cause a deferred check, even if Booking has no UPDATE.
-- Lock Session BEFORE checking Booking to follow the same global lock order.
CREATE FUNCTION verify_inserted_booking_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
 SELECT session_id INTO sid FROM bookings
   WHERE tenant_id=NEW.tenant_id AND id=NEW.booking_id;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'orphan booking event' USING ERRCODE='23503';
 END IF;
 PERFORM verify_session_integrity(NEW.tenant_id,sid);
 PERFORM verify_booking_history(NEW.tenant_id,NEW.booking_id);
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER booking_event_integrity_deferred
 AFTER INSERT ON booking_events DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION verify_inserted_booking_event();

-- Prevent retrospective edits after a Booking entered a terminal state.
-- This also protects cancelled_at, cancel_reason, and updated_at for final states.
CREATE OR REPLACE FUNCTION guard_booking_identity() RETURNS trigger LANGUAGE plpgsql AS $$
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
 IF OLD.status IN ('CANCELLED','ATTENDED','NO_SHOW') AND OLD IS DISTINCT FROM NEW THEN
   RAISE EXCEPTION 'terminal booking is immutable' USING ERRCODE='23514';
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

-- Session cancellation metadata is mandatory and becomes immutable thereafter.
ALTER TABLE sessions ADD CONSTRAINT session_cancel_reason_consistency CHECK (
 (status='CANCELLED' AND length(btrim(coalesce(cancel_reason,'')))>0)
 OR (status<>'CANCELLED' AND cancel_reason IS NULL)
);
ALTER TABLE bookings ADD CONSTRAINT booking_cancel_reason_nonblank CHECK (
 status<>'CANCELLED' OR length(btrim(cancel_reason))>0
);
CREATE OR REPLACE FUNCTION guard_session_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (OLD.id,OLD.tenant_id,OLD.created_by,OLD.created_at)
    IS DISTINCT FROM (NEW.id,NEW.tenant_id,NEW.created_by,NEW.created_at) THEN
   RAISE EXCEPTION 'session identity is immutable' USING ERRCODE='23514';
 END IF;
 IF OLD.status IN ('CANCELLED','FINISHED') AND OLD IS DISTINCT FROM NEW THEN
   RAISE EXCEPTION 'terminal session is immutable' USING ERRCODE='23514';
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

-- Historical ResourceAllocation intervals cannot be rewritten after release.
CREATE OR REPLACE FUNCTION guard_allocation_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
   RAISE EXCEPTION 'allocation history cannot be deleted' USING ERRCODE='23514';
 END IF;
 IF (OLD.id,OLD.tenant_id,OLD.session_id,OLD.resource_id,OLD.created_at)
    IS DISTINCT FROM
    (NEW.id,NEW.tenant_id,NEW.session_id,NEW.resource_id,NEW.created_at) THEN
   RAISE EXCEPTION 'allocation identity is immutable' USING ERRCODE='23514';
 END IF;
 IF NOT OLD.active AND OLD IS DISTINCT FROM NEW THEN
   RAISE EXCEPTION 'historical allocation cannot be modified' USING ERRCODE='23514';
 END IF;
 IF OLD.active AND NOT NEW.active AND NOT EXISTS (
  SELECT 1 FROM sessions WHERE id=OLD.session_id AND tenant_id=OLD.tenant_id AND status='CANCELLED'
 ) THEN
   RAISE EXCEPTION 'allocation release requires cancelled session' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

-- The migration fails if legacy rows violate the new complete-chain policy.
-- No historical events are silently repaired or removed.
DO $$
DECLARE r record;
BEGIN
 FOR r IN SELECT tenant_id,id FROM bookings LOOP
   PERFORM verify_booking_history(r.tenant_id,r.id);
 END LOOP;
END $$;
