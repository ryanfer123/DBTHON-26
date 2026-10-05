-- Guarded redistribution commands, resumable inbox delivery and scoped reporting.
ALTER TABLE notification_outbox ADD COLUMN lease_token uuid;
ALTER TABLE pickups ADD COLUMN accepted_at timestamptz;
UPDATE pickups p SET accepted_at=greatest(c.claimed_at,least(p.scheduled_time,coalesce(p.actual_pickup_time,p.scheduled_time))) FROM claims c WHERE c.claim_id=p.claim_id;
ALTER TABLE pickups ALTER COLUMN accepted_at SET DEFAULT clock_timestamp();
ALTER TABLE pickups ALTER COLUMN accepted_at SET NOT NULL;
CREATE INDEX ix_listings_zone_created ON food_listings(zone_id,created_at);
CREATE INDEX ix_claims_claimed ON claims(claimed_at,listing_id);
CREATE INDEX ix_listings_expiry ON food_listings(expiry_window_end,listing_id)
  WHERE status IN ('Available','Claimed','PickedUp');
CREATE INDEX ix_pickups_scheduled ON pickups(scheduled_time,claim_id) WHERE status='Scheduled';
CREATE INDEX ix_idempotency_expiry ON idempotency_keys(expires_at);

CREATE FUNCTION dbthon_can_view_task(wanted_claim bigint) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT public.dbthon_has_role('Volunteer') AND EXISTS(SELECT FROM public.claims c JOIN public.food_listings l USING(listing_id)
    WHERE c.claim_id=wanted_claim AND c.status='Confirmed' AND l.status='Claimed' AND l.zone_id=public.dbthon_actor_zone()
      AND l.expiry_window_end>clock_timestamp() AND public.dbthon_actor_id() NOT IN (c.receiver_id,l.donor_id)
      AND NOT EXISTS(SELECT FROM public.pickups p WHERE p.claim_id=c.claim_id AND
        (p.status='PickedUp' OR (p.status='Scheduled' AND p.scheduled_time+interval '15 minutes'>clock_timestamp())))
      AND public.ST_DWithin(l.pickup_location,(SELECT public.ST_SetSRID(public.ST_MakePoint(longitude::float8,latitude::float8),4326)::public.geography
        FROM public.users WHERE user_id=public.dbthon_actor_id()),5000));
