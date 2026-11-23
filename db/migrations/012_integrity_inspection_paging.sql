-- Phase 11: additive, source candidate requiring PostgreSQL 17 verification.
-- Historical migrations 001-011 are immutable. No writes to business data are authorized here.
-- Each page uses one READ COMMITTED snapshot and immutable ID keyset; asOf excludes later inserts.
-- This is NOT a single cross-page snapshot: concurrent updates may be observed differently.
-- Session/Booking/Invitation/Consent already have UNIQUE(tenant_id,id) covering the keyset.
-- Only Outbox needs an additional tenant-ID paging index.
CREATE INDEX IF NOT EXISTS p11_outbox_inspection_page ON public.outbox_events(tenant_id,id);

CREATE FUNCTION public.bookcore_inspect_tenant_page(
 p_tenant uuid,p_kind text,p_after text,p_asof timestamptz,p_limit int DEFAULT 50
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog,public AS $$
DECLARE
 v_actor uuid;v_login name:=session_user::name;
 v_asof timestamptz:=coalesce(p_asof,clock_timestamp());
 v_after_id uuid;v_after_text text;
 v_seen int:=0;v_more boolean:=false;v_last text:=NULL;
 v_findings jsonb:='[]'::jsonb;v_rec record;v_event record;
 v_events int;v_initials int;v_prior text;v_invalid boolean;
 v_problem text;v_m004 timestamptz;v_is_legacy boolean;
BEGIN
 IF p_tenant IS NULL OR p_kind IS NULL OR p_kind NOT IN
    ('SESSION','BOOKING','OUTBOX','COUNTER','INVITATION','CONSENT')
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR v_asof>clock_timestamp() OR v_asof='infinity'::timestamptz
    OR v_asof='-infinity'::timestamptz THEN
  RAISE EXCEPTION 'invalid inspection parameters' USING ERRCODE='22023';
 END IF;
 IF p_after IS NOT NULL THEN
  IF length(p_after)>80 THEN RAISE EXCEPTION 'invalid cursor' USING ERRCODE='22023';END IF;
  IF p_kind='COUNTER' THEN v_after_text:=p_after;
  ELSE
   IF p_after !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'invalid cursor' USING ERRCODE='22023';
   END IF;
   v_after_id:=p_after::uuid;
  END IF;
 END IF;
 IF NOT pg_has_role(v_login,'bookcore_inspector','member') THEN
  RAISE EXCEPTION 'inspection credential required' USING ERRCODE='42501';END IF;
 SELECT r.actor_user_id INTO v_actor FROM public.bookcore_operator_identities r
 JOIN public.users u ON u.id=r.actor_user_id AND u.status='ACTIVE'
 WHERE r.login_role=v_login AND r.enabled=true;
 IF v_actor IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.memberships m JOIN public.organizations o ON o.id=m.tenant_id
  WHERE m.tenant_id=p_tenant AND m.user_id=v_actor AND m.role='OWNER'
    AND m.status='ACTIVE' AND o.status='ACTIVE') THEN
  RAISE EXCEPTION 'tenant inspection denied' USING ERRCODE='42501';END IF;

 IF p_kind='SESSION' THEN
  FOR v_rec IN SELECT s.id,s.status,s.capacity_total,s.seats_committed,
     (SELECT count(*) FROM public.bookings b WHERE b.tenant_id=s.tenant_id
      AND b.session_id=s.id AND b.status IN ('CONFIRMED','ATTENDED','NO_SHOW')) AS effective,
     (SELECT count(*) FROM public.resource_allocations a WHERE a.tenant_id=s.tenant_id
      AND a.session_id=s.id AND a.active) AS allocations
   FROM public.sessions s WHERE s.tenant_id=p_tenant AND s.created_at<=v_asof
    AND (v_after_id IS NULL OR s.id>v_after_id)
   ORDER BY s.id LIMIT p_limit+1 LOOP
   v_seen:=v_seen+1;IF v_seen>p_limit THEN v_more:=true;EXIT;END IF;
   v_last:=v_rec.id::text;
   IF v_rec.seats_committed<>v_rec.effective THEN
    v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','COUNTER_DRIFT','id',v_rec.id,
     'stored',v_rec.seats_committed,'effective',v_rec.effective));END IF;
   IF v_rec.seats_committed<0 OR v_rec.seats_committed>v_rec.capacity_total THEN
    v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','CAPACITY_BOUNDS','id',v_rec.id));END IF;
   IF v_rec.status='CANCELLED' AND (v_rec.effective>0 OR v_rec.allocations>0) THEN
    v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','CANCELLED_SESSION_DRIFT',
     'id',v_rec.id,'effective',v_rec.effective,'allocations',v_rec.allocations));END IF;
  END LOOP;
 ELSIF p_kind='BOOKING' THEN
  SELECT applied_at INTO v_m004 FROM public.bookcore_migrations WHERE name='004_history_consistency.sql';
  FOR v_rec IN SELECT b.id,b.tenant_id,b.status,b.created_at,b.cancel_reason
   FROM public.bookings b WHERE b.tenant_id=p_tenant AND b.created_at<=v_asof
    AND (v_after_id IS NULL OR b.id>v_after_id)
   ORDER BY b.id LIMIT p_limit+1 LOOP
   v_seen:=v_seen+1;IF v_seen>p_limit THEN v_more:=true;EXIT;END IF;
   v_last:=v_rec.id::text;v_events:=0;v_initials:=0;v_prior:=NULL;v_invalid:=false;
   v_problem:=NULL;
   FOR v_event IN SELECT e.from_status,e.to_status,e.reason,e.event_order
    FROM public.booking_events e WHERE e.tenant_id=p_tenant AND e.booking_id=v_rec.id
    ORDER BY e.event_order ASC LOOP
    v_events:=v_events+1;
    IF v_event.from_status IS NULL AND v_event.to_status='CONFIRMED' THEN
     v_initials:=v_initials+1;END IF;
    IF v_events=1 THEN
     IF v_event.from_status IS NOT NULL OR v_event.to_status<>'CONFIRMED' OR v_event.reason IS NOT NULL THEN
      v_invalid:=true;v_problem:='INITIAL_EVENT_INVALID';END IF;
    ELSE
     IF v_prior IS DISTINCT FROM 'CONFIRMED'
      OR v_event.from_status IS DISTINCT FROM v_prior
      OR v_event.to_status NOT IN ('CANCELLED','ATTENDED','NO_SHOW')
      OR (v_event.to_status='CANCELLED' AND v_event.reason IS DISTINCT FROM v_rec.cancel_reason)
      OR (v_event.to_status<>'CANCELLED' AND v_event.reason IS NOT NULL) THEN
      v_invalid:=true;v_problem:='INVALID_EVENT_TRANSITION';END IF;
    END IF;
    v_prior:=v_event.to_status;
   END LOOP;
   v_is_legacy:=v_m004 IS NOT NULL AND v_rec.created_at<v_m004;
   IF v_initials<>1 THEN
    v_findings:=v_findings||jsonb_build_array(jsonb_build_object(
     'code',CASE WHEN v_initials=0 THEN 'MISSING_INITIAL_EVENT' ELSE 'DUPLICATE_INITIAL_EVENT' END,
     'id',v_rec.id,'count',v_initials,'provenance',CASE WHEN v_is_legacy THEN 'HISTORICAL_ORDER_UNVERIFIED' ELSE 'CURRENT' END));END IF;
   IF v_invalid OR v_events>2 THEN
    v_findings:=v_findings||jsonb_build_array(jsonb_build_object(
     'code','INVALID_EVENT_TRANSITION','id',v_rec.id,'position',v_events,'detail',coalesce(v_problem,'EXTRA_EVENT'),
     'provenance',CASE WHEN v_is_legacy THEN 'HISTORICAL_ORDER_UNVERIFIED' ELSE 'CURRENT' END));END IF;
   IF v_prior IS DISTINCT FROM v_rec.status
    OR (v_rec.status='CONFIRMED' AND v_events<>1)
    OR (v_rec.status<>'CONFIRMED' AND v_events<>2) THEN
    v_findings:=v_findings||jsonb_build_array(jsonb_build_object(
     'code','BOOKING_FINAL_STATE_MISMATCH','id',v_rec.id,'events',v_events,
     'lastByEventOrder',v_prior,'stored',v_rec.status,
     'provenance',CASE WHEN v_is_legacy THEN 'HISTORICAL_ORDER_UNVERIFIED' ELSE 'CURRENT' END));END IF;
  END LOOP;
 ELSIF p_kind='OUTBOX' THEN
  FOR v_rec IN SELECT e.id,e.lease_until,e.claimed_by,e.published_at,e.failed_at,e.created_at,
    EXISTS(SELECT 1 FROM public.processed_outbox_events r WHERE r.event_id=e.id AND r.tenant_id=p_tenant) AS receipt
   FROM public.outbox_events e WHERE e.tenant_id=p_tenant AND e.created_at<=v_asof
    AND (v_after_id IS NULL OR e.id>v_after_id)
   ORDER BY e.id LIMIT p_limit+1 LOOP
   v_seen:=v_seen+1;IF v_seen>p_limit THEN v_more:=true;EXIT;END IF;
   v_last:=v_rec.id::text;
   IF v_rec.claimed_by IS NOT NULL AND v_rec.lease_until<v_asof-interval '10 minutes' THEN
    v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','OUTBOX_STALE_LEASE','id',v_rec.id));END IF;
   IF v_rec.published_at IS NOT NULL AND NOT v_rec.receipt THEN
    v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','OUTBOX_MISSING_RECEIPT','id',v_rec.id));END IF;
  END LOOP;
 ELSIF p_kind='COUNTER' THEN
  FOR v_rec IN SELECT c.event_type,c.processed_count,
    (SELECT count(*) FROM public.processed_outbox_events r WHERE r.tenant_id=c.tenant_id
      AND r.event_type=c.event_type) AS receipt_count
   FROM public.outbox_event_counters c WHERE c.tenant_id=p_tenant
    AND (v_after_text IS NULL OR c.event_type>v_after_text)
   ORDER BY c.event_type LIMIT p_limit+1 LOOP
   v_seen:=v_seen+1;IF v_seen>p_limit THEN v_more:=true;EXIT;END IF;
   v_last:=v_rec.event_type;
   IF v_rec.processed_count<>v_rec.receipt_count THEN
    v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','OUTBOX_PROJECTION_DRIFT',
     'eventType',v_rec.event_type,'stored',v_rec.processed_count,'receipts',v_rec.receipt_count));END IF;
  END LOOP;
 ELSIF p_kind='INVITATION' THEN
  FOR v_rec IN SELECT i.id,i.status,i.expires_at FROM public.staff_invitations i
   WHERE i.tenant_id=p_tenant AND i.created_at<=v_asof
    AND (v_after_id IS NULL OR i.id>v_after_id) ORDER BY i.id LIMIT p_limit+1 LOOP
   v_seen:=v_seen+1;IF v_seen>p_limit THEN v_more:=true;EXIT;END IF;
   v_last:=v_rec.id::text;
   IF v_rec.status='PENDING' AND v_rec.expires_at<=v_asof THEN
    v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','INVITATION_EXPIRED','id',v_rec.id));END IF;
  END LOOP;
 ELSIF p_kind='CONSENT' THEN
  FOR v_rec IN SELECT c.id,c.expires_at,c.revoked_at FROM public.booking_consents c
   WHERE c.tenant_id=p_tenant AND c.created_at<=v_asof
    AND (v_after_id IS NULL OR c.id>v_after_id) ORDER BY c.id LIMIT p_limit+1 LOOP
   v_seen:=v_seen+1;IF v_seen>p_limit THEN v_more:=true;EXIT;END IF;
   v_last:=v_rec.id::text;
   IF v_rec.revoked_at IS NULL AND v_rec.expires_at<=v_asof THEN
    v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','CONSENT_EXPIRED','id',v_rec.id));END IF;
  END LOOP;
 END IF;
 RETURN jsonb_build_object('tenantId',p_tenant,'kind',p_kind,'asOf',v_asof,
  'inspected',LEAST(v_seen,p_limit),'findings',v_findings,'hasMore',v_more,
  'nextAfter',CASE WHEN v_more THEN v_last ELSE NULL END,
  'kindCoverageComplete',NOT v_more,'consistentSnapshot',false,
  'readOnly',true,'repairPerformed',false);
