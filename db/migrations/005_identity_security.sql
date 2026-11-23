-- Phase 04 additive identity/tenancy schema; migrate with a dedicated owner.
-- Existing migrations 001-004 are immutable. PostgreSQL 17 target (runtime unverified until integration).
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM users GROUP BY lower(btrim(email)) HAVING count(*)>1) THEN
   RAISE EXCEPTION 'pre-existing case-folded email duplicates need operator remediation';
 END IF;
END $$;
CREATE UNIQUE INDEX users_email_normalized_uq ON users ((lower(btrim(email))));
CREATE TABLE password_credentials (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
 password_hash text NOT NULL CHECK(length(password_hash) BETWEEN 50 AND 512),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE auth_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK(expires_at>created_at),
 CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id,expires_at) WHERE revoked_at IS NULL;
CREATE TABLE refresh_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES auth_sessions(id) ON DELETE RESTRICT,
 family_id uuid NOT NULL,
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 parent_id uuid REFERENCES refresh_tokens(id) ON DELETE RESTRICT,
 consumed_at timestamptz,
 invalidated_at timestamptz,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(expires_at>created_at),
 CHECK(consumed_at IS NULL OR consumed_at>=created_at),
 CHECK(invalidated_at IS NULL OR invalidated_at>=created_at)
);
CREATE UNIQUE INDEX refresh_tokens_one_child ON refresh_tokens(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX refresh_tokens_by_session ON refresh_tokens(session_id,created_at);
CREATE TABLE auth_rate_limits (
 key_hash text PRIMARY KEY CHECK(key_hash~'^[a-f0-9]{64}$'),
 bucket_start timestamptz NOT NULL, count integer NOT NULL CHECK(count>0)
);
-- Application-level organization row locks serialize role removals; trigger defends last OWNER even under direct SQL.
CREATE FUNCTION lock_bookcore_organization(p_id uuid) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v uuid;
BEGIN
 SELECT id INTO v FROM public.organizations WHERE id=p_id AND status='ACTIVE' FOR UPDATE;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION lock_bookcore_organization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lock_bookcore_organization(uuid) TO bookcore_app;
CREATE FUNCTION protect_last_active_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.role='OWNER' AND OLD.status='ACTIVE' AND
    (CASE WHEN TG_OP='DELETE' THEN true ELSE
      (NEW.role IS DISTINCT FROM 'OWNER' OR NEW.status IS DISTINCT FROM 'ACTIVE') END) THEN
   PERFORM 1 FROM organizations WHERE id=OLD.tenant_id FOR UPDATE;
   IF NOT EXISTS(SELECT 1 FROM memberships WHERE tenant_id=OLD.tenant_id
        AND user_id<>OLD.user_id AND role='OWNER' AND status='ACTIVE') THEN
     RAISE EXCEPTION 'last active owner cannot be revoked' USING ERRCODE='23514';
   END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER last_owner_guard BEFORE UPDATE OF role,status OR DELETE ON memberships
 FOR EACH ROW EXECUTE FUNCTION protect_last_active_owner();
-- Auth token identities are append-only except lifecycle timestamp columns.
CREATE FUNCTION guard_auth_sensitive_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='auth_sessions' THEN
   IF (OLD.id,OLD.user_id,OLD.created_at,OLD.expires_at) IS DISTINCT FROM
      (NEW.id,NEW.user_id,NEW.created_at,NEW.expires_at) OR
      (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
     RAISE EXCEPTION 'immutable auth session identity' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='refresh_tokens' THEN
   IF (OLD.id,OLD.session_id,OLD.family_id,OLD.token_hash,OLD.parent_id,OLD.expires_at,OLD.created_at) IS DISTINCT FROM
      (NEW.id,NEW.session_id,NEW.family_id,NEW.token_hash,NEW.parent_id,NEW.expires_at,NEW.created_at) OR
      (OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS DISTINCT FROM OLD.consumed_at) OR
      (OLD.invalidated_at IS NOT NULL AND NEW.invalidated_at IS DISTINCT FROM OLD.invalidated_at) THEN
     RAISE EXCEPTION 'immutable refresh token identity' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_auth_session BEFORE UPDATE ON auth_sessions
 FOR EACH ROW EXECUTE FUNCTION guard_auth_sensitive_identity();
CREATE TRIGGER protect_refresh_tokens BEFORE UPDATE ON refresh_tokens
 FOR EACH ROW EXECUTE FUNCTION guard_auth_sensitive_identity();
-- Privilege boundary: role must exist before this migration. App role never owns data/schema.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bookcore_app') THEN
  RAISE EXCEPTION 'bookcore_app runtime role must be provisioned before 005';
 END IF;
END $$;
REVOKE ALL ON password_credentials,auth_sessions,refresh_tokens,auth_rate_limits FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO bookcore_app;
GRANT SELECT,INSERT ON users,organizations,memberships,audit_events,outbox_events TO bookcore_app;
GRANT UPDATE(status,revoked_at,role) ON memberships TO bookcore_app;
GRANT SELECT ON users,organizations,memberships,audit_events,bookcore_migrations TO bookcore_app;
GRANT SELECT,INSERT ON password_credentials TO bookcore_app;
GRANT SELECT,INSERT ON auth_sessions,refresh_tokens,auth_rate_limits TO bookcore_app;
GRANT UPDATE(revoked_at) ON auth_sessions TO bookcore_app;
GRANT UPDATE(consumed_at,invalidated_at) ON refresh_tokens TO bookcore_app;
GRANT UPDATE(count,bucket_start) ON auth_rate_limits TO bookcore_app;
