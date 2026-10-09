-- Explicit membership rejection and reviewed administrator-access applications.
ALTER TABLE notifications ALTER COLUMN message TYPE varchar(500);
ALTER TABLE verification_reviews ADD COLUMN decision text NOT NULL DEFAULT 'Revoked'
  CHECK(decision IN('Approved','Rejected','Revoked'));
UPDATE verification_reviews SET decision=CASE WHEN verified THEN 'Approved' ELSE 'Revoked' END;
ALTER TABLE users ADD COLUMN verification_status text NOT NULL DEFAULT 'Pending'
  CHECK(verification_status IN('Pending','Approved','Rejected','Revoked'));
UPDATE users SET verification_status=CASE WHEN verified_status THEN 'Approved' ELSE 'Pending' END
  WHERE deleted_at IS NULL;
GRANT SELECT(verification_status) ON users TO dbthon_runtime;
CREATE FUNCTION dbthon_membership_status() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.verified_status THEN NEW.verification_status:='Approved'; END IF;
  ELSIF NEW.deleted_at IS NOT NULL THEN NEW.verification_status:='Revoked';
  ELSIF NEW.verified_status IS DISTINCT FROM OLD.verified_status
    AND NEW.verification_status=OLD.verification_status THEN
    NEW.verification_status:=CASE WHEN NEW.verified_status THEN 'Approved' ELSE 'Revoked' END;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION dbthon_membership_status() FROM PUBLIC;
CREATE TRIGGER normalize_membership_status BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION dbthon_membership_status();

CREATE TABLE admin_access_requests (
  request_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users,
  reason varchar(500) NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 500),
  status text NOT NULL DEFAULT 'Pending' CHECK(status IN('Pending','Approved','Rejected','Cancelled')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reviewed_at timestamptz, reviewed_by bigint REFERENCES users,
  review_note varchar(300),
  CHECK((status='Pending')=(reviewed_at IS NULL)),
  CHECK(status NOT IN('Approved','Rejected') OR (reviewed_by IS NOT NULL AND length(trim(review_note))>=3))
);
CREATE UNIQUE INDEX uq_admin_request_pending ON admin_access_requests(user_id) WHERE status='Pending';
CREATE INDEX ix_admin_requests_review ON admin_access_requests(status,request_id);
GRANT SELECT ON admin_access_requests TO dbthon_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON admin_access_requests TO dbthon_guard;
GRANT USAGE,SELECT ON SEQUENCE admin_access_requests_request_id_seq TO dbthon_guard;
ALTER TABLE admin_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_access_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY guard_scope ON admin_access_requests TO dbthon_guard USING(true) WITH CHECK(true);
CREATE POLICY request_scope ON admin_access_requests FOR SELECT TO dbthon_runtime USING(
  user_id=public.dbthon_actor_id() OR EXISTS(SELECT FROM public.users u WHERE u.user_id=admin_access_requests.user_id
    AND u.deleted_at IS NULL AND public.dbthon_zone_admin(u.zone_id)));

