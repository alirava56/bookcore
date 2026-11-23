-- Phase 05: additive, source-level candidate until verified against real PostgreSQL 17.
-- Migrations 001-005 are retained byte-for-byte. bookcore_app is the restricted runtime role.
ALTER TABLE branches ADD COLUMN address text;
ALTER TABLE branches ADD CONSTRAINT branch_name_length CHECK(length(btrim(name)) BETWEEN 2 AND 120) NOT VALID;
ALTER TABLE branches ADD CONSTRAINT branch_address_length CHECK(address IS NULL OR length(btrim(address)) BETWEEN 1 AND 500);
ALTER TABLE services ADD CONSTRAINT service_title_length CHECK(length(btrim(title)) BETWEEN 2 AND 160) NOT VALID;
ALTER TABLE resources ADD CONSTRAINT resource_display_length CHECK(length(btrim(display_name)) BETWEEN 2 AND 160) NOT VALID;
CREATE INDEX branches_tenant_page ON branches(tenant_id,id);
CREATE INDEX services_tenant_page ON services(tenant_id,id);
CREATE INDEX resources_tenant_page ON resources(tenant_id,id);

-- Prevent a second trainer resource even under simultaneous creates (index in migration 001).
-- A revoked/foreign TRAINER membership cannot be linked at INSERT; historical link survives revocation.
CREATE FUNCTION p05_guard_trainer_resource() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.tenant_id,OLD.id,OLD.type,OLD.branch_id,OLD.trainer_user_id)
    IS DISTINCT FROM (NEW.tenant_id,NEW.id,NEW.type,NEW.branch_id,NEW.trainer_user_id) THEN
   RAISE EXCEPTION 'resource identity/scope immutable' USING ERRCODE='23514';
 END IF;
 IF NEW.type='ROOM' AND TG_OP='INSERT' THEN
   PERFORM 1 FROM public.branches b WHERE b.tenant_id=NEW.tenant_id AND b.id=NEW.branch_id AND b.active FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'room branch must be active' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.type='TRAINER' AND TG_OP='INSERT' THEN
   PERFORM 1 FROM public.memberships m JOIN public.users u ON u.id=m.user_id
     WHERE m.tenant_id=NEW.tenant_id AND m.user_id=NEW.trainer_user_id
      AND m.role='TRAINER' AND m.status='ACTIVE' AND u.status='ACTIVE'
      FOR SHARE OF m;
   IF NOT FOUND THEN RAISE EXCEPTION 'trainer membership must be active' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p05_trainer_resource BEFORE INSERT OR UPDATE ON resources
 FOR EACH ROW EXECUTE FUNCTION p05_guard_trainer_resource();

-- Business hours are local recurring weekly wall times. No conversion to UTC at persistence time.
CREATE TABLE business_hours (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 branch_id uuid, resource_id uuid,
 iso_weekday smallint NOT NULL CHECK(iso_weekday BETWEEN 1 AND 7),
 start_local time NOT NULL, end_local time NOT NULL,
 end_day_offset smallint NOT NULL CHECK(end_day_offset IN (0,1)),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,id),
 CHECK((branch_id IS NULL) <> (resource_id IS NULL)),
 CHECK(EXTRACT(SECOND FROM start_local)=0 AND EXTRACT(SECOND FROM end_local)=0),
 CHECK((end_day_offset * 1440 + EXTRACT(EPOCH FROM end_local)/60 - EXTRACT(EPOCH FROM start_local)/60) BETWEEN 1 AND 1440),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,resource_id) REFERENCES resources(tenant_id,id) ON DELETE RESTRICT
);
CREATE INDEX business_hours_tenant_page ON business_hours(tenant_id,id);
CREATE INDEX business_hours_branch ON business_hours(tenant_id,branch_id,iso_weekday) WHERE active AND branch_id IS NOT NULL;
CREATE INDEX business_hours_resource ON business_hours(tenant_id,resource_id,iso_weekday) WHERE active AND resource_id IS NOT NULL;

-- A weekly interval may wrap Sunday -> Monday; detect overlap across both cycle boundaries.
CREATE FUNCTION p05_weekly_overlap(a_day int,a_start time,a_end time,a_offset int,
 b_day int,b_start time,b_end time,b_offset int) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE x1 int; x2 int; y1 int; y2 int;
BEGIN
 x1:=(a_day-1)*1440+(EXTRACT(EPOCH FROM a_start)/60)::int;
 x2:=(a_day-1)*1440+a_offset*1440+(EXTRACT(EPOCH FROM a_end)/60)::int;
 y1:=(b_day-1)*1440+(EXTRACT(EPOCH FROM b_start)/60)::int;
 y2:=(b_day-1)*1440+b_offset*1440+(EXTRACT(EPOCH FROM b_end)/60)::int;
 RETURN (x1<y2 AND y1<x2) OR (x1<y2+10080 AND y1+10080<x2)
     OR (x1<y2-10080 AND y1-10080<x2);
