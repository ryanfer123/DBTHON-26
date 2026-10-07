-- Donor declarations: legacy rows remain explicitly undeclared.
ALTER TABLE food_listings ADD COLUMN storage_handling text CHECK(storage_handling IN ('Hot','Cold','Ambient')),
 ADD COLUMN packed boolean, ADD COLUMN allergens text[] NOT NULL DEFAULT '{}',
 ADD COLUMN diet_tags text[] NOT NULL DEFAULT '{}', ADD COLUMN safety_confirmed_at timestamptz,
 ADD CONSTRAINT listing_allergens CHECK(allergens <@ ARRAY['milk','eggs','fish','shellfish','tree-nuts','peanuts','wheat','soy','sesame','other']::text[]),
 ADD CONSTRAINT listing_diets CHECK(diet_tags <@ ARRAY['halal','jain','nut-free']::text[]),
 ADD CONSTRAINT listing_nut_claim CHECK(NOT ('nut-free'=ANY(diet_tags) AND allergens && ARRAY['peanuts','tree-nuts']::text[]));
CREATE INDEX ix_listing_diets ON food_listings USING gin(diet_tags);
CREATE INDEX ix_listing_allergens ON food_listings USING gin(allergens);

-- Preserve guarded locking, full-body idempotency and atomic audit/outbox.
CREATE OR REPLACE FUNCTION dbthon_command_0005(operation text, object_id bigint, attempt_id bigint,
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
    ARRAY['food_type','category','quantity_kg','prepared_at','expiry_window_start','expiry_window_end','pickup_lat','pickup_long','storage_handling','packed','allergens','diet_tags']
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
        'pickup_lat',l.pickup_lat,'pickup_long',l.pickup_long,'storage_handling',l.storage_handling,
        'packed',l.packed,'allergens',to_jsonb(l.allergens),'diet_tags',to_jsonb(l.diet_tags))||body;
    END IF;
    IF (body->>'prepared_at')::timestamptz>moment OR (body->>'expiry_window_end')::timestamptz<=moment
      OR (body->>'expiry_window_end')::timestamptz>moment+interval '7 days' THEN RAISE EXCEPTION 'INVALID_WINDOW'; END IF;
    IF operation='listing.create' THEN
      INSERT INTO public.food_listings(donor_id,zone_id,food_type,category,quantity_kg,prepared_at,
        expiry_window_start,expiry_window_end,pickup_lat,pickup_long,storage_handling,packed,allergens,diet_tags,safety_confirmed_at)
      VALUES(actor,public.dbthon_actor_zone(),trim(body->>'food_type'),body->>'category',(body->>'quantity_kg')::numeric,
        (body->>'prepared_at')::timestamptz,(body->>'expiry_window_start')::timestamptz,
        (body->>'expiry_window_end')::timestamptz,(body->>'pickup_lat')::numeric,(body->>'pickup_long')::numeric,body->>'storage_handling',(body->>'packed')::boolean,
        ARRAY(SELECT jsonb_array_elements_text(coalesce(body->'allergens','[]'))),
        ARRAY(SELECT jsonb_array_elements_text(coalesce(body->'diet_tags','[]'))),
        CASE WHEN body->>'storage_handling' IS NOT NULL THEN moment END)
      RETURNING * INTO l;
    ELSE
      UPDATE public.food_listings SET food_type=trim(body->>'food_type'),category=body->>'category',quantity_kg=(body->>'quantity_kg')::numeric,
        prepared_at=(body->>'prepared_at')::timestamptz,expiry_window_start=(body->>'expiry_window_start')::timestamptz,
        expiry_window_end=(body->>'expiry_window_end')::timestamptz,pickup_lat=(body->>'pickup_lat')::numeric,
        pickup_long=(body->>'pickup_long')::numeric,storage_handling=body->>'storage_handling',packed=(body->>'packed')::boolean,
        allergens=ARRAY(SELECT jsonb_array_elements_text(coalesce(body->'allergens','[]'))),
        diet_tags=ARRAY(SELECT jsonb_array_elements_text(coalesce(body->'diet_tags','[]'))),
        safety_confirmed_at=CASE WHEN body->>'storage_handling' IS NOT NULL THEN moment END WHERE listing_id=l.listing_id RETURNING * INTO l;
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

CREATE TABLE donor_schedules (
 schedule_id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
 donor_id bigint NOT NULL REFERENCES users, template_listing_id bigint NOT NULL REFERENCES food_listings,
 local_time time NOT NULL, time_zone text NOT NULL, enabled boolean NOT NULL DEFAULT true,
 next_due_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(donor_id,template_listing_id)
);
CREATE INDEX ix_donor_schedules_due ON donor_schedules(next_due_at) WHERE enabled;
GRANT SELECT ON donor_schedules TO dbthon_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON donor_schedules TO dbthon_guard;
GRANT USAGE,SELECT ON SEQUENCE donor_schedules_schedule_id_seq TO dbthon_guard;
ALTER TABLE donor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_schedules FORCE ROW LEVEL SECURITY;
CREATE POLICY guard_scope ON donor_schedules TO dbthon_guard USING(true) WITH CHECK(true);
CREATE POLICY schedule_scope ON donor_schedules FOR SELECT TO dbthon_runtime USING(donor_id=dbthon_actor_id());

