-- Small authenticated thumbnails; no object storage or public photo URLs.
CREATE TABLE listing_photos (
  listing_id bigint PRIMARY KEY REFERENCES food_listings ON DELETE CASCADE,
  thumbnail bytea NOT NULL CHECK (octet_length(thumbnail) BETWEEN 1 AND 153600),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE listing_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_photos FORCE ROW LEVEL SECURITY;
CREATE POLICY photo_read ON listing_photos FOR SELECT TO dbthon_runtime
  USING (EXISTS (SELECT FROM food_listings l WHERE l.listing_id=listing_photos.listing_id
    AND l.zone_id=dbthon_actor_zone() AND dbthon_verified_actor()));
CREATE POLICY guard_scope ON listing_photos TO dbthon_guard USING (true) WITH CHECK (true);
GRANT SELECT ON listing_photos TO dbthon_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON listing_photos TO dbthon_guard;
GRANT CREATE ON SCHEMA public TO dbthon_guard;

CREATE FUNCTION dbthon_set_listing_photo(wanted_listing bigint, image bytea, request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor bigint; l public.food_listings%ROWTYPE; affected bigint[]; moment timestamptz;
  fingerprint text; op_key text; cached public.idempotency_keys%ROWTYPE; result jsonb;
BEGIN
  actor:=public.dbthon_require_actor(true);
  IF request_key IS NULL OR length(request_key) NOT BETWEEN 8 AND 128
    OR request_key !~ '^[A-Za-z0-9_.:-]+$' OR (image IS NOT NULL AND octet_length(image) NOT BETWEEN 1 AND 153600)
    THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  op_key:='photo.update:'||wanted_listing;
  fingerprint:=encode(public.digest(coalesce(image,convert_to('remove','UTF8')),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(actor||':'||op_key||':'||request_key,0));
  SELECT * INTO l FROM public.food_listings WHERE listing_id=wanted_listing AND zone_id=public.dbthon_actor_zone() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  affected:=ARRAY[actor,l.donor_id];
  PERFORM user_id FROM public.users WHERE user_id=ANY(affected) ORDER BY user_id FOR UPDATE;
  PERFORM public.dbthon_require_actor(true);
  moment:=clock_timestamp();
  IF NOT ((l.donor_id=actor AND public.dbthon_has_role('Donor')) OR
    (image IS NULL AND public.dbthon_zone_admin(l.zone_id))) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO cached FROM public.idempotency_keys WHERE actor_id=actor AND operation=op_key AND key=request_key;
  IF FOUND THEN
    IF cached.request_hash<>fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    RETURN cached.response_body;
  END IF;
  IF NOT (image IS NULL AND public.dbthon_zone_admin(l.zone_id)) AND
    (l.status<>'Available' OR l.expiry_window_end<=moment) THEN RAISE EXCEPTION 'LISTING_UNAVAILABLE'; END IF;
  IF image IS NULL THEN DELETE FROM public.listing_photos WHERE listing_id=wanted_listing;
  ELSE INSERT INTO public.listing_photos(listing_id,thumbnail,updated_at) VALUES(wanted_listing,image,moment)
    ON CONFLICT(listing_id) DO UPDATE SET thumbnail=excluded.thumbnail,updated_at=excluded.updated_at;
  END IF;
  PERFORM public.dbthon_record_event(affected,CASE WHEN image IS NULL THEN 'photo.removed' ELSE 'photo.updated' END,
    'food_listings',wanted_listing,NULL,jsonb_build_object('photo_present',image IS NOT NULL),moment);
  PERFORM public.dbthon_notify(affected,op_key||':'||request_key,'StatusUpdate',
    CASE WHEN image IS NULL THEN 'A listing photo was removed.' ELSE 'A listing photo was updated.' END);
  result:=jsonb_build_object('data',jsonb_build_object('listing_id',wanted_listing,'status',l.status));
  INSERT INTO public.idempotency_keys(actor_id,operation,key,request_hash,response_status,response_body,created_at,expires_at)
    VALUES(actor,op_key,request_key,fingerprint,200,result,moment,moment+interval '24 hours');
  RETURN result;
END $$;
ALTER FUNCTION dbthon_set_listing_photo(bigint,bytea,text) OWNER TO dbthon_guard;
REVOKE ALL ON FUNCTION dbthon_set_listing_photo(bigint,bytea,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dbthon_set_listing_photo(bigint,bytea,text) TO dbthon_runtime;

-- Only aggregate, non-identifying prototype totals cross the public boundary.
CREATE FUNCTION dbthon_public_impact() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  WITH bounds AS (SELECT clock_timestamp() AS now,
    date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS begins),
  mass AS (SELECT l.listing_id,l.quantity_kg,min(p.delivery_time) FILTER(WHERE p.status='Delivered') AS delivered
    FROM public.food_listings l JOIN public.claims c USING(listing_id)
    JOIN public.pickups p USING(claim_id) GROUP BY l.listing_id,l.quantity_kg),
  totals AS (SELECT coalesce(sum(quantity_kg),0) AS kg FROM mass,bounds WHERE delivered>=begins AND delivered<=now)
  SELECT jsonb_build_object('delivered_kg',round(totals.kg,2)::text,'estimated_meals',round(totals.kg/0.4,1)::text,
    'active_listings',(SELECT count(*) FROM public.food_listings l WHERE l.status='Available'
      AND l.expiry_window_start<=bounds.now AND l.expiry_window_end>bounds.now
      AND EXISTS(SELECT FROM public.users u JOIN public.user_roles r USING(user_id)
        WHERE u.user_id=l.donor_id AND u.active AND u.verified_status AND r.role='Donor' AND r.approved_at IS NOT NULL)),
    'includes_demo_data',EXISTS(SELECT FROM public.seed_runs),
    'month_start',bounds.begins,'server_time',bounds.now,'meal_weight_kg','0.4') FROM totals,bounds;
$$;
ALTER FUNCTION dbthon_public_impact() OWNER TO dbthon_guard;
REVOKE ALL ON FUNCTION dbthon_public_impact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dbthon_public_impact() TO dbthon_auth;
REVOKE CREATE ON SCHEMA public FROM dbthon_guard;
