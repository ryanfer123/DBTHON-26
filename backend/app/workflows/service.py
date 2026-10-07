import base64
import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import Connection, text

from app.core.errors import DomainError
from app.identity.models import Input
from app.workflows.models import (
    CommandResponse,
    Exchange,
    ImpactResponse,
    ImpactRow,
    ImpactSummary,
    Listing,
    Meta,
    Notification,
    OverviewData,
    OverviewItem,
    OverviewResponse,
    PhotoInput,
)
from app.workflows.photos import normalize


def require(connection: Connection, role: str | None = None) -> int:
    uid = int(connection.execute(text("SELECT dbthon_require_actor(false)")).scalar_one())
    permitted = connection.execute(
        text("SELECT dbthon_has_role(:role)" if role else "SELECT dbthon_verified_actor()"),
        {"role": role},
    ).scalar_one()
    if not permitted:
        raise DomainError("VERIFICATION_REQUIRED", 403, "An approved community role is required.")
    return uid


def clock(connection: Connection) -> datetime:
    value: datetime = connection.execute(text("SELECT clock_timestamp()")).scalar_one()
    return value


def command(
    connection: Connection,
    operation: str,
    object_id: int | None,
    attempt_id: int | None,
    body: Input,
    key: str,
) -> CommandResponse:
    result = connection.execute(
        text("SELECT dbthon_command(:op,:object,:attempt,CAST(:body AS jsonb),:key)"),
        {
            "op": operation,
            "object": object_id,
            "attempt": attempt_id,
            "body": body.model_dump_json(exclude_unset=True, exclude={"photo_base64"}),
            "key": key,
        },
    ).scalar_one()
    if isinstance(body, PhotoInput) and "photo_base64" in body.model_fields_set:
        photo = normalize(body.photo_base64)
        connection.execute(
            text("SELECT dbthon_set_listing_photo(:id,:photo,:key)"),
            {
                "id": result["data"]["listing_id"],
                "photo": photo,
                "key": key,
            },
        ).scalar_one()
    return CommandResponse.model_validate(result)


DONOR_READY = """EXISTS(SELECT FROM users donor JOIN user_roles dr USING(user_id)
  WHERE donor.user_id=l.donor_id AND donor.active AND donor.verified_status AND
      dr.role='Donor' AND dr.approved_at IS NOT NULL)"""
PROFILE_POINT = """(SELECT ST_SetSRID(
  ST_MakePoint(longitude::float8,latitude::float8),4326)::geography
  FROM users WHERE user_id=dbthon_actor_id())"""
LISTING_COLUMNS = """
  l.listing_id,l.donor_id,coalesce(u.name,'Donor unavailable') AS donor_name,l.zone_id,
  l.food_type,l.category,l.quantity_kg::text,l.prepared_at,l.expiry_window_start,l.expiry_window_end,
  l.pickup_lat::text,l.pickup_long::text,l.status,l.created_at,l.updated_at,
  greatest(0,floor(extract(epoch FROM l.expiry_window_end-CAST(:now AS
      timestamptz))))::integer AS seconds_remaining,
  (l.expiry_window_end>CAST(:now AS timestamptz) AND l.expiry_window_end<=CAST(:now AS
      timestamptz)+interval '30 minutes') AS approaching_expiry"""
CAPACITY_FITS = """l.quantity_kg <= (SELECT capacity_kg FROM receiver_profiles
  WHERE user_id=dbthon_actor_id())"""
CLAIM_REASON = f"""CASE
  WHEN NOT dbthon_has_role('Receiver') THEN 'An approved Receiver role is required.'
  WHEN l.donor_id=dbthon_actor_id() THEN 'You cannot claim your own donation.'
  WHEN l.status<>'Available' OR l.expiry_window_end<=:now THEN 'This food is no longer available.'
  WHEN l.expiry_window_start>:now THEN 'Collection has not opened yet.'
  WHEN NOT ({DONOR_READY}) THEN 'The donor is not currently verified.'
  WHEN NOT coalesce(({CAPACITY_FITS}),false) THEN 'Above your receiving capacity. Update your
      account capacity to receive this whole quantity.'
  WHEN NOT ST_DWithin(l.pickup_location,{PROFILE_POINT},5000) THEN 'Outside the 5 km
      allocation distance from your saved location.'
  ELSE NULL END"""
