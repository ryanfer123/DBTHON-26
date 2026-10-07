-- Forward repair for a database stamped 0007 without its zone-review changes.
-- Preserve confirmations when the column is already installed.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users'
      AND column_name='zone_review_required') THEN
    ALTER TABLE public.users ADD COLUMN zone_review_required boolean NOT NULL DEFAULT false;
    UPDATE public.users SET zone_review_required=true;
  END IF;
END $$;

UPDATE zones SET zone_name='Vellore Fort',city='Vellore',pincode_range='632004' WHERE zone_id=1;
UPDATE zones SET zone_name='Sathuvachari',city='Vellore',pincode_range='632009' WHERE zone_id=2;
UPDATE zones SET zone_name='Shenbakkam',city='Vellore',pincode_range='632008' WHERE zone_id=3;
UPDATE zones SET zone_name='Katpadi',city='Vellore',pincode_range='632007' WHERE zone_id=4;

CREATE OR REPLACE FUNCTION dbthon_zone_admin(wanted_zone bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT public.dbthon_has_role('Admin') AND (
    wanted_zone=public.dbthon_actor_zone() OR EXISTS(
      SELECT FROM public.users WHERE user_id=public.dbthon_actor_id()
        AND email='z1.admin@example.invalid'
    )
  );
$$;

CREATE OR REPLACE FUNCTION dbthon_confirm_zone(wanted_zone bigint) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor bigint; old_zone bigint;
BEGIN
  actor:=public.dbthon_require_actor(true);
  IF NOT EXISTS(SELECT FROM public.zones WHERE zone_id=wanted_zone) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT zone_id INTO old_zone FROM public.users WHERE user_id=actor FOR UPDATE;
  PERFORM public.dbthon_require_actor(true);
  IF old_zone<>wanted_zone AND (
    EXISTS(SELECT FROM public.food_listings WHERE donor_id=actor AND status IN('Available','Claimed','PickedUp')) OR
    EXISTS(SELECT FROM public.claims WHERE receiver_id=actor AND status='Confirmed') OR
    EXISTS(SELECT FROM public.pickups WHERE volunteer_id=actor AND status IN('Scheduled','PickedUp'))
  ) THEN RAISE EXCEPTION 'ACTIVE_EXCHANGES'; END IF;
  UPDATE public.users SET zone_id=wanted_zone,zone_review_required=false WHERE user_id=actor;
  PERFORM public.dbthon_record_event(ARRAY[actor],'identity.zone_confirmed','users',actor,NULL,
    jsonb_build_object('previous_zone_id',old_zone,'zone_id',wanted_zone));
  RETURN actor;
END $$;

CREATE OR REPLACE FUNCTION dbthon_verify_user(target bigint, approved_roles text[], is_verified boolean, review_reason text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor bigint; target_zone bigint; review bigint; moment timestamptz;
BEGIN
  actor:=public.dbthon_require_actor(true);
  IF NOT public.dbthon_has_role('Admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  SELECT zone_id INTO target_zone FROM public.users WHERE user_id=target;
  IF target_zone IS NULL OR NOT public.dbthon_zone_admin(target_zone) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  PERFORM user_id FROM public.users WHERE user_id=ANY(ARRAY[actor,target]) ORDER BY user_id FOR UPDATE;
  PERFORM public.dbthon_require_actor(true);
  IF NOT public.dbthon_zone_admin(target_zone) OR NOT EXISTS(
    SELECT FROM public.users WHERE user_id=target AND zone_id=target_zone) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT coalesce(approved_roles,ARRAY[]::text[])<@ARRAY['Donor','Receiver','Volunteer']::text[] THEN
    RAISE EXCEPTION 'INVALID_ROLE'; END IF;
  IF is_verified AND coalesce(cardinality(approved_roles),0)=0 THEN RAISE EXCEPTION 'ROLE_REQUIRED'; END IF;
  IF EXISTS(SELECT FROM unnest(approved_roles) role_name WHERE NOT EXISTS(
    SELECT FROM public.user_roles WHERE user_id=target AND role=role_name)) THEN RAISE EXCEPTION 'ROLE_NOT_REQUESTED'; END IF;
  IF 'Receiver'=ANY(approved_roles) AND NOT EXISTS(
    SELECT FROM public.receiver_profiles WHERE user_id=target AND capacity_kg>0) THEN RAISE EXCEPTION 'CAPACITY_REQUIRED'; END IF;
  moment:=clock_timestamp();
  UPDATE public.users SET verified_status=is_verified WHERE user_id=target;
  UPDATE public.user_roles SET
    approved_at=CASE WHEN is_verified AND role=ANY(approved_roles) THEN moment ELSE NULL END,
    approved_by=CASE WHEN is_verified AND role=ANY(approved_roles) THEN actor ELSE NULL END
    WHERE user_id=target AND (role<>'Admin' OR NOT is_verified);
  INSERT INTO public.verification_reviews(target_user_id,admin_id,verified,approved_roles,reason,created_at)
    VALUES(target,actor,is_verified,to_jsonb(coalesce(approved_roles,ARRAY[]::text[])),review_reason,moment)
    RETURNING review_id INTO review;
  PERFORM public.dbthon_record_event(ARRAY[actor,target],'identity.verification_changed',
    'verification_reviews',review,NULL,jsonb_build_object('actor_id',actor,'verified',is_verified,
      'roles',to_jsonb(coalesce(approved_roles,ARRAY[]::text[]))),moment);
  PERFORM public.dbthon_notify(ARRAY[actor,target],'verification:'||review,'VerificationChanged',
    'Account verification was updated by a community administrator.');
  RETURN target;
END $$;

CREATE OR REPLACE FUNCTION dbthon_grant_admin(target bigint,grant_reason text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor bigint; actor_user public.users%ROWTYPE; target_user public.users%ROWTYPE; moment timestamptz;
BEGIN
  actor:=public.dbthon_require_actor(true);
  IF target=actor OR length(trim(coalesce(grant_reason,''))) NOT BETWEEN 3 AND 300 THEN
    RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  PERFORM user_id FROM public.users WHERE user_id IN (actor,target) ORDER BY user_id FOR UPDATE;
  PERFORM public.dbthon_require_actor(true);
  SELECT * INTO actor_user FROM public.users WHERE user_id=actor;
  SELECT * INTO target_user FROM public.users WHERE user_id=target;
  IF target_user.user_id IS NULL OR NOT target_user.active THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT actor_user.active OR NOT actor_user.verified_status OR NOT public.dbthon_has_role('Admin')
    OR NOT public.dbthon_zone_admin(target_user.zone_id) THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  IF EXISTS(SELECT FROM public.user_roles WHERE user_id=target AND role='Admin' AND approved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'ALREADY_ADMIN'; END IF;
  moment:=clock_timestamp();
  UPDATE public.users SET verified_status=true WHERE user_id=target;
  INSERT INTO public.user_roles(user_id,role,approved_at,approved_by)
    VALUES(target,'Admin',moment,actor)
    ON CONFLICT(user_id,role) DO UPDATE SET approved_at=excluded.approved_at,approved_by=excluded.approved_by;
  INSERT INTO public.admin_grants(target_user_id,admin_id,reason,created_at)
    VALUES(target,actor,trim(grant_reason),moment);
  PERFORM public.dbthon_record_event(ARRAY[actor,target],'identity.admin_granted','users',target,NULL,
    jsonb_build_object('admin_id',actor,'zone_id',target_user.zone_id,'reason',trim(grant_reason)),moment);
  PERFORM public.dbthon_notify(ARRAY[target],'admin-granted:'||target||':'||actor||':'||extract(epoch FROM moment),
    'AdminAccessGranted','A community administrator granted you administrator access.');
  RETURN target;
END $$;

DO $$ DECLARE fn text; BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'dbthon_zone_admin(bigint)','dbthon_confirm_zone(bigint)',
    'dbthon_verify_user(bigint,text[],boolean,text)','dbthon_grant_admin(bigint,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',fn);
    EXECUTE format('ALTER FUNCTION %s OWNER TO dbthon_guard',fn);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION dbthon_zone_admin(bigint),dbthon_confirm_zone(bigint),
  dbthon_verify_user(bigint,text[],boolean,text),dbthon_grant_admin(bigint,text) TO dbthon_runtime;
