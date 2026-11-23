-- Phase 10 additive operational integrity; PostgreSQL 17. Does NOT grant app/worker blanket repair privileges.
-- Operator identity must be provisioned OUT-OF-BAND: login role != group role and explicit login->user binding.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bookcore_inspector') THEN CREATE ROLE bookcore_inspector NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bookcore_maintenance') THEN CREATE ROLE bookcore_maintenance NOLOGIN; END IF;
END $$;
CREATE TABLE public.bookcore_operator_identities (
 login_role name PRIMARY KEY,
 actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 enabled boolean NOT NULL DEFAULT false,
 registered_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON public.bookcore_operator_identities FROM PUBLIC,bookcore_app,bookcore_worker,bookcore_ops;
-- Phase09 granted broad direct inspection; require the tenant-scoped SECURITY DEFINER API instead.
REVOKE SELECT ON public.outbox_events,public.outbox_event_counters FROM bookcore_ops;
GRANT USAGE ON SCHEMA public TO bookcore_inspector,bookcore_maintenance;

-- Old Phase09 signature trusts a caller-supplied actor UUID. Keep it in the catalog for migration
-- history but revoke the operational role's execute privilege; do not permit bypass via public.
REVOKE ALL ON FUNCTION public.bookcore_requeue_outbox(uuid,uuid,uuid,text) FROM PUBLIC,bookcore_ops,bookcore_app,bookcore_worker;

-- PostgreSQL session_user is the original authenticated LOGIN role, not spoofable by SET ROLE or SET LOCAL.
-- A custom GUC is deliberately NOT treated as authentication. Dedicated operator logins must not be shared.
CREATE FUNCTION public.bookcore_requeue_outbox_bound(p_tenant uuid,p_event uuid,p_reason text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_actor uuid; v_event uuid; v_login name := session_user::name;
BEGIN
 IF p_reason IS NULL OR length(btrim(p_reason))<10 OR length(p_reason)>500 THEN
  RAISE EXCEPTION 'reason invalid' USING ERRCODE='23514';
 END IF;
 IF NOT pg_has_role(v_login,'bookcore_ops','member') THEN
  RAISE EXCEPTION 'operator login not entitled' USING ERRCODE='42501';
 END IF;
 SELECT r.actor_user_id INTO v_actor FROM public.bookcore_operator_identities r
  JOIN public.users u ON u.id=r.actor_user_id AND u.status='ACTIVE'
  WHERE r.login_role=v_login AND r.enabled=true;
 IF v_actor IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.memberships m JOIN public.organizations o ON o.id=m.tenant_id
  WHERE m.tenant_id=p_tenant AND m.user_id=v_actor AND m.role='OWNER'
   AND m.status='ACTIVE' AND o.status='ACTIVE') THEN
  RAISE EXCEPTION 'operator tenant authorization denied' USING ERRCODE='42501';
 END IF;
 -- Serialize with tenant administration before the event row lock, matching the global lock order.
 PERFORM 1 FROM public.organizations WHERE id=p_tenant AND status='ACTIVE' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'organization status changed' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.memberships WHERE tenant_id=p_tenant AND user_id=v_actor
  AND role='OWNER' AND status='ACTIVE' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'operator role revoked' USING ERRCODE='42501'; END IF;
 SELECT e.id INTO v_event FROM public.outbox_events e
  WHERE e.tenant_id=p_tenant AND e.id=p_event AND e.published_at IS NULL
   AND e.failed_at IS NOT NULL FOR UPDATE;
 IF v_event IS NULL THEN RETURN false; END IF;
 UPDATE public.outbox_events SET failed_at=NULL,last_error_code=NULL,claimed_by=NULL,
  claim_started_at=NULL,lease_until=NULL,available_at=clock_timestamp(),attempts=0
  WHERE tenant_id=p_tenant AND id=v_event;
 INSERT INTO public.audit_events(tenant_id,actor_id,action,aggregate_type,aggregate_id,reason,metadata)
  VALUES(p_tenant,v_actor,'OUTBOX_REQUEUED','OUTBOX',v_event,btrim(p_reason),
    jsonb_build_object('dbLogin',v_login::text,'operatorBinding','session_user'));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.bookcore_requeue_outbox_bound(uuid,uuid,text) FROM PUBLIC,bookcore_app,bookcore_worker;
GRANT EXECUTE ON FUNCTION public.bookcore_requeue_outbox_bound(uuid,uuid,text) TO bookcore_ops;

-- Sanitized, tenant-bound quarantine listing. No direct membership/organization SELECT for ops.
CREATE FUNCTION public.bookcore_list_quarantined_outbox(p_tenant uuid)
 RETURNS TABLE(id uuid,event_type text,created_at timestamptz,attempts int,last_error_code text,failed_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=pg_catalog,public AS $$
DECLARE v_actor uuid; v_login name:=session_user::name;
BEGIN
 IF NOT pg_has_role(v_login,'bookcore_ops','member') THEN
  RAISE EXCEPTION 'ops role denied' USING ERRCODE='42501'; END IF;
 SELECT r.actor_user_id INTO v_actor FROM public.bookcore_operator_identities r
 JOIN public.users u ON u.id=r.actor_user_id AND u.status='ACTIVE'
 WHERE r.login_role=v_login AND r.enabled;
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.memberships m
   JOIN public.organizations o ON o.id=m.tenant_id
   WHERE m.tenant_id=p_tenant AND m.user_id=v_actor
    AND m.role='OWNER' AND m.status='ACTIVE' AND o.status='ACTIVE') THEN
  RAISE EXCEPTION 'ops tenant access denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT e.id,e.event_type,e.created_at,e.attempts,e.last_error_code,e.failed_at
  FROM public.outbox_events e WHERE e.tenant_id=p_tenant AND e.failed_at IS NOT NULL
   AND e.published_at IS NULL ORDER BY e.failed_at DESC,e.id LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION public.bookcore_list_quarantined_outbox(uuid) FROM PUBLIC,bookcore_app,bookcore_worker;
GRANT EXECUTE ON FUNCTION public.bookcore_list_quarantined_outbox(uuid) TO bookcore_ops;

CREATE INDEX IF NOT EXISTS p10_outbox_receipts_tenant_type ON public.processed_outbox_events(tenant_id,event_type);

-- Privileged inspection emits only structured findings, not email/token data. Tenant OWNER bound to
-- the actual LOGIN role, and LIMIT is mandatory. READ ONLY transactions on caller side are required.
CREATE FUNCTION public.bookcore_inspect_tenant(p_tenant uuid,p_limit int DEFAULT 100)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=pg_catalog,public AS $$
DECLARE v_actor uuid; v_findings jsonb:='[]'::jsonb; v_rec record; v_count bigint; v_invites bigint; v_consents bigint;
BEGIN
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN
  RAISE EXCEPTION 'invalid inspection limit' USING ERRCODE='22023'; END IF;
 IF NOT pg_has_role(session_user,'bookcore_inspector','member') THEN
  RAISE EXCEPTION 'inspector unauthorized' USING ERRCODE='42501'; END IF;
 SELECT r.actor_user_id INTO v_actor FROM public.bookcore_operator_identities r
 JOIN public.users u ON u.id=r.actor_user_id AND u.status='ACTIVE'
 WHERE r.login_role=session_user::name AND r.enabled;
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.tenant_id=p_tenant AND m.user_id=v_actor AND m.status='ACTIVE' AND m.role='OWNER') THEN
  RAISE EXCEPTION 'tenant inspection denied' USING ERRCODE='42501'; END IF;
 FOR v_rec IN SELECT s.id,s.status,s.capacity_total,s.seats_committed,
    (SELECT count(*) FROM public.bookings b WHERE b.tenant_id=s.tenant_id AND b.session_id=s.id
      AND b.status IN('CONFIRMED','ATTENDED','NO_SHOW')) AS effective_count,
    (SELECT count(*) FROM public.resource_allocations a WHERE a.tenant_id=s.tenant_id
      AND a.session_id=s.id AND a.active) AS active_allocations
    FROM public.sessions s WHERE s.tenant_id=p_tenant ORDER BY s.start_at,s.id LIMIT p_limit LOOP
  IF v_rec.seats_committed<>v_rec.effective_count THEN
   v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','COUNTER_DRIFT','id',v_rec.id,
    'stored',v_rec.seats_committed,'effective',v_rec.effective_count)); END IF;
  IF v_rec.seats_committed<0 OR v_rec.seats_committed>v_rec.capacity_total THEN
   v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','CAPACITY_BOUNDS','id',v_rec.id)); END IF;
  IF v_rec.status='CANCELLED' AND (v_rec.effective_count>0 OR v_rec.active_allocations>0) THEN
   v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','CANCELLED_SESSION_DRIFT','id',v_rec.id)); END IF;
 END LOOP;
 FOR v_rec IN SELECT b.id,b.status,
   (SELECT count(*) FROM public.booking_events e WHERE e.tenant_id=b.tenant_id
     AND e.booking_id=b.id AND e.from_status IS NULL AND e.to_status='CONFIRMED') AS initial_count,
   (SELECT e.to_status FROM public.booking_events e WHERE e.tenant_id=b.tenant_id
     AND e.booking_id=b.id ORDER BY e.at DESC,e.id DESC LIMIT 1) AS last_state
   FROM public.bookings b WHERE b.tenant_id=p_tenant ORDER BY b.created_at,b.id LIMIT p_limit LOOP
  IF v_rec.initial_count<>1 OR v_rec.last_state IS DISTINCT FROM v_rec.status THEN
   v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','BOOKING_EVENT_CHAIN','id',v_rec.id)); END IF;
 END LOOP;
 FOR v_rec IN SELECT c.event_type,c.processed_count,
    (SELECT count(*) FROM public.processed_outbox_events r
     WHERE r.tenant_id=c.tenant_id AND r.event_type=c.event_type) AS receipt_count
   FROM public.outbox_event_counters c WHERE c.tenant_id=p_tenant ORDER BY c.event_type LIMIT p_limit LOOP
   IF v_rec.processed_count<>v_rec.receipt_count THEN
    v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','OUTBOX_PROJECTION_DRIFT',
     'eventType',v_rec.event_type,'stored',v_rec.processed_count,'receipts',v_rec.receipt_count)); END IF;
 END LOOP;
 SELECT count(*) INTO v_invites FROM (SELECT 1 FROM public.staff_invitations
    WHERE tenant_id=p_tenant AND status='PENDING' AND expires_at<=clock_timestamp() LIMIT p_limit) i;
 SELECT count(*) INTO v_consents FROM (SELECT 1 FROM public.booking_consents
    WHERE tenant_id=p_tenant AND revoked_at IS NULL AND expires_at<=clock_timestamp() LIMIT p_limit) c;
 SELECT count(*) INTO v_count FROM (
  SELECT id FROM public.outbox_events WHERE tenant_id=p_tenant AND published_at IS NULL
   AND failed_at IS NULL AND lease_until<clock_timestamp()-interval '10 minutes' LIMIT p_limit
 ) q;
 RETURN jsonb_build_object('tenantId',p_tenant,'sessionLimit',p_limit,'findings',v_findings,
  'staleLeasesSample',v_count,'expiredInvitationSample',v_invites,
  'expiredConsentSample',v_consents,'readOnly',true,'completeScan',false);