LISTING_COLUMNS += f""", EXISTS(SELECT FROM listing_photos photo WHERE
photo.listing_id=l.listing_id) AS has_photo, ({DONOR_READY}) AS donor_verified,
  CASE WHEN {DONOR_READY} THEN (dbthon_trust(l.donor_id)->>'average_score') ELSE NULL END AS
      donor_rating_avg,
  CASE WHEN {DONOR_READY} THEN
      coalesce((dbthon_trust(l.donor_id)->>'rating_count')::integer,0) ELSE 0 END AS
      donor_rating_count,
  ({CLAIM_REASON}) IS NULL AS claim_eligible, ({CLAIM_REASON}) AS claim_ineligible_reason"""
FEED_FILTER = f"""l.zone_id=dbthon_actor_zone() AND l.status='Available'
  AND l.expiry_window_start<=:now AND l.expiry_window_end>:now
  AND l.donor_id<>dbthon_actor_id()
  AND {DONOR_READY} AND ST_DWithin(l.pickup_location,{PROFILE_POINT},5000)
  AND ST_DWithin(l.pickup_location,
    ST_SetSRID(ST_MakePoint(:longitude,:latitude),4326)::geography,:radius)
  AND (CAST(:category AS text) IS NULL OR l.category=:category)"""


def feed(
    connection: Connection,
    latitude: float | None,
    longitude: float | None,
    radius: int,
    category: str | None,
    cursor: str | None,
    limit: int,
    q: str | None = None,
    include_over_capacity: bool = False,
) -> tuple[list[Listing], Meta]:
    require(connection, "Receiver")
    profile = connection.execute(
        text("SELECT latitude,longitude FROM users WHERE user_id=dbthon_actor_id()")
    ).one()
    lat = latitude if latitude is not None else float(profile.latitude)
    lon = longitude if longitude is not None else float(profile.longitude)
    now = clock(connection)
    search = (q or "").strip().lower()
    scope = [lat, lon, radius, category, search, include_over_capacity]
    after_time, after_distance, after_id = datetime.min.replace(tzinfo=UTC), -1.0, 0
    if cursor:
        try:
            value = json.loads(base64.urlsafe_b64decode(cursor))
            if value["scope"] != scope:
                raise ValueError("Cursor filters changed")
            after_time = datetime.fromisoformat(value["time"])
            after_distance, after_id = float(value["distance"]), int(value["id"])
            if after_time.tzinfo is None or not 0 <= after_distance <= 50000 or after_id < 1:
                raise ValueError("Invalid cursor")
        except (ValueError, KeyError, TypeError, OverflowError) as error:
            raise DomainError(
                "INVALID_CURSOR", 422, "Refresh the feed with the current filters."
            ) from error
    query = f"""WITH eligible AS (
      SELECT {LISTING_COLUMNS},ST_Distance(l.pickup_location,
        ST_SetSRID(ST_MakePoint(:longitude,:latitude),4326)::geography) AS distance_m
      FROM food_listings l LEFT JOIN users u ON u.user_id=l.donor_id WHERE {FEED_FILTER}
        AND (:include_over_capacity OR {CAPACITY_FITS})
        AND l.food_type ILIKE :search ESCAPE '\\'
    ) SELECT * FROM eligible WHERE (expiry_window_end,distance_m,listing_id)>
      (:after_time,:after_distance,:after_id)
      ORDER BY expiry_window_end,distance_m,listing_id LIMIT :limit"""
    rows = (
        connection.execute(
            text(query),
            {
                "include_over_capacity": include_over_capacity,
                "now": now,
                "latitude": lat,
                "longitude": lon,
                "radius": radius,
                "category": category,
                "search": search_pattern(search),
                "after_time": after_time,
                "after_distance": after_distance,
                "after_id": after_id,
                "limit": limit + 1,
            },
        )
        .mappings()
        .all()
    )
    next_cursor = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = base64.urlsafe_b64encode(
            json.dumps(
                {
                    "scope": scope,
                    "time": last["expiry_window_end"].isoformat(),
                    "distance": last["distance_m"],
                    "id": last["listing_id"],
                },
                separators=(",", ":"),
            ).encode()
        ).decode()
    hidden = connection.execute(
        text(f"""SELECT count(*) FROM food_listings l
      WHERE {FEED_FILTER} AND NOT ({CAPACITY_FITS})
      AND l.food_type ILIKE :search ESCAPE '\\'"""),
        {
            "now": now,
            "latitude": lat,
            "longitude": lon,
            "radius": radius,
            "category": category,
            "search": search_pattern(search),
        },
    ).scalar_one()
    return [Listing.model_validate(row) for row in rows[:limit]], Meta(
        server_time=now, next_cursor=next_cursor, hidden_over_capacity_count=hidden
    )


