-- Forward-only correction after the deployed zone-review repair at 0008.
-- Read only the public review flag, never grant access to password hashes.
GRANT SELECT (zone_review_required) ON public.users TO dbthon_runtime;

-- Keep member reads within the actor's zone; the existing named bootstrap Admin
-- is the sole cross-zone administrator recognized by dbthon_zone_admin.
DROP POLICY users_scope ON public.users;
CREATE POLICY users_scope ON public.users FOR SELECT TO dbthon_runtime USING (
  user_id=public.dbthon_actor_id() OR
  (zone_id=public.dbthon_actor_zone() AND verified_status AND active
    AND public.dbthon_verified_actor()) OR public.dbthon_zone_admin(zone_id));
