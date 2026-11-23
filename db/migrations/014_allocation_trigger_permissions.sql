-- The allocation trigger must lock its resource while the API has read-only resource access.
CREATE OR REPLACE FUNCTION public.lock_resource_for_allocation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
 IF NEW.active THEN
  PERFORM 1 FROM public.resources WHERE tenant_id=NEW.tenant_id AND id=NEW.resource_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'allocation resource not found' USING ERRCODE='23503'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.lock_resource_for_allocation() FROM PUBLIC;