def listings_mine(
    connection: Connection, status: str | None, cursor: int, limit: int, q: str | None = None
) -> tuple[list[Listing], Meta]:
    uid = require(connection, "Donor")
    now = clock(connection)
    rows = (
        connection.execute(
            text(f"""SELECT {LISTING_COLUMNS} FROM food_listings l
      LEFT JOIN users u ON u.user_id=l.donor_id WHERE l.donor_id=:uid AND l.listing_id>:cursor
      AND NOT EXISTS(
        SELECT FROM hidden_listings h WHERE h.user_id=:uid AND h.listing_id=l.listing_id)
      AND (CAST(:status AS text) IS NULL OR l.status=:status)
      AND l.food_type ILIKE :search ESCAPE '\\'
      ORDER BY l.listing_id LIMIT :limit"""),
            {
                "uid": uid,
                "now": now,
                "cursor": cursor,
                "status": status,
                "limit": limit + 1,
                "search": search_pattern((q or "").strip()),
            },
        )
        .mappings()
        .all()
    )
    return [Listing.model_validate(row) for row in rows[:limit]], Meta(
        server_time=now, next_cursor=rows[limit - 1]["listing_id"] if len(rows) > limit else None
    )


def listing_detail(connection: Connection, listing_id: int) -> tuple[Listing, Meta]:
    require(connection)
    now = clock(connection)
    row = (
        connection.execute(
            text(f"""SELECT {LISTING_COLUMNS} FROM food_listings l
      LEFT JOIN users u ON u.user_id=l.donor_id
      WHERE l.listing_id=:id"""),
            {"now": now, "id": listing_id},
        )
        .mappings()
        .first()
    )
    if row is None:
        raise DomainError("NOT_FOUND", 404, "The requested food listing was not found.")
    return Listing.model_validate(row), Meta(server_time=now)


EXCHANGE_COLUMNS = """
  c.claim_id,c.listing_id,c.status,c.claimed_at,c.ended_at,c.cancellation_reason,
  l.food_type,l.category,l.quantity_kg::text,l.expiry_window_end,l.pickup_lat::text,l.pickup_long::text,
  l.donor_id,coalesce(d.name,'Community donor') AS donor_name,d.phone AS
      donor_phone,c.receiver_id,
  coalesce(r.name,'Community receiver') AS receiver_name,r.phone AS receiver_phone,
  r.latitude::text AS receiver_latitude,r.longitude::text AS receiver_longitude,
  p.pickup_id,p.volunteer_id,v.name AS volunteer_name,p.status AS pickup_status,
  p.scheduled_time,p.actual_pickup_time,p.delivery_time,
  (SELECT rating.score FROM ratings rating WHERE rating.claim_id=c.claim_id AND
      rating.rater_id=dbthon_actor_id()) AS my_rating"""
EXCHANGE_FROM = """FROM claims c JOIN food_listings l USING(listing_id)
  LEFT JOIN users d ON d.user_id=l.donor_id LEFT JOIN users r ON r.user_id=c.receiver_id
  LEFT JOIN LATERAL (SELECT * FROM pickups attempt WHERE attempt.claim_id=c.claim_id ORDER BY
      attempt.pickup_id DESC LIMIT 1) p ON true
  LEFT JOIN users v ON v.user_id=p.volunteer_id"""