END $$;
REVOKE ALL ON FUNCTION public.bookcore_inspect_tenant(uuid,int) FROM PUBLIC,bookcore_app,bookcore_worker,bookcore_ops;
GRANT EXECUTE ON FUNCTION public.bookcore_inspect_tenant(uuid,int) TO bookcore_inspector;

-- Global cleanup only of short-lived auth rate buckets. Other domains are intentionally READ-ONLY.
CREATE TABLE public.bookcore_maintenance_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),db_login name NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 action text NOT NULL,reason text NOT NULL,affected integer NOT NULL CHECK(affected>=0),
 executed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER bookcore_maintenance_audit_immutable BEFORE UPDATE OR DELETE ON public.bookcore_maintenance_audit
 FOR EACH ROW EXECUTE FUNCTION public.forbid_history_mutation();
REVOKE ALL ON public.bookcore_maintenance_audit FROM PUBLIC,bookcore_app,bookcore_worker,bookcore_ops,bookcore_inspector;
CREATE FUNCTION public.bookcore_prune_auth_rate_buckets(p_limit int,p_hours int,p_reason text,p_apply boolean DEFAULT false)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_actor uuid; v_count int:=0; v_login name:=session_user::name;
BEGIN
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 OR p_hours IS NULL OR p_hours<48 OR p_hours>8760 OR
    p_reason IS NULL OR length(btrim(p_reason))<10 OR length(p_reason)>500 OR p_apply IS NULL THEN
  RAISE EXCEPTION 'invalid maintenance parameters' USING ERRCODE='22023'; END IF;
 IF NOT pg_has_role(v_login,'bookcore_maintenance','member') THEN
  RAISE EXCEPTION 'maintenance role denied' USING ERRCODE='42501'; END IF;
 SELECT r.actor_user_id INTO v_actor FROM public.bookcore_operator_identities r
 JOIN public.users u ON u.id=r.actor_user_id AND u.status='ACTIVE'
 WHERE r.login_role=v_login AND r.enabled;
 IF v_actor IS NULL THEN RAISE EXCEPTION 'operator binding missing' USING ERRCODE='42501'; END IF;
 IF NOT p_apply THEN
  SELECT count(*)::int INTO v_count FROM (
   SELECT 1 FROM public.auth_rate_limits WHERE bucket_start<clock_timestamp()-make_interval(hours=>p_hours)
   ORDER BY bucket_start,key_hash LIMIT p_limit) q;
  RETURN v_count;
 END IF;
 WITH candidates AS (
   SELECT key_hash FROM public.auth_rate_limits
   WHERE bucket_start<clock_timestamp()-make_interval(hours=>p_hours)
   ORDER BY bucket_start,key_hash LIMIT p_limit FOR UPDATE SKIP LOCKED
 ) DELETE FROM public.auth_rate_limits a USING candidates c WHERE a.key_hash=c.key_hash;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 INSERT INTO public.bookcore_maintenance_audit(db_login,actor_user_id,action,reason,affected)
 VALUES(v_login,v_actor,'AUTH_RATE_BUCKET_PRUNED',btrim(p_reason),v_count);
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.bookcore_prune_auth_rate_buckets(int,int,text,boolean)
 FROM PUBLIC,bookcore_app,bookcore_worker,bookcore_inspector,bookcore_ops;
GRANT EXECUTE ON FUNCTION public.bookcore_prune_auth_rate_buckets(int,int,text,boolean) TO bookcore_maintenance;
