-- Remove account access/profile data while preserving exchange and hash-chain references.
-- 0013 is reserved by the separate, undeployed browser-push branch.
ALTER TABLE users ADD COLUMN deleted_at timestamptz;
ALTER TABLE users ALTER COLUMN phone TYPE varchar(30);
GRANT SELECT(deleted_at) ON users TO dbthon_runtime;
ALTER TABLE users ADD CONSTRAINT deleted_account_inactive CHECK
  (deleted_at IS NULL OR (NOT active AND NOT verified_status AND password_hash=''));

CREATE FUNCTION dbthon_delete_account(target bigint,confirmation text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor bigint; member public.users%ROWTYPE; moment timestamptz;
BEGIN
  actor:=public.dbthon_require_actor(true);
  SELECT * INTO member FROM public.users WHERE user_id=target;
  IF NOT FOUND OR member.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF actor<>target AND NOT public.dbthon_has_role('Admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  IF actor<>target AND NOT public.dbthon_zone_admin(member.zone_id) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF lower(trim(coalesce(confirmation,'')))<>member.email THEN RAISE EXCEPTION 'DELETE_CONFIRMATION_REQUIRED'; END IF;
  IF member.email='z1.admin@example.invalid' THEN RAISE EXCEPTION 'PROTECTED_ACCOUNT'; END IF;
  -- Match workflow lock order before removing child records or closing requests.
  PERFORM l.listing_id FROM public.food_listings l WHERE l.donor_id=target OR
    EXISTS(SELECT FROM public.claims c WHERE c.listing_id=l.listing_id AND
      (c.receiver_id=target OR EXISTS(SELECT FROM public.pickups p
        WHERE p.claim_id=c.claim_id AND p.volunteer_id=target))) OR
    EXISTS(SELECT FROM public.donor_schedules s WHERE s.template_listing_id=l.listing_id
      AND s.donor_id=target) ORDER BY l.listing_id FOR UPDATE;
  PERFORM c.claim_id FROM public.claims c WHERE c.receiver_id=target OR
    EXISTS(SELECT FROM public.food_listings l WHERE l.listing_id=c.listing_id AND l.donor_id=target) OR
    EXISTS(SELECT FROM public.pickups p WHERE p.claim_id=c.claim_id AND p.volunteer_id=target)
    ORDER BY c.claim_id FOR UPDATE;
  PERFORM p.pickup_id FROM public.pickups p WHERE p.volunteer_id=target OR
    EXISTS(SELECT FROM public.claims c JOIN public.food_listings l USING(listing_id)
      WHERE c.claim_id=p.claim_id AND (c.receiver_id=target OR l.donor_id=target))
    ORDER BY p.claim_id,p.pickup_id FOR UPDATE;
  PERFORM schedule_id FROM public.donor_schedules WHERE donor_id=target ORDER BY schedule_id FOR UPDATE;
  PERFORM request_id FROM public.food_requests WHERE receiver_id=target ORDER BY request_id FOR UPDATE;
  -- Serialize deletion with every current administrator as well as both participants.
  -- Other domain commands recheck eligibility after their sorted user locks.
  PERFORM u.user_id FROM public.users u WHERE u.user_id IN(actor,target) OR
    EXISTS(SELECT FROM public.user_roles r WHERE r.user_id=u.user_id AND r.role='Admin'
      AND r.approved_at IS NOT NULL AND u.active AND u.verified_status)
    ORDER BY u.user_id FOR UPDATE;
  PERFORM public.dbthon_require_actor(true);
  SELECT * INTO member FROM public.users WHERE user_id=target;
  IF NOT FOUND OR member.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF actor<>target THEN
    IF NOT public.dbthon_has_role('Admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
    IF NOT public.dbthon_zone_admin(member.zone_id) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  END IF;
  IF lower(trim(coalesce(confirmation,'')))<>member.email THEN
    RAISE EXCEPTION 'DELETE_CONFIRMATION_REQUIRED'; END IF;
  IF member.email='z1.admin@example.invalid' THEN RAISE EXCEPTION 'PROTECTED_ACCOUNT'; END IF;
  IF member.active AND member.verified_status AND EXISTS(SELECT FROM public.user_roles
    WHERE user_id=target AND role='Admin' AND approved_at IS NOT NULL) AND NOT EXISTS(
    SELECT FROM public.users u JOIN public.user_roles r USING(user_id)
      WHERE u.user_id<>target AND u.zone_id=member.zone_id AND u.active AND u.verified_status
        AND r.role='Admin' AND r.approved_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'LAST_ZONE_ADMIN'; END IF;
  IF EXISTS(SELECT FROM public.food_listings WHERE donor_id=target
      AND status IN('Available','Claimed','PickedUp')) OR
    EXISTS(SELECT FROM public.claims WHERE receiver_id=target AND status='Confirmed') OR
    EXISTS(SELECT FROM public.pickups WHERE volunteer_id=target AND status IN('Scheduled','PickedUp'))
    THEN RAISE EXCEPTION 'ACCOUNT_ACTIVE_EXCHANGES'; END IF;
  moment:=clock_timestamp();
  PERFORM public.dbthon_record_event(ARRAY[actor,target],'identity.account_deleted','users',target,NULL,
    jsonb_build_object('actor_id',actor,'target_id',target,'admin_action',actor<>target),moment);
  -- No contact information or free-text deletion reasons enter the immutable ledger.
  DELETE FROM public.sessions WHERE user_id=target;
  DELETE FROM public.idempotency_keys WHERE actor_id=target;
  DELETE FROM public.saved_listings WHERE user_id=target;
  DELETE FROM public.hidden_listings WHERE user_id=target;
  DELETE FROM public.notification_preferences WHERE user_id=target;
  DELETE FROM public.donor_schedules WHERE donor_id=target;
  DELETE FROM public.receiver_profiles WHERE user_id=target;
  DELETE FROM public.user_roles WHERE user_id=target;
  UPDATE public.food_requests SET closed_at=moment,close_reason='Account deleted'
    WHERE receiver_id=target AND closed_at IS NULL;
  UPDATE public.notifications SET hidden_at=moment WHERE user_id=target;
  UPDATE public.notification_outbox o SET status='Failed',locked_until=NULL,lease_token=NULL,
    last_error='Account deleted' FROM public.notifications n
    WHERE n.notification_id=o.notification_id AND n.user_id=target AND o.status IN('Pending','Processing');
  UPDATE public.users SET name='Deleted account',
    email='deleted-'||public.gen_random_uuid()::text||'@example.invalid',phone='deleted:'||target::text,
    password_hash='',latitude=0,longitude=0,active=false,verified_status=false,
    zone_review_required=false,deleted_at=moment WHERE user_id=target;
END $$;
REVOKE ALL ON FUNCTION dbthon_delete_account(bigint,text) FROM PUBLIC;
ALTER FUNCTION dbthon_delete_account(bigint,text) OWNER TO dbthon_guard;
GRANT EXECUTE ON FUNCTION dbthon_delete_account(bigint,text) TO dbthon_runtime;

CREATE FUNCTION dbthon_deleted_account_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'ACCOUNT_DELETED'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION dbthon_deleted_account_immutable() FROM PUBLIC;
CREATE TRIGGER guard_deleted_account BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION dbthon_deleted_account_immutable();