END $$;
REVOKE ALL ON FUNCTION public.bookcore_inspect_tenant_page(uuid,text,text,timestamptz,int)
 FROM PUBLIC,bookcore_app,bookcore_worker,bookcore_ops,bookcore_maintenance;
GRANT EXECUTE ON FUNCTION public.bookcore_inspect_tenant_page(uuid,text,text,timestamptz,int)
 TO bookcore_inspector;
-- Keep legacy sample-only API as a compatibility wrapper. It does not certify full coverage.
-- The old Phase 10 test and CLI still receive readOnly=true, completeScan=false,
-- but the history sample now uses event_order via bookcore_inspect_tenant_page.
CREATE OR REPLACE FUNCTION public.bookcore_inspect_tenant(p_tenant uuid,p_limit int DEFAULT 100)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog,public AS $$
DECLARE v_sessions jsonb;v_bookings jsonb;
BEGIN
 SELECT public.bookcore_inspect_tenant_page(p_tenant,'SESSION',NULL,NULL,p_limit) INTO v_sessions;
 SELECT public.bookcore_inspect_tenant_page(p_tenant,'BOOKING',NULL,(v_sessions->>'asOf')::timestamptz,p_limit) INTO v_bookings;
 RETURN jsonb_build_object('tenantId',p_tenant,'sessionLimit',p_limit,
  'findings',(v_sessions->'findings')||(v_bookings->'findings'),
  'readOnly',true,'completeScan',false,'legacySampleOnly',true,
  'consistentSnapshot',false);
END $$;
REVOKE ALL ON FUNCTION public.bookcore_inspect_tenant(uuid,int)
 FROM PUBLIC,bookcore_app,bookcore_worker,bookcore_ops,bookcore_maintenance;
GRANT EXECUTE ON FUNCTION public.bookcore_inspect_tenant(uuid,int) TO bookcore_inspector;