def exchanges(
    connection: Connection, view: str, status: str | None, cursor: int, limit: int
) -> tuple[list[Exchange], Meta]:
    uid = require(connection, "Admin" if view == "admin" else None)
    predicate = (
        "l.zone_id=dbthon_actor_zone()"
        if view == "admin"
        else "(c.receiver_id=:uid OR l.donor_id=:uid)"
    )
    status_column = "c.status"
    rows = (
        connection.execute(
            text(f"""SELECT {EXCHANGE_COLUMNS} {EXCHANGE_FROM}
      WHERE dbthon_can_view_claim(c.claim_id) AND {predicate} AND c.claim_id>:cursor
        AND (CAST(:status AS text) IS NULL OR {status_column}=:status)
      ORDER BY c.claim_id LIMIT :limit"""),
            {"uid": uid, "cursor": cursor, "status": status, "limit": limit + 1},
        )
        .mappings()
        .all()
    )
    return [Exchange.model_validate(row) for row in rows[:limit]], Meta(
        server_time=clock(connection),
        next_cursor=rows[limit - 1]["claim_id"] if len(rows) > limit else None,
    )


def exchange_detail(connection: Connection, claim_id: int) -> Exchange:
    require(connection)
    row = (
        connection.execute(
            text(
                f"SELECT {EXCHANGE_COLUMNS} {EXCHANGE_FROM} "
                "WHERE c.claim_id=:id AND dbthon_can_view_claim(c.claim_id)"
            ),
            {"id": claim_id},
        )
        .mappings()
        .first()
    )
    if row is None:
        raise DomainError("NOT_FOUND", 404, "The requested exchange was not found.")
    return Exchange.model_validate(row)


def pickups_mine(
    connection: Connection, status: str | None, cursor: str | None, limit: int
) -> tuple[list[Exchange], Meta]:
    uid = require(connection, "Volunteer")
    claim_id, pickup_id = 0, 0
    if cursor:
        try:
            claim_id, pickup_id = map(int, cursor.split(":"))
            if claim_id < 1 or pickup_id < 1:
                raise ValueError("Invalid pickup cursor")
        except ValueError as error:
            raise DomainError(
                "INVALID_CURSOR", 422, "Refresh your deliveries to continue."
            ) from error
    source = """FROM claims c JOIN food_listings l USING(listing_id) JOIN pickups p USING(claim_id)
      LEFT JOIN users d ON d.user_id=l.donor_id LEFT JOIN users r ON r.user_id=c.receiver_id
      LEFT JOIN users v ON v.user_id=p.volunteer_id"""
    rows = (
        connection.execute(
            text(f"""SELECT {EXCHANGE_COLUMNS} {source} WHERE p.volunteer_id=:uid
      AND (p.claim_id,p.pickup_id)>(:claim,:pickup)
      AND (CAST(:status AS text) IS NULL OR p.status=:status)
      ORDER BY p.claim_id,p.pickup_id LIMIT :limit"""),
            {
                "uid": uid,
                "claim": claim_id,
                "pickup": pickup_id,
                "status": status,
                "limit": limit + 1,
            },
        )
        .mappings()
        .all()
    )
    last = rows[limit - 1] if len(rows) > limit else None
    return [Exchange.model_validate(row) for row in rows[:limit]], Meta(
        server_time=clock(connection),
        next_cursor=f"{last['claim_id']}:{last['pickup_id']}" if last else None,
    )