CREATE FUNCTION dbthon_save_donor_schedule(wanted_listing bigint,wanted_time time,wanted_zone text,wants_enabled boolean)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor bigint; due timestamptz; result bigint;
BEGIN
 actor:=public.dbthon_require_actor(true);
 IF NOT public.dbthon_has_role('Donor') THEN RAISE EXCEPTION 'VERIFICATION_REQUIRED'; END IF;
 PERFORM FROM public.food_listings WHERE listing_id=wanted_listing AND donor_id=actor AND zone_id=public.dbthon_actor_zone() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF wanted_time IS NULL OR NOT EXISTS(SELECT FROM pg_timezone_names WHERE name=wanted_zone) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 PERFORM FROM public.users WHERE user_id=actor FOR UPDATE;
 PERFORM public.dbthon_require_actor(true);
 IF NOT public.dbthon_has_role('Donor') THEN RAISE EXCEPTION 'VERIFICATION_REQUIRED'; END IF;
 IF (SELECT count(*) FROM public.donor_schedules WHERE donor_id=actor)>=10 AND NOT EXISTS(
 SELECT FROM public.donor_schedules WHERE donor_id=actor AND template_listing_id=wanted_listing) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 due:=((clock_timestamp() AT TIME ZONE wanted_zone)::date+wanted_time) AT TIME ZONE wanted_zone;
 IF due<=clock_timestamp() THEN due:=(((clock_timestamp() AT TIME ZONE wanted_zone)::date+1)+wanted_time) AT TIME ZONE wanted_zone; END IF;
 INSERT INTO public.donor_schedules(donor_id,template_listing_id,local_time,time_zone,enabled,next_due_at)
 VALUES(actor,wanted_listing,wanted_time,wanted_zone,wants_enabled,due)
 ON CONFLICT(donor_id,template_listing_id) DO UPDATE SET local_time=excluded.local_time,time_zone=excluded.time_zone,
 enabled=excluded.enabled,next_due_at=excluded.next_due_at,updated_at=clock_timestamp() RETURNING schedule_id INTO result;
 PERFORM public.dbthon_record_event(ARRAY[actor],'donation.schedule_saved','donor_schedules',result,NULL,
 jsonb_build_object('local_time',wanted_time,'time_zone',wanted_zone,'enabled',wants_enabled));
 RETURN result;
END $$;

CREATE FUNCTION dbthon_due_donor_schedule_ids() RETURNS SETOF bigint
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT schedule_id FROM public.donor_schedules WHERE enabled AND next_due_at<=clock_timestamp()
 ORDER BY next_due_at LIMIT 10;
$$;
CREATE FUNCTION dbthon_remind_donor_schedule(wanted_id bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s public.donor_schedules%ROWTYPE; due timestamptz; eligible boolean;
BEGIN
 SELECT * INTO s FROM public.donor_schedules WHERE schedule_id=wanted_id;
 IF NOT FOUND THEN RETURN false; END IF;
 -- Serialize with donor edits through the template listing before schedule/user locks.
 PERFORM FROM public.food_listings WHERE listing_id=s.template_listing_id FOR UPDATE;
 SELECT * INTO s FROM public.donor_schedules WHERE schedule_id=wanted_id AND enabled
 AND next_due_at<=clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM FROM public.users WHERE user_id=s.donor_id FOR UPDATE;
 SELECT EXISTS(SELECT FROM public.users u JOIN public.user_roles r USING(user_id)
 JOIN public.food_listings l ON l.listing_id=s.template_listing_id AND l.zone_id=u.zone_id
 WHERE u.user_id=s.donor_id AND u.active AND u.verified_status AND r.role='Donor'
 AND r.approved_at IS NOT NULL) INTO eligible;
 IF eligible THEN
   PERFORM public.dbthon_notify(ARRAY[s.donor_id],'donor-schedule:'||s.schedule_id||':'||s.next_due_at,
   'DonationReminder','Your scheduled donation is due. Open recurring donations to confirm today''s surplus and publish.');
   PERFORM public.dbthon_record_event(ARRAY[s.donor_id],'donation.reminder_due','donor_schedules',s.schedule_id,NULL,
   jsonb_build_object('due_at',s.next_due_at,'template_listing_id',s.template_listing_id));
 END IF;
 due:=((clock_timestamp() AT TIME ZONE s.time_zone)::date+s.local_time) AT TIME ZONE s.time_zone;
 IF due<=clock_timestamp() THEN due:=(((clock_timestamp() AT TIME ZONE s.time_zone)::date+1)+s.local_time) AT TIME ZONE s.time_zone; END IF;
 UPDATE public.donor_schedules SET next_due_at=due WHERE schedule_id=s.schedule_id;
 RETURN eligible;
END $$;
ALTER FUNCTION dbthon_save_donor_schedule(bigint,time,text,boolean) OWNER TO dbthon_guard;
ALTER FUNCTION dbthon_due_donor_schedule_ids() OWNER TO dbthon_guard;
ALTER FUNCTION dbthon_remind_donor_schedule(bigint) OWNER TO dbthon_guard;
REVOKE ALL ON FUNCTION dbthon_save_donor_schedule(bigint,time,text,boolean),dbthon_due_donor_schedule_ids(),dbthon_remind_donor_schedule(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dbthon_save_donor_schedule(bigint,time,text,boolean) TO dbthon_runtime;
GRANT EXECUTE ON FUNCTION dbthon_due_donor_schedule_ids(),dbthon_remind_donor_schedule(bigint) TO dbthon_worker;