END $$;
CREATE FUNCTION p05_guard_business_hour() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'business hour history cannot be deleted' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (OLD.id,OLD.tenant_id,OLD.branch_id,OLD.resource_id,OLD.iso_weekday,OLD.start_local,
      OLD.end_local,OLD.end_day_offset,OLD.created_at) IS DISTINCT FROM
     (NEW.id,NEW.tenant_id,NEW.branch_id,NEW.resource_id,NEW.iso_weekday,NEW.start_local,
      NEW.end_local,NEW.end_day_offset,NEW.created_at)
     OR NOT OLD.active OR NEW.active THEN
   RAISE EXCEPTION 'business hour only permits active to inactive' USING ERRCODE='23514';
  END IF;
  NEW.updated_at:=clock_timestamp();
 END IF;
 IF NEW.active THEN
  PERFORM 1 FROM public.organizations WHERE id=NEW.tenant_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.business_hours h WHERE h.tenant_id=NEW.tenant_id AND h.active
    AND h.id<>NEW.id AND h.branch_id IS NOT DISTINCT FROM NEW.branch_id
    AND h.resource_id IS NOT DISTINCT FROM NEW.resource_id
    AND public.p05_weekly_overlap(h.iso_weekday,h.start_local,h.end_local,h.end_day_offset,
      NEW.iso_weekday,NEW.start_local,NEW.end_local,NEW.end_day_offset)) THEN
    RAISE EXCEPTION 'overlapping active weekly rules' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p05_hour_guard BEFORE INSERT OR UPDATE OR DELETE ON business_hours
 FOR EACH ROW EXECUTE FUNCTION p05_guard_business_hour();

CREATE TABLE schedule_exceptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 branch_id uuid, resource_id uuid,
 kind text NOT NULL CHECK(kind IN ('CLOSED','OPEN_OVERRIDE')),
 start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 500),
 created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(end_at>start_at AND end_at-start_at <= interval '31 days'),
 CHECK((branch_id IS NULL) <> (resource_id IS NULL)),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,resource_id) REFERENCES resources(tenant_id,id) ON DELETE RESTRICT,
 UNIQUE(tenant_id,id)
);
-- Exclude conflicting active intervals within the same scope, but allow adjacent [start,end).
ALTER TABLE schedule_exceptions ADD CONSTRAINT p05_no_branch_exception_overlap EXCLUDE USING gist
 (tenant_id WITH =,branch_id WITH =,tstzrange(start_at,end_at,'[)') WITH &&)
 WHERE (active AND branch_id IS NOT NULL);
ALTER TABLE schedule_exceptions ADD CONSTRAINT p05_no_resource_exception_overlap EXCLUDE USING gist
 (tenant_id WITH =,resource_id WITH =,tstzrange(start_at,end_at,'[)') WITH &&)
 WHERE (active AND resource_id IS NOT NULL);
CREATE INDEX schedule_exceptions_tenant_page ON schedule_exceptions(tenant_id,id);
CREATE INDEX schedule_exceptions_branch ON schedule_exceptions(tenant_id,branch_id,start_at,end_at) WHERE active;
CREATE INDEX schedule_exceptions_resource ON schedule_exceptions(tenant_id,resource_id,start_at,end_at) WHERE active;
CREATE FUNCTION p05_guard_exception() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'schedule exception history cannot be deleted' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (OLD.id,OLD.tenant_id,OLD.branch_id,OLD.resource_id,OLD.kind,OLD.start_at,OLD.end_at,OLD.reason,
      OLD.created_by,OLD.created_at) IS DISTINCT FROM
     (NEW.id,NEW.tenant_id,NEW.branch_id,NEW.resource_id,NEW.kind,NEW.start_at,NEW.end_at,NEW.reason,
      NEW.created_by,NEW.created_at) OR NOT OLD.active OR NEW.active THEN
   RAISE EXCEPTION 'exception only permits active to inactive' USING ERRCODE='23514'; END IF;
  NEW.updated_at:=clock_timestamp();
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p05_exception_guard BEFORE UPDATE OR DELETE ON schedule_exceptions
 FOR EACH ROW EXECUTE FUNCTION p05_guard_exception();

REVOKE ALL ON branches,services,resources,business_hours,schedule_exceptions FROM PUBLIC;
GRANT SELECT,INSERT ON branches,services,resources,business_hours,schedule_exceptions TO bookcore_app;
GRANT UPDATE(active) ON business_hours,schedule_exceptions TO bookcore_app;