def impact(
    connection: Connection,
    start: datetime | None,
    end: datetime | None,
    zone_id: int | None,
    city: str | None,
    grouping: str,
) -> ImpactResponse:
    require(connection, "Admin")
    now = clock(connection)
    finish = end or now
    begin = start or finish - timedelta(days=7)
    if begin >= finish or finish - begin > timedelta(days=366):
        raise DomainError("INVALID_RANGE", 422, "Choose an ordered report range of up to 366 days.")
    zone = (
        connection.execute(text("SELECT * FROM zones WHERE zone_id=dbthon_actor_zone()"))
        .mappings()
        .one()
    )
    if (zone_id is not None and zone_id != zone["zone_id"]) or (
        city is not None and city != zone["city"]
    ):
        raise DomainError("NOT_FOUND", 404, "The requested reporting scope was not found.")
    rows = (
        connection.execute(
            text("""
      WITH visible_listings AS MATERIALIZED (
        SELECT l.* FROM food_listings l WHERE l.zone_id=:zone_id
      ), visible_claims AS MATERIALIZED (
        SELECT c.* FROM claims c JOIN visible_listings l USING(listing_id)
      ), visible_pickups AS MATERIALIZED (
        SELECT p.* FROM pickups p JOIN visible_claims c USING(claim_id)
      ), bins AS (
        SELECT CAST(:start AS timestamptz) AS begins,CAST(:end AS timestamptz) AS
      ends,'Total'::text AS period WHERE :grouping<>'day'
        UNION ALL SELECT greatest(day,CAST(:start AS timestamptz)),least(day+interval
      '1 day',CAST(:end AS timestamptz)),to_char(day AT TIME ZONE 'UTC','YYYY-MM-DD')
        FROM generate_series(date_trunc('day',CAST(:start AS timestamptz) AT TIME ZONE 'UTC')
      AT TIME ZONE 'UTC',
          date_trunc('day',(CAST(:end AS timestamptz)-interval '1 microsecond') AT TIME ZONE
      'UTC') AT TIME ZONE 'UTC',interval '1 day') day WHERE :grouping='day'
      ), mass AS (
        SELECT l.listing_id,l.quantity_kg,min(p.actual_pickup_time) AS
      picked,min(p.delivery_time) FILTER(WHERE p.status='Delivered') AS delivered
        FROM visible_listings l JOIN visible_claims c USING(listing_id)
          LEFT JOIN visible_pickups p USING(claim_id)
        WHERE l.zone_id=:zone_id GROUP BY l.listing_id,l.quantity_kg
      )
      SELECT bins.period,:zone_id AS zone_id,:zone_name AS zone_name,:city AS city,
        (SELECT count(*) FROM visible_listings l WHERE l.zone_id=:zone_id AND
      l.created_at>=begins AND l.created_at<ends) AS listings_created,
        (SELECT count(*) FROM visible_claims c JOIN visible_listings l USING(listing_id) WHERE
      l.zone_id=:zone_id AND c.claimed_at>=begins AND c.claimed_at<ends) AS
      confirmed_claims,
        (SELECT count(*) FROM visible_claims c JOIN visible_listings l USING(listing_id) WHERE
      l.zone_id=:zone_id AND c.status='Cancelled' AND c.ended_at>=begins AND
      c.ended_at<ends) AS cancelled_claims,
        (SELECT count(*) FROM visible_claims c JOIN visible_listings l USING(listing_id) WHERE
      l.zone_id=:zone_id AND c.status='Completed' AND c.ended_at>=begins AND
      c.ended_at<ends) AS completed_claims,
        coalesce((SELECT sum(quantity_kg) FROM mass WHERE picked>=begins AND
      picked<ends),0)::numeric(12,2)::text AS picked_up_kg,
        coalesce((SELECT sum(quantity_kg) FROM mass WHERE delivered>=begins AND
      delivered<ends),0)::numeric(12,2)::text AS delivered_kg,
        (coalesce((SELECT sum(quantity_kg) FROM mass WHERE delivered>=begins AND
      delivered<ends),0)/0.4)::numeric(12,2)::text AS estimated_meals,
        (SELECT count(DISTINCT donor_id) FROM visible_listings l WHERE
      l.zone_id=:zone_id AND ((l.created_at>=begins AND l.created_at<ends)
        OR (l.updated_at>=begins AND l.updated_at<ends))) AS active_donors,
        (SELECT count(DISTINCT receiver_id) FROM visible_claims c JOIN visible_listings l
      USING(listing_id) WHERE l.zone_id=:zone_id AND
        ((c.claimed_at>=begins AND c.claimed_at<ends) OR (c.ended_at>=begins AND c.ended_at<ends)
        OR EXISTS(SELECT FROM visible_pickups p WHERE p.claim_id=c.claim_id AND
          p.actual_pickup_time>=begins AND p.actual_pickup_time<ends))) AS active_receivers,
        (SELECT count(DISTINCT volunteer_id) FROM visible_pickups p
          JOIN visible_claims c USING(claim_id) JOIN
      visible_listings l USING(listing_id)
          WHERE l.zone_id=:zone_id AND ((p.accepted_at>=begins AND
      p.accepted_at<ends) OR (p.actual_pickup_time>=begins AND p.actual_pickup_time<ends) OR
      (p.delivery_time>=begins AND p.delivery_time<ends) OR
        (p.ended_at>=begins AND p.ended_at<ends))) AS active_volunteers,
        (SELECT avg(extract(epoch FROM c.claimed_at-l.created_at))::float8
          FROM visible_claims c JOIN
      visible_listings l USING(listing_id) WHERE l.zone_id=:zone_id AND
      c.claimed_at>=begins AND c.claimed_at<ends) AS claim_latency_seconds,
        (SELECT count(*) FROM visible_claims c JOIN visible_listings l USING(listing_id) WHERE
      l.zone_id=:zone_id AND c.claimed_at>=begins AND c.claimed_at<ends) AS
      claim_latency_count,
        (SELECT percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM
      c.claimed_at-l.created_at))
          FROM visible_claims c JOIN visible_listings l USING(listing_id)
          WHERE c.claimed_at>=begins AND c.claimed_at<ends) AS median_claim_latency_seconds,
        coalesce((SELECT sum(l.quantity_kg) FROM visible_listings l WHERE
          (l.status='Expired' OR (l.status IN ('Available','Claimed') AND l.expiry_window_end<:now))
          AND l.expiry_window_end>=begins AND
      l.expiry_window_end<ends),0)::numeric(12,2)::text AS expired_kg,
        coalesce((SELECT sum(l.quantity_kg) FROM visible_listings l WHERE l.status='Cancelled'
          AND l.updated_at>=begins AND l.updated_at<ends),0)::numeric(12,2)::text AS
      cancelled_listing_kg
      FROM bins ORDER BY bins.begins
    """),
            {
                "now": now,
                "start": begin,
                "end": finish,
                "grouping": grouping,
                "zone_id": zone["zone_id"],
                "zone_name": zone["zone_name"],
                "city": zone["city"],
            },
        )
        .mappings()
        .all()
    )
    summary = (
        connection.execute(
            text("""SELECT
      (SELECT percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM
      c.claimed_at-l.created_at))
        FROM claims c JOIN food_listings l USING(listing_id) WHERE l.zone_id=:zone
        AND c.claimed_at>=:start AND c.claimed_at<:end) AS median_claim_latency_seconds,
      count(*) AS listings_in_cohort,
      count(*) FILTER(WHERE status='Expired' OR (status IN ('Available','Claimed') AND
      expiry_window_end<:now)) AS expired_listings,
      (100.0 * count(*) FILTER(WHERE status='Expired' OR (status IN ('Available','Claimed')
      AND expiry_window_end<:now)) /
        nullif(count(*),0))::float8 AS expiry_rate_percent
      FROM food_listings WHERE zone_id=:zone AND created_at>=:start AND created_at<:end"""),
            {"zone": zone["zone_id"], "start": begin, "end": finish, "now": now},
        )
        .mappings()
        .one()
    )
    return ImpactResponse(
        data=[ImpactRow.model_validate(row) for row in rows],
        summary=ImpactSummary.model_validate(summary),
        meta=Meta(server_time=now),
    )