CREATE FUNCTION dbthon_review_membership(target bigint, approved_roles text[], is_verified boolean, review_reason text, rejected boolean)
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
  IF length(trim(coalesce(review_reason,''))) NOT BETWEEN 3 AND 300 OR
    (rejected AND (is_verified OR EXISTS(SELECT FROM public.users WHERE user_id=target AND verified_status)))
    THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  IF NOT EXISTS(SELECT FROM public.users WHERE user_id=target AND active AND deleted_at IS NULL)
    THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT coalesce(approved_roles,ARRAY[]::text[])<@ARRAY['Donor','Receiver','Volunteer']::text[] THEN
    RAISE EXCEPTION 'INVALID_ROLE'; END IF;
  IF is_verified AND coalesce(cardinality(approved_roles),0)=0 THEN RAISE EXCEPTION 'ROLE_REQUIRED'; END IF;
  IF EXISTS(SELECT FROM unnest(approved_roles) role_name WHERE NOT EXISTS(
    SELECT FROM public.user_roles WHERE user_id=target AND role=role_name)) THEN RAISE EXCEPTION 'ROLE_NOT_REQUESTED'; END IF;
  IF 'Receiver'=ANY(approved_roles) AND NOT EXISTS(
    SELECT FROM public.receiver_profiles WHERE user_id=target AND capacity_kg>0) THEN RAISE EXCEPTION 'CAPACITY_REQUIRED'; END IF;
  moment:=clock_timestamp();
  UPDATE public.users SET verified_status=is_verified,verification_status=CASE WHEN rejected THEN 'Rejected' WHEN is_verified THEN 'Approved' ELSE 'Revoked' END WHERE user_id=target;
  UPDATE public.user_roles SET
    approved_at=CASE WHEN is_verified AND role=ANY(approved_roles) THEN moment ELSE NULL END,
    approved_by=CASE WHEN is_verified AND role=ANY(approved_roles) THEN actor ELSE NULL END
    WHERE user_id=target AND (role<>'Admin' OR NOT is_verified);
  INSERT INTO public.verification_reviews(target_user_id,admin_id,verified,approved_roles,reason,created_at,decision)
    VALUES(target,actor,is_verified,to_jsonb(coalesce(approved_roles,ARRAY[]::text[])),trim(review_reason),moment,
      CASE WHEN rejected THEN 'Rejected' WHEN is_verified THEN 'Approved' ELSE 'Revoked' END)
    RETURNING review_id INTO review;
  PERFORM public.dbthon_record_event(ARRAY[actor,target],CASE WHEN rejected THEN 'identity.application_rejected' ELSE 'identity.verification_changed' END,
    'verification_reviews',review,NULL,jsonb_build_object('actor_id',actor,'verified',is_verified,
      'roles',to_jsonb(coalesce(approved_roles,ARRAY[]::text[]))),moment);
  PERFORM public.dbthon_notify(ARRAY[actor,target],'verification:'||review,CASE WHEN rejected THEN 'VerificationRejected' ELSE 'VerificationChanged' END,
    CASE WHEN rejected THEN 'Your account application was rejected. Reason: '||trim(review_reason)
      WHEN is_verified THEN 'Your account application was approved.'
      ELSE 'Your account verification was revoked. Reason: '||trim(review_reason) END);
  RETURN target;
END $$;

CREATE OR REPLACE FUNCTION dbthon_verify_user(target bigint,approved_roles text[],is_verified boolean,review_reason text)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT public.dbthon_review_membership(target,approved_roles,is_verified,review_reason,false);
$$;
CREATE FUNCTION dbthon_reject_user(target bigint,review_reason text) RETURNS bigint
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT public.dbthon_review_membership(target,ARRAY[]::text[],false,review_reason,true);
$$;