$$;
ALTER FUNCTION dbthon_can_view_task(bigint) OWNER TO dbthon_guard;
REVOKE ALL ON FUNCTION dbthon_can_view_task(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dbthon_can_view_task(bigint) TO dbthon_runtime;
CREATE POLICY claim_task_scope ON claims FOR SELECT TO dbthon_runtime USING (public.dbthon_can_view_task(claim_id));

CREATE FUNCTION dbthon_command(operation text, object_id bigint, attempt_id bigint,
  body jsonb, request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor bigint; needed text; op_key text; fingerprint text; cached public.idempotency_keys%ROWTYPE;
  l public.food_listings%ROWTYPE; c public.claims%ROWTYPE; p public.pickups%ROWTYPE;
  affected bigint[]; allowed text[]; moment timestamptz; result jsonb; ref_id bigint;
  event_action text; event_table text; notice text; rid bigint; lid bigint;
BEGIN
  needed:=CASE
    WHEN operation IN ('listing.create','listing.update','listing.cancel') THEN 'Donor'
    WHEN operation IN ('claim.create','claim.cancel') THEN 'Receiver'
    WHEN operation IN ('pickup.accept','pickup.cancel','pickup.collect','pickup.deliver') THEN 'Volunteer'
    WHEN operation='claim.fail' THEN 'Admin'
    WHEN operation='rating.create' THEN 'Participant'
    WHEN operation='inbox.read' THEN 'Self' END;
  IF needed IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  actor:=public.dbthon_require_actor(true);
  IF needed NOT IN ('Self','Participant') AND NOT public.dbthon_has_role(needed) THEN
    RAISE EXCEPTION 'VERIFICATION_REQUIRED'; END IF;
  IF needed='Participant' AND NOT public.dbthon_verified_actor() THEN RAISE EXCEPTION 'VERIFICATION_REQUIRED'; END IF;
  IF request_key IS NULL OR length(request_key) NOT BETWEEN 8 AND 128
    OR request_key !~ '^[A-Za-z0-9_.:-]+$' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  allowed:=CASE WHEN operation IN ('listing.create','listing.update') THEN
    ARRAY['food_type','category','quantity_kg','prepared_at','expiry_window_start','expiry_window_end','pickup_lat','pickup_long']
    WHEN operation IN ('listing.cancel','claim.cancel','pickup.cancel','claim.fail') THEN ARRAY['reason']
    WHEN operation='pickup.accept' THEN ARRAY['scheduled_time']
    WHEN operation='rating.create' THEN ARRAY['target_user_id','score','comments'] ELSE ARRAY[]::text[] END;
  IF jsonb_typeof(body)<>'object' OR body-allowed<>'{}'::jsonb THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  op_key:=operation||':'||coalesce(object_id,0)||':'||coalesce(attempt_id,0);
  fingerprint:=encode(public.digest(convert_to(body::text,'UTF8'),'sha256'),'hex');
  -- Serialize identical requests before domain locks. Different bodies cannot reuse a key.
  PERFORM pg_advisory_xact_lock(hashtextextended(actor||':'||op_key||':'||request_key,0));
  IF operation='listing.create' THEN
    affected:=ARRAY[actor];
  ELSIF operation='inbox.read' THEN
    PERFORM notification_id FROM public.notifications WHERE notification_id=object_id AND user_id=actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    affected:=ARRAY[actor];
  ELSE
    IF operation IN ('listing.update','listing.cancel','claim.create') THEN lid:=object_id;
    ELSE SELECT listing_id INTO lid FROM public.claims WHERE claim_id=object_id; END IF;
    SELECT * INTO l FROM public.food_listings WHERE listing_id=lid AND zone_id=public.dbthon_actor_zone() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    IF needed='Donor' AND l.donor_id<>actor THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    IF operation='listing.cancel' THEN
      SELECT * INTO c FROM public.claims WHERE listing_id=lid AND status='Confirmed' FOR UPDATE;
    ELSIF operation NOT IN ('listing.update','claim.create') THEN
      SELECT * INTO c FROM public.claims WHERE claim_id=object_id AND listing_id=lid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    END IF;
    IF operation='claim.cancel' AND c.receiver_id<>actor THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    IF operation='rating.create' THEN
      IF actor NOT IN (l.donor_id,c.receiver_id) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
      needed:=CASE WHEN actor=l.donor_id THEN 'Donor' ELSE 'Receiver' END;
    END IF;
    IF operation LIKE 'pickup.%' AND operation<>'pickup.accept' THEN
      SELECT * INTO p FROM public.pickups WHERE claim_id=c.claim_id AND pickup_id=attempt_id FOR UPDATE;
      IF NOT FOUND OR p.volunteer_id<>actor THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    ELSIF c.claim_id IS NOT NULL THEN
      SELECT * INTO p FROM public.pickups WHERE claim_id=c.claim_id AND status IN ('Scheduled','PickedUp') FOR UPDATE;
    END IF;
    affected:=array_remove(ARRAY[actor,l.donor_id,c.receiver_id,p.volunteer_id],NULL);
  END IF;
  IF operation IN ('listing.create','listing.update') THEN
    SELECT array_agg(DISTINCT uid ORDER BY uid) INTO affected FROM (
      SELECT actor AS uid UNION SELECT u.user_id FROM public.users u JOIN public.user_roles ur USING(user_id)
        JOIN public.receiver_profiles rp USING(user_id)
      WHERE ur.role='Receiver' AND ur.approved_at IS NOT NULL AND u.active AND u.verified_status
        AND u.zone_id=public.dbthon_actor_zone() AND rp.capacity_kg>=coalesce((body->>'quantity_kg')::numeric,l.quantity_kg)
        AND public.ST_DWithin(public.ST_SetSRID(public.ST_MakePoint(
          coalesce((body->>'pickup_long')::float8,l.pickup_long::float8),coalesce((body->>'pickup_lat')::float8,l.pickup_lat::float8)),4326)::public.geography,
          public.ST_SetSRID(public.ST_MakePoint(u.longitude::float8,u.latitude::float8),4326)::public.geography,5000)
    ) locked_users;
  END IF;
  PERFORM user_id FROM public.users WHERE user_id=ANY(affected) ORDER BY user_id FOR UPDATE;
  -- Approval/session changes while waiting for a lock are authoritative now.
  PERFORM public.dbthon_require_actor(true);
  IF needed NOT IN ('Self','Participant') AND NOT public.dbthon_has_role(needed) THEN RAISE EXCEPTION 'VERIFICATION_REQUIRED'; END IF;
  IF needed='Participant' AND NOT public.dbthon_verified_actor() THEN RAISE EXCEPTION 'VERIFICATION_REQUIRED'; END IF;
  moment:=clock_timestamp();
  SELECT * INTO cached FROM public.idempotency_keys i WHERE i.actor_id=actor AND i.operation=op_key AND i.key=request_key;
  IF FOUND THEN
    IF cached.request_hash<>fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    RETURN cached.response_body;
  END IF;
  IF operation='pickup.accept' AND p.status='Scheduled' AND p.scheduled_time+interval '15 minutes'<=moment THEN
    UPDATE public.pickups SET status='Missed',ended_at=moment,reason='Collection grace period passed'
      WHERE claim_id=p.claim_id AND pickup_id=p.pickup_id;
    PERFORM public.dbthon_record_event(affected,'pickup.missed','pickups',p.pickup_id,c.claim_id,
      jsonb_build_object('listing_id',l.listing_id,'pickup_id',p.pickup_id),moment);
    PERFORM public.dbthon_notify(affected,'missed:'||c.claim_id||':'||p.pickup_id,'DeadlineUpdate','A collection was missed; a replacement may accept.');
    p:=NULL;
  END IF;
  IF operation IN ('listing.cancel','claim.cancel','pickup.cancel','claim.fail') AND
    (length(trim(body->>'reason')) NOT BETWEEN 3 AND 300 OR body->>'reason' IS NULL) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;

  IF operation IN ('listing.create','listing.update') THEN
    IF operation='listing.update' THEN
      IF l.status<>'Available' OR l.expiry_window_end<=moment THEN RAISE EXCEPTION 'LISTING_UNAVAILABLE'; END IF;
      body:=jsonb_build_object('food_type',l.food_type,'category',l.category,'quantity_kg',l.quantity_kg,
        'prepared_at',l.prepared_at,'expiry_window_start',l.expiry_window_start,'expiry_window_end',l.expiry_window_end,
        'pickup_lat',l.pickup_lat,'pickup_long',l.pickup_long)||body;
    END IF;
    IF (body->>'prepared_at')::timestamptz>moment OR (body->>'expiry_window_end')::timestamptz<=moment
      OR (body->>'expiry_window_end')::timestamptz>moment+interval '7 days' THEN RAISE EXCEPTION 'INVALID_WINDOW'; END IF;
    IF operation='listing.create' THEN
      INSERT INTO public.food_listings(donor_id,zone_id,food_type,category,quantity_kg,prepared_at,
        expiry_window_start,expiry_window_end,pickup_lat,pickup_long)
      VALUES(actor,public.dbthon_actor_zone(),trim(body->>'food_type'),body->>'category',(body->>'quantity_kg')::numeric,
        (body->>'prepared_at')::timestamptz,(body->>'expiry_window_start')::timestamptz,
        (body->>'expiry_window_end')::timestamptz,(body->>'pickup_lat')::numeric,(body->>'pickup_long')::numeric)
      RETURNING * INTO l;
    ELSE
      UPDATE public.food_listings SET food_type=trim(body->>'food_type'),category=body->>'category',quantity_kg=(body->>'quantity_kg')::numeric,
        prepared_at=(body->>'prepared_at')::timestamptz,expiry_window_start=(body->>'expiry_window_start')::timestamptz,
        expiry_window_end=(body->>'expiry_window_end')::timestamptz,pickup_lat=(body->>'pickup_lat')::numeric,
        pickup_long=(body->>'pickup_long')::numeric WHERE listing_id=l.listing_id RETURNING * INTO l;
    END IF;
    ref_id:=l.listing_id; event_table:='food_listings'; event_action:=operation;
    result:=jsonb_build_object('listing_id',ref_id,'status',l.status); notice:='A food listing has been shared or updated.';
    -- Matching alerts use exactly the same fixed profile/radius eligibility as claims.
    SELECT array_agg(u.user_id ORDER BY u.user_id) INTO affected FROM public.users u
      JOIN public.user_roles ur ON ur.user_id=u.user_id AND ur.role='Receiver' AND ur.approved_at IS NOT NULL
      JOIN public.receiver_profiles rp ON rp.user_id=u.user_id
      WHERE u.active AND u.verified_status AND u.zone_id=l.zone_id AND u.user_id<>actor AND rp.capacity_kg>=l.quantity_kg
        AND l.expiry_window_start<=moment AND public.ST_DWithin(l.pickup_location,
          public.ST_SetSRID(public.ST_MakePoint(u.longitude::float8,u.latitude::float8),4326)::public.geography,5000);
    -- Recipients need no ledger user locks: the domain event belongs to the donor.
    PERFORM public.dbthon_notify(coalesce(affected,ARRAY[]::bigint[]),'listing:'||ref_id||':'||request_key,'FoodMatch',notice);
    affected:=ARRAY[actor];
  ELSIF operation='claim.create' THEN
    ref_id:=public.dbthon_claim_listing(l.listing_id);
    result:=jsonb_build_object('claim_id',ref_id,'listing_id',l.listing_id,'status','Confirmed');
    -- Existing claim routine already appends both ledgers and inbox/outbox rows.
  ELSIF operation IN ('listing.cancel','claim.cancel','claim.fail') THEN
    IF operation<>'claim.fail' AND (l.status NOT IN ('Available','Claimed') OR p.actual_pickup_time IS NOT NULL) THEN RAISE EXCEPTION 'ACTION_NOT_ALLOWED'; END IF;
    IF operation='claim.cancel' AND c.status<>'Confirmed' THEN RAISE EXCEPTION 'ACTION_NOT_ALLOWED'; END IF;
    IF operation='claim.fail' AND c.status<>'Confirmed' THEN RAISE EXCEPTION 'ACTION_NOT_ALLOWED'; END IF;
    IF p.pickup_id IS NOT NULL THEN
      UPDATE public.pickups SET status=CASE WHEN p.status='PickedUp' THEN 'Failed' ELSE 'Cancelled' END,
        reason=body->>'reason',ended_at=moment WHERE claim_id=p.claim_id AND pickup_id=p.pickup_id;
    END IF;
    IF c.claim_id IS NOT NULL THEN
      UPDATE public.claims SET status=CASE WHEN operation='claim.fail' THEN 'Expired' ELSE 'Cancelled' END,
        ended_at=moment,cancellation_reason=body->>'reason' WHERE claim_id=c.claim_id;
    END IF;
    UPDATE public.food_listings SET status=CASE WHEN operation='claim.fail' OR l.expiry_window_end<=moment THEN 'Expired'
      WHEN operation='claim.cancel' THEN 'Available' ELSE 'Cancelled' END WHERE listing_id=l.listing_id RETURNING * INTO l;
    ref_id:=coalesce(c.claim_id,l.listing_id); event_table:=CASE WHEN c.claim_id IS NULL THEN 'food_listings' ELSE 'claims' END;
    event_action:=operation; notice:='An allocation was cancelled or closed.';
    result:=jsonb_build_object('listing_id',l.listing_id,'claim_id',c.claim_id,'status',l.status);
  ELSIF operation='pickup.accept' THEN
    IF l.expiry_window_end<=moment THEN RAISE EXCEPTION 'LISTING_EXPIRED'; END IF;
    IF l.status<>'Claimed' OR c.status<>'Confirmed' OR p.pickup_id IS NOT NULL THEN RAISE EXCEPTION 'TASK_UNAVAILABLE'; END IF;
    IF actor IN (l.donor_id,c.receiver_id) THEN RAISE EXCEPTION 'SELF_PICKUP_FORBIDDEN'; END IF;
    IF (body->>'scheduled_time')::timestamptz<moment OR (body->>'scheduled_time')::timestamptz>=l.expiry_window_end THEN RAISE EXCEPTION 'INVALID_WINDOW'; END IF;
    IF NOT public.ST_DWithin(l.pickup_location,(SELECT public.ST_SetSRID(public.ST_MakePoint(longitude::float8,latitude::float8),4326)::public.geography FROM public.users WHERE user_id=actor),5000) THEN RAISE EXCEPTION 'OUTSIDE_PICKUP_RADIUS'; END IF;
    INSERT INTO public.pickups(claim_id,volunteer_id,scheduled_time) VALUES(c.claim_id,actor,(body->>'scheduled_time')::timestamptz) RETURNING * INTO p;
    ref_id:=p.pickup_id; event_table:='pickups'; event_action:=operation; notice:='A volunteer has accepted collection.';
    result:=jsonb_build_object('claim_id',c.claim_id,'pickup_id',p.pickup_id,'status',p.status);
  ELSIF operation IN ('pickup.cancel','pickup.collect','pickup.deliver') THEN
    IF l.expiry_window_end<=moment THEN RAISE EXCEPTION 'LISTING_EXPIRED'; END IF;
    IF c.status<>'Confirmed' THEN RAISE EXCEPTION 'ACTION_NOT_ALLOWED'; END IF;
    IF operation='pickup.cancel' THEN
      IF p.status<>'Scheduled' THEN RAISE EXCEPTION 'ACTION_NOT_ALLOWED'; END IF;
      UPDATE public.pickups SET status='Cancelled',ended_at=moment,reason=body->>'reason' WHERE claim_id=c.claim_id AND pickup_id=p.pickup_id RETURNING * INTO p;
    ELSIF operation='pickup.collect' THEN
      IF p.status<>'Scheduled' OR l.status<>'Claimed' OR p.scheduled_time+interval '15 minutes'<=moment THEN RAISE EXCEPTION 'ACTION_NOT_ALLOWED'; END IF;
      UPDATE public.pickups SET status='PickedUp',actual_pickup_time=moment WHERE claim_id=c.claim_id AND pickup_id=p.pickup_id RETURNING * INTO p;
      UPDATE public.food_listings SET status='PickedUp' WHERE listing_id=l.listing_id;
    ELSE
      IF p.status<>'PickedUp' OR l.status<>'PickedUp' THEN RAISE EXCEPTION 'ACTION_NOT_ALLOWED'; END IF;
      UPDATE public.pickups SET status='Delivered',delivery_time=moment,ended_at=moment WHERE claim_id=c.claim_id AND pickup_id=p.pickup_id RETURNING * INTO p;
      UPDATE public.claims SET status='Completed',ended_at=moment WHERE claim_id=c.claim_id;
      UPDATE public.food_listings SET status='Delivered' WHERE listing_id=l.listing_id;
    END IF;
    ref_id:=p.pickup_id; event_table:='pickups'; event_action:=operation; notice:='A collection or delivery status has changed.';
    result:=jsonb_build_object('claim_id',c.claim_id,'pickup_id',p.pickup_id,'status',p.status);
  ELSIF operation='rating.create' THEN
    IF c.status<>'Completed' THEN RAISE EXCEPTION 'DELIVERY_REQUIRED'; END IF;
    rid:=(body->>'target_user_id')::bigint;
    IF rid<>(CASE WHEN actor=l.donor_id THEN c.receiver_id ELSE l.donor_id END) THEN RAISE EXCEPTION 'INVALID_RATING_TARGET'; END IF;
    IF EXISTS(SELECT FROM public.ratings WHERE claim_id=c.claim_id AND rater_id=actor AND target_user_id=rid) THEN RAISE EXCEPTION 'ALREADY_RATED'; END IF;
    INSERT INTO public.ratings(claim_id,rater_id,target_user_id,score,comments) VALUES(c.claim_id,actor,rid,(body->>'score')::smallint,body->>'comments') RETURNING rating_id INTO ref_id;
    event_table:='ratings'; event_action:=operation; notice:='A completed exchange received a rating.';
    affected:=ARRAY[l.donor_id,c.receiver_id]; result:=jsonb_build_object('rating_id',ref_id,'claim_id',c.claim_id);
  ELSE
    IF EXISTS(SELECT FROM public.notifications WHERE notification_id=object_id AND user_id=actor AND read_at IS NULL) THEN
      UPDATE public.notifications SET read_at=moment WHERE notification_id=object_id AND user_id=actor;
      ref_id:=object_id; event_table:='notifications'; event_action:=operation;
    END IF;
    result:=jsonb_build_object('notification_id',ref_id,'read',true);
  END IF;
  IF event_action IS NOT NULL THEN
    PERFORM public.dbthon_record_event(affected,event_action,event_table,ref_id,c.claim_id,
      jsonb_strip_nulls(jsonb_build_object('listing_id',l.listing_id,'claim_id',c.claim_id,'pickup_id',p.pickup_id,
        'rating_id',CASE WHEN operation='rating.create' THEN ref_id END)),moment);
    IF notice IS NOT NULL THEN PERFORM public.dbthon_notify(affected,op_key||':'||request_key,'StatusUpdate',notice); END IF;
  END IF;
  result:=jsonb_build_object('data',result);
  INSERT INTO public.idempotency_keys(actor_id,operation,key,request_hash,response_status,response_body,created_at,expires_at)
    VALUES(actor,op_key,request_key,fingerprint,CASE WHEN operation IN ('listing.create','claim.create','pickup.accept','rating.create') THEN 201 ELSE 200 END,result,moment,moment+interval '24 hours');
  RETURN result;
END $$;

CREATE FUNCTION dbthon_due_listings(batch_size integer DEFAULT 100) RETURNS SETOF bigint
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT l.listing_id FROM public.food_listings l WHERE l.status IN ('Available','Claimed','PickedUp') AND (
    l.expiry_window_end<=clock_timestamp() OR EXISTS(SELECT FROM public.claims c JOIN public.pickups p USING(claim_id)
      WHERE c.listing_id=l.listing_id AND c.status='Confirmed' AND p.status='Scheduled'
        AND p.scheduled_time+interval '15 minutes'<=clock_timestamp()))
  ORDER BY l.expiry_window_end,l.listing_id LIMIT least(greatest(batch_size,1),100);
$$;

CREATE FUNCTION dbthon_expire_one(wanted_listing bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE l public.food_listings%ROWTYPE; c public.claims%ROWTYPE; p public.pickups%ROWTYPE;
  affected bigint[]; moment timestamptz; changed boolean:=false;
BEGIN
  SELECT * INTO l FROM public.food_listings WHERE listing_id=wanted_listing FOR UPDATE;
  IF NOT FOUND OR l.status NOT IN ('Available','Claimed','PickedUp') THEN RETURN false; END IF;
  SELECT * INTO c FROM public.claims WHERE listing_id=l.listing_id AND status='Confirmed' FOR UPDATE;
  SELECT * INTO p FROM public.pickups WHERE claim_id=c.claim_id AND status IN ('Scheduled','PickedUp') FOR UPDATE;
  affected:=array_remove(ARRAY[l.donor_id,c.receiver_id,p.volunteer_id],NULL);
  PERFORM user_id FROM public.users WHERE user_id=ANY(affected) ORDER BY user_id FOR UPDATE;
  moment:=clock_timestamp();
  IF l.expiry_window_end<=moment THEN
    IF p.pickup_id IS NOT NULL THEN UPDATE public.pickups SET status=CASE WHEN p.status='PickedUp' THEN 'Failed' ELSE 'Missed' END,
      reason='Donor-provided deadline passed',ended_at=moment WHERE claim_id=p.claim_id AND pickup_id=p.pickup_id; END IF;
    IF c.claim_id IS NOT NULL THEN UPDATE public.claims SET status='Expired',ended_at=moment WHERE claim_id=c.claim_id; END IF;
    UPDATE public.food_listings SET status='Expired' WHERE listing_id=l.listing_id; changed:=true;
  ELSIF p.status='Scheduled' AND p.scheduled_time+interval '15 minutes'<=moment THEN
    UPDATE public.pickups SET status='Missed',reason='Collection grace period passed',ended_at=moment WHERE claim_id=p.claim_id AND pickup_id=p.pickup_id; changed:=true;
  END IF;
  IF changed THEN
    PERFORM public.dbthon_record_event(affected,'expiry.processed','food_listings',l.listing_id,c.claim_id,
      jsonb_build_object('listing_id',l.listing_id,'expired',l.expiry_window_end<=moment,'pickup_id',p.pickup_id),moment);
    PERFORM public.dbthon_notify(affected,'expiry:'||l.listing_id||':'||coalesce(p.pickup_id,0)||':'||l.status,'DeadlineUpdate','A collection was missed or its donor-provided deadline passed.');
  END IF;
  RETURN changed;
END $$;

CREATE FUNCTION dbthon_lease_notifications(batch_size integer DEFAULT 100) RETURNS TABLE(outbox_id bigint,lease_token uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  WITH abandoned AS (UPDATE public.notification_outbox SET status='Failed',locked_until=NULL,lease_token=NULL,last_error='In-app delivery lease expired'
    WHERE channel='InApp' AND status='Processing' AND attempts>=5 AND locked_until<=clock_timestamp() RETURNING outbox_id),
  ready AS (SELECT o.outbox_id FROM public.notification_outbox o WHERE o.channel='InApp' AND o.attempts<5 AND
    ((o.status='Pending' AND o.next_attempt_at<=clock_timestamp()) OR (o.status='Processing' AND o.locked_until<=clock_timestamp()))
    ORDER BY o.outbox_id FOR UPDATE SKIP LOCKED LIMIT least(greatest(batch_size,1),100))
  UPDATE public.notification_outbox o SET status='Processing',attempts=o.attempts+1,locked_until=clock_timestamp()+interval '30 seconds',lease_token=public.gen_random_uuid()
    FROM ready WHERE o.outbox_id=ready.outbox_id RETURNING o.outbox_id,o.lease_token;
$$;
CREATE FUNCTION dbthon_finish_notification(wanted_id bigint,token uuid,success boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE o public.notification_outbox%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.notification_outbox WHERE outbox_id=wanted_id AND lease_token=token AND status='Processing'
    AND locked_until>clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF success THEN
    UPDATE public.notifications SET sent_at=coalesce(sent_at,clock_timestamp()) WHERE notification_id=o.notification_id;
    UPDATE public.notification_outbox SET status='Sent',locked_until=NULL,lease_token=NULL,last_error=NULL WHERE outbox_id=wanted_id;
  ELSE
    UPDATE public.notification_outbox SET status=CASE WHEN attempts>=5 THEN 'Failed' ELSE 'Pending' END,
      next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)),
      locked_until=NULL,lease_token=NULL,last_error='In-app delivery failed' WHERE outbox_id=wanted_id;
  END IF;
  RETURN true;
END $$;

-- Safe scoped participant/reputation projection; private contacts never enter feeds.
CREATE FUNCTION dbthon_trust(wanted_user bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE u public.users%ROWTYPE; result jsonb;
BEGIN
  PERFORM public.dbthon_require_actor(false);
  SELECT * INTO u FROM public.users WHERE user_id=wanted_user AND zone_id=public.dbthon_actor_zone()
    AND (user_id=public.dbthon_actor_id() OR public.dbthon_zone_admin(zone_id) OR
      (active AND verified_status AND public.dbthon_verified_actor()));
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT jsonb_build_object('user_id',u.user_id,'name',u.name,'rating_count',count(*),
    'average_score',round(avg(score),2)::text) INTO result FROM public.ratings WHERE target_user_id=wanted_user;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION dbthon_command(text,bigint,bigint,jsonb,text),dbthon_due_listings(integer),dbthon_expire_one(bigint),
  dbthon_lease_notifications(integer),dbthon_finish_notification(bigint,uuid,boolean),dbthon_trust(bigint) FROM PUBLIC;
ALTER FUNCTION dbthon_command(text,bigint,bigint,jsonb,text) OWNER TO dbthon_guard;
ALTER FUNCTION dbthon_due_listings(integer) OWNER TO dbthon_guard;
ALTER FUNCTION dbthon_expire_one(bigint) OWNER TO dbthon_guard;
ALTER FUNCTION dbthon_lease_notifications(integer) OWNER TO dbthon_guard;
ALTER FUNCTION dbthon_finish_notification(bigint,uuid,boolean) OWNER TO dbthon_guard;
ALTER FUNCTION dbthon_trust(bigint) OWNER TO dbthon_guard;
GRANT EXECUTE ON FUNCTION dbthon_command(text,bigint,bigint,jsonb,text),dbthon_trust(bigint) TO dbthon_runtime;
GRANT EXECUTE ON FUNCTION dbthon_due_listings(integer),dbthon_expire_one(bigint),dbthon_lease_notifications(integer),
  dbthon_finish_notification(bigint,uuid,boolean) TO dbthon_worker;
