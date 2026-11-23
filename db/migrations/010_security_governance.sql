-- Phase 09 additive security governance. PostgreSQL 17; runtime constraints UNVERIFIED until applied.
CREATE TABLE staff_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 invitee_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 invited_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK(role IN ('OWNER','MANAGER','RECEPTIONIST','TRAINER')),
 token_hash text NOT NULL UNIQUE CHECK(token_hash~'^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','DECLINED','REVOKED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 acted_at timestamptz,
 CHECK (expires_at>created_at),
 CHECK ((status='PENDING' AND acted_at IS NULL) OR (status<>'PENDING' AND acted_at IS NOT NULL)),
 UNIQUE(tenant_id,id)
);
CREATE UNIQUE INDEX staff_invite_one_pending ON staff_invitations(tenant_id,invitee_id) WHERE status='PENDING';
CREATE INDEX staff_invite_user_lookup ON staff_invitations(invitee_id,created_at DESC);

CREATE TABLE booking_consents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 customer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '90 days'),
 CHECK(revoked_at IS NULL OR revoked_at>=created_at),
 UNIQUE(tenant_id,id)
);
CREATE UNIQUE INDEX booking_consent_one_unrevoked ON booking_consents(tenant_id,customer_id)
 WHERE revoked_at IS NULL;
CREATE INDEX booking_consent_lookup ON booking_consents(tenant_id,customer_id,expires_at)
 WHERE revoked_at IS NULL;

-- Disable direct mutation of security history and immutable ownership/consent fields.
CREATE FUNCTION protect_governance_identity() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'governance history cannot be deleted' USING ERRCODE='23514';
 END IF;
 IF TG_TABLE_NAME='staff_invitations' THEN
  IF (OLD.id,OLD.tenant_id,OLD.invitee_id,OLD.invited_by,OLD.role,OLD.token_hash,OLD.created_at,OLD.expires_at)
     IS DISTINCT FROM
     (NEW.id,NEW.tenant_id,NEW.invitee_id,NEW.invited_by,NEW.role,NEW.token_hash,NEW.created_at,NEW.expires_at)
    OR OLD.status<>'PENDING' OR NEW.status='PENDING' OR NEW.acted_at IS NULL THEN
    RAISE EXCEPTION 'invalid invitation mutation' USING ERRCODE='23514';
  END IF;
 ELSE
  IF (OLD.id,OLD.tenant_id,OLD.customer_id,OLD.created_at,OLD.expires_at)
     IS DISTINCT FROM
     (NEW.id,NEW.tenant_id,NEW.customer_id,NEW.created_at,NEW.expires_at)
     OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION 'invalid consent mutation' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER staff_invitation_immutable BEFORE UPDATE OR DELETE ON staff_invitations
 FOR EACH ROW EXECUTE FUNCTION protect_governance_identity();
CREATE TRIGGER booking_consent_immutable BEFORE UPDATE OR DELETE ON booking_consents
 FOR EACH ROW EXECUTE FUNCTION protect_governance_identity();

REVOKE ALL ON staff_invitations,booking_consents FROM PUBLIC;
GRANT SELECT,INSERT ON staff_invitations,booking_consents TO bookcore_app;
GRANT UPDATE(status,acted_at) ON staff_invitations TO bookcore_app;
GRANT UPDATE(revoked_at) ON booking_consents TO bookcore_app;
GRANT SELECT ON staff_invitations,booking_consents TO bookcore_worker;
-- The worker sees the tenant-scoped aggregate, never the raw invite token.
-- Useful durable internal delivery projection (processed events by tenant/type).
-- Backfill once from historical Phase08 receipts, without reprocessing their effects.
CREATE TABLE outbox_event_counters (
 tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 event_type text NOT NULL,
 processed_count bigint NOT NULL DEFAULT 0 CHECK(processed_count>=0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,event_type)
);
INSERT INTO outbox_event_counters(tenant_id,event_type,processed_count)
 SELECT tenant_id,event_type,count(*)::bigint FROM processed_outbox_events GROUP BY tenant_id,event_type;
REVOKE ALL ON outbox_event_counters FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE(processed_count,updated_at) ON outbox_event_counters TO bookcore_worker;


DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bookcore_ops') THEN
  CREATE ROLE bookcore_ops NOLOGIN;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO bookcore_ops;
GRANT SELECT ON outbox_events,outbox_event_counters TO bookcore_ops;
CREATE FUNCTION bookcore_requeue_outbox(p_tenant uuid,p_event uuid,p_actor uuid,p_reason text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_id uuid;
BEGIN
 IF p_reason IS NULL OR length(btrim(p_reason))<10 OR length(p_reason)>500 THEN
  RAISE EXCEPTION 'requeue reason required' USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m JOIN public.users u ON u.id=m.user_id
  JOIN public.organizations o ON o.id=m.tenant_id
  WHERE m.tenant_id=p_tenant AND m.user_id=p_actor AND m.role='OWNER'
   AND m.status='ACTIVE' AND u.status='ACTIVE' AND o.status='ACTIVE') THEN
  RAISE EXCEPTION 'operational authorization rejected' USING ERRCODE='42501';
 END IF;
 SELECT id INTO v_id FROM public.outbox_events WHERE tenant_id=p_tenant AND id=p_event
  AND published_at IS NULL AND failed_at IS NOT NULL FOR UPDATE;
 IF v_id IS NULL THEN RETURN false; END IF;
 UPDATE public.outbox_events SET failed_at=NULL,last_error_code=NULL,claimed_by=NULL,
  claim_started_at=NULL,lease_until=NULL,available_at=clock_timestamp(),attempts=0
 WHERE id=v_id AND tenant_id=p_tenant;
 INSERT INTO public.audit_events(tenant_id,actor_id,action,aggregate_type,aggregate_id,reason)
 VALUES(p_tenant,p_actor,'OUTBOX_REQUEUED','OUTBOX',v_id,p_reason);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION bookcore_requeue_outbox(uuid,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bookcore_requeue_outbox(uuid,uuid,uuid,text) TO bookcore_ops;
-- Real ops credentials are managed outside the artifact, never by the HTTP app role.
