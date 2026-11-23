-- Prevent retrospective buffer/ownership edits while a resource has active allocations.
CREATE FUNCTION prohibit_active_resource_redefinition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (OLD.buffer_before_min,OLD.buffer_after_min,OLD.branch_id,OLD.trainer_user_id,OLD.type)
  IS DISTINCT FROM (NEW.buffer_before_min,NEW.buffer_after_min,NEW.branch_id,NEW.trainer_user_id,NEW.type)
   AND EXISTS(SELECT 1 FROM resource_allocations
     WHERE tenant_id=OLD.tenant_id AND resource_id=OLD.id AND active) THEN
   RAISE EXCEPTION 'cannot redefine an allocated resource' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assigned_resource_immutable BEFORE UPDATE ON resources
 FOR EACH ROW EXECUTE FUNCTION prohibit_active_resource_redefinition();