def search_pattern(value: str) -> str:
    """Treat wildcard and escape characters as literal user input."""
    return "%" + value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def overview(connection: Connection) -> OverviewResponse:
    # Authenticated pending members can see their inbox; capabilities come from
    # current database approvals, never from a caller or stale browser session.
    uid = int(connection.execute(text("SELECT dbthon_require_actor(false)")).scalar_one())
    now = clock(connection)
    roles = [
        role
        for role in ["Donor", "Receiver", "Volunteer", "Admin"]
        if connection.execute(text("SELECT dbthon_has_role(:role)"), {"role": role}).scalar_one()
    ]
    summaries: dict[str, int] = {}
    values = {"uid": uid, "now": now}
    if "Donor" in roles:
        summaries["live_donations"] = connection.execute(
            text("""
          SELECT count(*) FROM food_listings WHERE donor_id=:uid AND status='Available'
            AND expiry_window_end>:now
        """),
            values,
        ).scalar_one()
    if "Donor" in roles or "Receiver" in roles:
        summaries["active_exchanges"] = connection.execute(
            text("""
          SELECT count(*) FROM claims c JOIN food_listings l USING(listing_id)
          WHERE c.status='Confirmed' AND (c.receiver_id=:uid OR l.donor_id=:uid)
            AND dbthon_can_view_claim(c.claim_id)
        """),
            values,
        ).scalar_one()
    if "Volunteer" in roles:
        summaries["active_deliveries"] = connection.execute(
            text("""
          SELECT count(*) FROM pickups p JOIN claims c USING(claim_id)
          WHERE p.volunteer_id=:uid AND p.status IN ('Scheduled','PickedUp')
            AND dbthon_can_view_claim(c.claim_id)
        """),
            values,
        ).scalar_one()
    if "Admin" in roles:
        summaries["pending_reviews"] = connection.execute(
            text("""
          SELECT count(*) FROM users WHERE zone_id=dbthon_actor_zone()
            AND NOT verified_status
        """)
        ).scalar_one()
    upcoming = (
        connection.execute(
            text("""
      SELECT * FROM (
        SELECT 'exchange'::text AS kind,c.claim_id,NULL::integer AS pickup_id,l.food_type,
          c.status::text AS status,l.expiry_window_end,NULL::timestamptz AS scheduled_time
        FROM claims c JOIN food_listings l USING(listing_id)
        WHERE :exchanges AND c.status='Confirmed' AND (c.receiver_id=:uid OR l.donor_id=:uid)
          AND dbthon_can_view_claim(c.claim_id)
        UNION ALL
        SELECT 'delivery',c.claim_id,p.pickup_id,l.food_type,p.status::text,
          l.expiry_window_end,p.scheduled_time
        FROM pickups p JOIN claims c USING(claim_id) JOIN food_listings l USING(listing_id)
        WHERE :deliveries AND p.volunteer_id=:uid AND p.status IN ('Scheduled','PickedUp')
          AND dbthon_can_view_claim(c.claim_id)
      ) work ORDER BY expiry_window_end,claim_id,kind,pickup_id LIMIT 5
    """),
            {
                **values,
                "exchanges": "Donor" in roles or "Receiver" in roles,
                "deliveries": "Volunteer" in roles,
            },
        )
        .mappings()
        .all()
    )
    unread = connection.execute(
        text("""
      SELECT count(*) FROM notifications WHERE user_id=:uid AND sent_at IS NOT NULL
        AND read_at IS NULL
    """),
        values,
    ).scalar_one()
    updates = (
        connection.execute(
            text("""
      SELECT notification_id,message,type,created_at,sent_at,read_at FROM notifications
      WHERE user_id=:uid AND sent_at IS NOT NULL AND read_at IS NULL
      ORDER BY sent_at DESC,notification_id DESC LIMIT 5
    """),
            values,
        )
        .mappings()
        .all()
    )
    return OverviewResponse(
        data=OverviewData(
            capabilities=roles,
            unread_count=unread,
            summaries=summaries,
            upcoming=[OverviewItem.model_validate(dict(row)) for row in upcoming],
            updates=[Notification.model_validate(dict(row)) for row in updates],
        ),
        meta=Meta(server_time=now),
    )
