-- Serialize privileged requeue with changes to the operator binding and user status.
CREATE OR REPLACE FUNCTION public.bookcore_requeue_outbox_bound(p_tenant uuid,p_event uuid,p_reason text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_actor uuid; v_event uuid; v_login name := session_user::name;
BEGIN
 IF p_reason IS NULL OR length(btrim(p_reason))<10 OR length(btrim(p_reason))>500 THEN
  RAISE EXCEPTION 'reason invalid' USING ERRCODE='23514';
 END IF;
 IF NOT pg_has_role(v_login,'bookcore_ops','member') THEN
  RAISE EXCEPTION 'operator login not entitled' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.organizations WHERE id=p_tenant AND status='ACTIVE' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'operator tenant authorization denied' USING ERRCODE='42501'; END IF;
 SELECT r.actor_user_id INTO v_actor FROM public.bookcore_operator_identities r
 JOIN public.users u ON u.id=r.actor_user_id AND u.status='ACTIVE'
 WHERE r.login_role=v_login AND r.enabled FOR SHARE OF r,u;
 IF v_actor IS NULL THEN RAISE EXCEPTION 'operator tenant authorization denied' USING ERRCODE='42501'; END IF;
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
