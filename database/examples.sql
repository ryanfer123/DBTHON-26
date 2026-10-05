-- Run after migration/seed as the local migration owner, or in an authenticated
-- runtime transaction. Under runtime RLS, results remain scoped to the actor.

-- JOIN: complete claim-to-delivery history, including missed/replacement attempts.
SELECT c.claim_id,l.food_type,c.status AS claim_status,
  p.pickup_id,p.status AS pickup_status,p.actual_pickup_time,p.delivery_time
FROM claims c JOIN food_listings l USING(listing_id)
LEFT JOIN pickups p USING(claim_id) ORDER BY c.claim_id,p.pickup_id;

-- Nested query: receivers with at least one delivered claim.
SELECT u.user_id,u.name FROM users u WHERE EXISTS (
  SELECT FROM claims c JOIN pickups p USING(claim_id)
  WHERE c.receiver_id=u.user_id AND c.status='Completed' AND p.status='Delivered'
) ORDER BY u.user_id;

-- Aggregate + HAVING: ratings count and average; never call unrated users zero-rated.
SELECT target_user_id,count(*) AS rating_count,avg(score)::numeric(4,2) AS average_score
FROM ratings GROUP BY target_user_id HAVING count(*)>=1 ORDER BY target_user_id;

-- LEFT JOIN/preaggregation: attempts never multiply impact; zero zones remain.
SELECT zone_id,zone_name,picked_up_kg,delivered_kg,estimated_meals
FROM zone_impact_summary ORDER BY zone_id;

-- UTC half-open range query. Quantity contributes once per delivered listing.
-- Replace these dates with the chosen fixture anchor range for deterministic demos.
WITH delivered AS (
  SELECT DISTINCT c.listing_id FROM claims c JOIN pickups p USING(claim_id)
  WHERE p.status='Delivered' AND p.delivery_time>='2026-10-05T00:00:00Z'::timestamptz
    AND p.delivery_time<'2026-10-06T00:00:00Z'::timestamptz
)
SELECT z.zone_id,z.city,coalesce(sum(l.quantity_kg) FILTER(WHERE d.listing_id IS NOT NULL),0)
  AS delivered_kg FROM zones z LEFT JOIN food_listings l USING(zone_id)
LEFT JOIN delivered d USING(listing_id) GROUP BY z.zone_id,z.city ORDER BY z.zone_id;

-- Geo-temporal candidates (receiver 102, default 5 km, urgency/distance ordering).
-- RLS/SQL routine independently guards allocation; a feed read reserves nothing.
EXPLAIN (ANALYZE,BUFFERS)
SELECT l.listing_id,l.food_type,l.quantity_kg,
  ST_Distance(l.pickup_location,ST_SetSRID(ST_MakePoint(u.longitude::float8,
    u.latitude::float8),4326)::geography) AS distance_m
FROM food_listings l JOIN users u ON u.user_id=102
JOIN receiver_profiles rp ON rp.user_id=u.user_id
WHERE l.zone_id=u.zone_id AND l.status='Available' AND l.donor_id<>u.user_id
  AND l.expiry_window_start<=clock_timestamp() AND l.expiry_window_end>clock_timestamp()
  AND l.quantity_kg<=rp.capacity_kg AND EXISTS (
    SELECT FROM users donor JOIN user_roles roles USING(user_id)
    WHERE donor.user_id=l.donor_id AND donor.active AND donor.verified_status
      AND roles.role='Donor' AND roles.approved_at IS NOT NULL)
  AND ST_DWithin(l.pickup_location,ST_SetSRID(ST_MakePoint(u.longitude::float8,
    u.latitude::float8),4326)::geography,5000)
ORDER BY l.expiry_window_end,distance_m,l.listing_id;

-- Transaction example for an authenticated, server-supplied session hash:
-- BEGIN;
-- SET LOCAL ROLE dbthon_runtime;
-- SELECT set_config('app.session_hash', :validated_session_hash, true);
-- SELECT dbthon_claim_listing(:listing_id);
-- COMMIT;
-- ROLLBACK undoes domain + ledger + outbox together. Do not set raw actor/zone IDs.
