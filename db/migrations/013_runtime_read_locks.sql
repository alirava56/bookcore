-- Authorize row locks without granting runtime UPDATE on protected entities.
CREATE FUNCTION public.bookcore_share_active_organization(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
 PERFORM 1 FROM public.organizations WHERE id=p_id AND status='ACTIVE' FOR SHARE;
 RETURN FOUND;
END $$;

CREATE FUNCTION public.bookcore_share_active_user(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
 PERFORM 1 FROM public.users WHERE id=p_id AND status='ACTIVE' FOR SHARE;
 RETURN FOUND;
END $$;

CREATE FUNCTION public.bookcore_share_active_catalog(p_tenant uuid,p_id uuid,p_kind text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
 CASE p_kind
  WHEN 'branch' THEN
   PERFORM 1 FROM public.branches WHERE tenant_id=p_tenant AND id=p_id AND active FOR SHARE;
  WHEN 'service' THEN
   PERFORM 1 FROM public.services WHERE tenant_id=p_tenant AND id=p_id AND active FOR SHARE;
  WHEN 'resource' THEN
   PERFORM 1 FROM public.resources WHERE tenant_id=p_tenant AND id=p_id AND active FOR SHARE;
  ELSE RETURN false;
 END CASE;
 RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.bookcore_share_active_organization(uuid),
 public.bookcore_share_active_user(uuid),public.bookcore_share_active_catalog(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bookcore_share_active_organization(uuid),
 public.bookcore_share_active_user(uuid),public.bookcore_share_active_catalog(uuid,uuid,text) TO bookcore_app;