CREATE FUNCTION dbthon_request_admin(request_reason text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor bigint; ref bigint; recipients bigint[];
BEGIN
  actor:=public.dbthon_require_actor(true);
  -- Notification FK locks must not invert the review's sorted user lock order.
  SELECT array_agg(u.user_id) INTO recipients FROM public.users u JOIN public.user_roles r USING(user_id)
    WHERE u.active AND u.verified_status AND r.role='Admin' AND r.approved_at IS NOT NULL
      AND (u.zone_id=public.dbthon_actor_zone() OR u.email='z1.admin@example.invalid');
  PERFORM user_id FROM public.users WHERE user_id=ANY(coalesce(recipients,ARRAY[]::bigint[])||ARRAY[actor])
    ORDER BY user_id FOR UPDATE;
  PERFORM public.dbthon_require_actor(true);
  IF NOT public.dbthon_verified_actor() THEN RAISE EXCEPTION 'VERIFICATION_REQUIRED'; END IF;
  IF public.dbthon_has_role('Admin') THEN RAISE EXCEPTION 'ALREADY_ADMIN'; END IF;
  IF length(trim(coalesce(request_reason,''))) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  IF EXISTS(SELECT FROM public.admin_access_requests WHERE user_id=actor AND status='Pending') THEN
    RAISE EXCEPTION 'ADMIN_REQUEST_PENDING'; END IF;
  IF EXISTS(SELECT FROM public.admin_access_requests WHERE user_id=actor AND created_at>clock_timestamp()-interval '24 hours')
    THEN RAISE EXCEPTION 'ADMIN_REQUEST_COOLDOWN'; END IF;
  INSERT INTO public.admin_access_requests(user_id,reason) VALUES(actor,trim(request_reason)) RETURNING request_id INTO ref;
  SELECT array_agg(u.user_id) INTO recipients FROM public.users u JOIN public.user_roles r USING(user_id)
    WHERE u.user_id=ANY(coalesce(recipients,ARRAY[]::bigint[])) AND u.active AND u.verified_status AND r.role='Admin' AND r.approved_at IS NOT NULL
      AND (u.zone_id=public.dbthon_actor_zone() OR u.email='z1.admin@example.invalid');
  PERFORM public.dbthon_record_event(ARRAY[actor],'identity.admin_requested','admin_access_requests',ref,NULL,'{}'::jsonb);
  PERFORM public.dbthon_notify(coalesce(recipients,ARRAY[]::bigint[]),'admin-request:'||ref,'AdminAccessRequested',
    'A verified member requested administrator access. Open Community members to read their reason.');
  RETURN ref;
END $$;

-- Direct grants and request approvals both close the pending application.
ALTER FUNCTION dbthon_grant_admin(bigint,text) RENAME TO dbthon_grant_admin_0014;
REVOKE ALL ON FUNCTION dbthon_grant_admin_0014(bigint,text) FROM PUBLIC,dbthon_runtime;
CREATE FUNCTION dbthon_grant_admin(target bigint,grant_reason text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE ref bigint;
BEGIN
  ref:=public.dbthon_grant_admin_0014(target,grant_reason);
  UPDATE public.users SET verification_status='Approved' WHERE user_id=target;
  UPDATE public.admin_access_requests SET status='Approved',reviewed_at=clock_timestamp(),
    reviewed_by=public.dbthon_actor_id(),review_note=trim(grant_reason) WHERE user_id=target AND status='Pending';
  RETURN ref;
END $$;

CREATE FUNCTION dbthon_review_admin_request(wanted bigint,approve boolean,review_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor bigint; target bigint; target_zone bigint; application public.admin_access_requests%ROWTYPE;
BEGIN
  actor:=public.dbthon_require_actor(true);
  IF NOT public.dbthon_has_role('Admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  SELECT a.user_id,u.zone_id INTO target,target_zone FROM public.admin_access_requests a JOIN public.users u USING(user_id)
    WHERE a.request_id=wanted AND u.deleted_at IS NULL;
  IF target IS NULL OR NOT public.dbthon_zone_admin(target_zone) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF length(trim(coalesce(review_reason,''))) NOT BETWEEN 3 AND 300 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  PERFORM user_id FROM public.users WHERE user_id IN(actor,target) ORDER BY user_id FOR UPDATE;
  PERFORM public.dbthon_require_actor(true);
  IF NOT public.dbthon_zone_admin((SELECT zone_id FROM public.users WHERE user_id=target)) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO application FROM public.admin_access_requests WHERE request_id=wanted FOR UPDATE;
  IF application.status<>'Pending' THEN RAISE EXCEPTION 'ADMIN_REQUEST_CLOSED'; END IF;
  IF NOT EXISTS(SELECT FROM public.users WHERE user_id=target AND active AND verified_status)
    THEN RAISE EXCEPTION 'VERIFICATION_REQUIRED'; END IF;
  IF approve THEN PERFORM public.dbthon_grant_admin(target,review_reason);
  ELSE
    UPDATE public.admin_access_requests SET status='Rejected',reviewed_at=clock_timestamp(),reviewed_by=actor,
      review_note=trim(review_reason) WHERE request_id=wanted;
    PERFORM public.dbthon_notify(ARRAY[target],'admin-request-rejected:'||wanted,'AdminAccessRejected',
      'Your administrator access request was rejected. Reason: '||trim(review_reason));
  END IF;
  PERFORM public.dbthon_record_event(ARRAY[actor,target],'identity.admin_request_reviewed','admin_access_requests',wanted,NULL,
    jsonb_build_object('approved',approve,'reviewer_id',actor));
END $$;

CREATE FUNCTION dbthon_close_deleted_admin_requests() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.admin_access_requests SET status='Cancelled',reviewed_at=clock_timestamp(),review_note='Account deleted'
      WHERE user_id=NEW.user_id AND status='Pending';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER close_deleted_admin_requests AFTER UPDATE OF deleted_at ON users
  FOR EACH ROW EXECUTE FUNCTION dbthon_close_deleted_admin_requests();

DO $$ DECLARE fn text; BEGIN
  FOREACH fn IN ARRAY ARRAY['dbthon_review_membership(bigint,text[],boolean,text,boolean)',
    'dbthon_verify_user(bigint,text[],boolean,text)','dbthon_reject_user(bigint,text)',
    'dbthon_request_admin(text)','dbthon_grant_admin(bigint,text)',
    'dbthon_review_admin_request(bigint,boolean,text)','dbthon_close_deleted_admin_requests()'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO dbthon_guard',fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',fn);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION dbthon_verify_user(bigint,text[],boolean,text),dbthon_reject_user(bigint,text),
  dbthon_request_admin(text),dbthon_grant_admin(bigint,text),dbthon_review_admin_request(bigint,boolean,text) TO dbthon_runtime;
