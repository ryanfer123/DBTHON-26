"""P02 checks against PostgreSQL, never a SQLite simulation."""

import copy
import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.seed import import_demo
from app.trust.verify import canonical_bytes, verify
from tests.conftest import actor

pytestmark = pytest.mark.database


def test_extensions_indexes_composite_key_and_totals(seeded_db):
    with seeded_db.connect() as c:
        assert c.execute(text("SELECT PostGIS_Version()")).scalar_one().startswith("3.5")
        extensions = set(c.execute(text("SELECT extname FROM pg_extension")).scalars())
        assert {"postgis", "pgcrypto"} <= extensions
        indexes = set(
            c.execute(text("SELECT indexname FROM pg_indexes WHERE schemaname='public'")).scalars()
        )
        assert {
            "uq_claim_allocation",
            "uq_pickup_live_or_delivered",
            "ix_listings_pickup_gist",
        } <= indexes
        keys = (
            c.execute(
                text("""
          SELECT a.attname FROM pg_index i JOIN pg_attribute a
          ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey)
          WHERE i.indrelid='pickups'::regclass AND i.indisprimary ORDER BY a.attnum
        """)
            )
            .scalars()
            .all()
        )
        assert keys == ["claim_id", "pickup_id"]
        rows = (
            c.execute(text("SELECT * FROM zone_impact_summary ORDER BY zone_id")).mappings().all()
        )
        assert len(rows) == 4
        assert tuple(
            str(rows[0][key]) for key in ["picked_up_kg", "delivered_kg", "estimated_meals"]
        ) == ("14.00", "10.00", "25.00")
        assert all(row["delivered_kg"] == 0 for row in rows[1:])


def test_seed_repeat_and_conflicting_anchor(seeded_db):
    with seeded_db.begin() as c:
        anchor = c.execute(text("SELECT anchor FROM seed_runs")).scalar_one()
        assert not import_demo(c, anchor)
        with pytest.raises(ValueError, match="different anchor"):
            import_demo(c, anchor + timedelta(seconds=1))
        assert c.execute(text("SELECT count(*) FROM users")).scalar_one() == 20
        assert c.execute(text("SELECT count(*) FROM trust_ledger")).scalar_one() == 20


@pytest.mark.parametrize(
    "sql",
    [
        "UPDATE food_listings SET quantity_kg=0 WHERE listing_id=1",
        "UPDATE users SET latitude=91 WHERE user_id=102",
        "UPDATE food_listings SET expiry_window_start=expiry_window_end WHERE listing_id=1",
        "UPDATE receiver_profiles SET capacity_kg=-1 WHERE user_id=102",
        "INSERT INTO claims(listing_id,receiver_id) VALUES(999999,102)",
        "UPDATE ratings SET score=6 WHERE rating_id=1",
    ],
)
def test_constraints_reject_bad_data(seeded_db, sql):
    with pytest.raises(IntegrityError), seeded_db.begin() as c:
        c.execute(text(sql))


def test_unique_allocations_survive_completed_and_retry_history(seeded_db):
    for listing in [6, 8]:
        with pytest.raises(IntegrityError), seeded_db.begin() as c:
            c.execute(
                text("INSERT INTO claims(listing_id,receiver_id) VALUES(:id,107)"), {"id": listing}
            )
    for claim in [101, 103]:
        with pytest.raises(IntegrityError), seeded_db.begin() as c:
            c.execute(
                text("""
              INSERT INTO pickups(claim_id,volunteer_id,scheduled_time)
              VALUES(:id,108,clock_timestamp())
            """),
                {"id": claim},
            )
    with seeded_db.connect() as c:
        assert c.execute(text("SELECT count(*) FROM pickups WHERE claim_id=101")).scalar_one() == 2


def test_rls_zone_participant_and_pooled_context(seeded_db):
    with actor(seeded_db, 102) as c:
        assert set(c.execute(text("SELECT DISTINCT zone_id FROM food_listings")).scalars()) == {1}
        assert c.execute(text("SELECT count(*) FROM claims")).scalar_one() == 3
        assert c.execute(text("SELECT count(*) FROM trust_ledger")).scalar_one() == 1
        c.execute(text("SELECT set_config('app.actor_id','202',true)"))
        c.execute(text("SELECT set_config('app.zone_id','2',true)"))
        assert c.execute(text("SELECT dbthon_actor_id()")).scalar_one() == 102
    with actor(seeded_db, 202) as c:
        assert set(c.execute(text("SELECT DISTINCT zone_id FROM food_listings")).scalars()) == {2}
        assert c.execute(text("SELECT count(*) FROM claims")).scalar_one() == 0
    with actor(seeded_db, 105) as c:
        assert c.execute(text("SELECT count(*) FROM claims")).scalar_one() == 0
    with seeded_db.begin() as c:
        c.execute(text("SET LOCAL ROLE dbthon_runtime"))
        assert c.execute(text("SELECT dbthon_actor_id()")).scalar_one() is None
        assert c.execute(text("SELECT count(*) FROM food_listings")).scalar_one() == 0


def test_pending_admin_and_revoked_session_visibility(seeded_db):
    with actor(seeded_db, 106) as c:
        assert c.execute(text("SELECT count(*) FROM users")).scalar_one() == 1
        assert c.execute(text("SELECT count(*) FROM food_listings")).scalar_one() == 0
    with actor(seeded_db, 104) as c:
        assert c.execute(text("SELECT count(*) FROM claims")).scalar_one() == 3
        assert set(c.execute(text("SELECT DISTINCT zone_id FROM users")).scalars()) == {1, 2, 3, 4}
        assert c.execute(text("SELECT count(*) FROM trust_ledger")).scalar_one() == 20
        session = c.execute(text("SELECT current_setting('app.session_hash')")).scalar_one()
    with actor(seeded_db, 204) as c:
        assert set(c.execute(text("SELECT DISTINCT zone_id FROM users")).scalars()) == {2}
    with seeded_db.begin() as c:
        c.execute(
            text("UPDATE sessions SET revoked_at=clock_timestamp() WHERE session_hash=:session"),
            {"session": session},
        )
    with seeded_db.begin() as c:
        c.execute(text("SET LOCAL ROLE dbthon_runtime"))
        c.execute(text("SELECT set_config('app.session_hash',:session,true)"), {"session": session})
        assert c.execute(text("SELECT dbthon_actor_id()")).scalar_one() is None
        assert c.execute(text("SELECT count(*) FROM claims")).scalar_one() == 0


def test_guard_role_is_private_and_functions_fix_search_path(seeded_db):
    with seeded_db.connect() as c:
        guard = c.execute(
            text(
                "SELECT rolcanlogin,rolsuper,rolbypassrls FROM pg_roles "
                "WHERE rolname='dbthon_guard'"
            )
        ).one()
        assert tuple(guard) == (False, False, False)
        assert not c.execute(
            text("SELECT pg_has_role('dbthon_runtime','dbthon_guard','MEMBER')")
        ).scalar_one()
        configs = (
            c.execute(
                text("SELECT proconfig FROM pg_proc WHERE proname LIKE 'dbthon_%' AND prosecdef")
            )
            .scalars()
            .all()
        )
        assert configs and all("search_path=pg_catalog, public, pg_temp" in cfg for cfg in configs)


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT password_hash FROM users",
        "SELECT * FROM sessions",
        "UPDATE food_listings SET status='Claimed' WHERE listing_id=1",
        "SELECT dbthon_record_event(ARRAY[102::bigint],'forged','users',102,NULL,'{}')",
    ],
)
def test_runtime_cannot_read_credentials_or_bypass_routines(seeded_db, sql):
    with pytest.raises(DBAPIError, match="permission denied"), actor(seeded_db, 102) as c:
        c.execute(text(sql))


@pytest.mark.parametrize(
    "sql,reason",
    [
        ("UPDATE trust_ledger SET action_type='changed' WHERE user_id=102", "APPEND_ONLY"),
        ("DELETE FROM trust_ledger WHERE user_id=102", "APPEND_ONLY"),
        ("UPDATE food_listings SET quantity_kg=1 WHERE listing_id=6", "IMMUTABLE"),
        ("UPDATE food_listings SET status='Available' WHERE listing_id=8", "TRANSITION"),
        ("UPDATE claims SET status='Confirmed',ended_at=NULL WHERE claim_id=103", "TRANSITION"),
    ],
)
def test_immutable_audit_and_terminal_transitions(seeded_db, sql, reason):
    with pytest.raises(DBAPIError, match=reason), seeded_db.begin() as c:
        c.execute(text(sql))


@pytest.mark.parametrize(
    "uid,listing,reason",
    [
        (106, 1, "VERIFICATION_REQUIRED"),
        (105, 1, "CAPACITY_INSUFFICIENT"),
        (102, 4, "NOT_FOUND"),
        (102, 5, "LISTING_EXPIRED"),
        (102, 6, "LISTING_UNAVAILABLE"),
        (102, 3, "CAPACITY_INSUFFICIENT"),
        (103, 1, "VERIFICATION_REQUIRED"),
    ],
)
def test_guarded_claim_denials(seeded_db, uid, listing, reason):
    with pytest.raises(DBAPIError, match=reason), actor(seeded_db, uid) as c:
        c.execute(text("SELECT dbthon_claim_listing(:id)"), {"id": listing})


def test_claim_commits_domain_ledger_outbox_and_rollback_is_atomic(seeded_db):
    with pytest.raises(RuntimeError, match="abort"), actor(seeded_db, 102) as c:
        c.execute(text("SELECT dbthon_claim_listing(1)"))
        raise RuntimeError("abort")
    with seeded_db.connect() as c:
        assert (
            c.execute(text("SELECT status FROM food_listings WHERE listing_id=1")).scalar_one()
            == "Available"
        )
        assert c.execute(text("SELECT count(*) FROM claims")).scalar_one() == 3
        assert c.execute(text("SELECT count(*) FROM notification_outbox")).scalar_one() == 0
        assert c.execute(text("SELECT count(*) FROM trust_ledger")).scalar_one() == 20
    with actor(seeded_db, 102) as c:
        claim = c.execute(text("SELECT dbthon_claim_listing(1)")).scalar_one()
    with seeded_db.connect() as c:
        assert (
            c.execute(text("SELECT status FROM food_listings WHERE listing_id=1")).scalar_one()
            == "Claimed"
        )
        assert (
            c.execute(
                text("SELECT count(*) FROM trust_ledger WHERE claim_id=:claim"), {"claim": claim}
            ).scalar_one()
            == 2
        )
        assert (
            c.execute(
                text("SELECT count(*) FROM notification_outbox WHERE status='Pending'")
            ).scalar_one()
            == 2
        )
        assert (
            verify(
                c.execute(text("SELECT * FROM trust_ledger ORDER BY user_id,sequence")).mappings()
            )
            == 22
        )


def test_concurrent_claims_have_one_winner(seeded_db):
    barrier = threading.Barrier(2)

    def claim(uid):
        try:
            with actor(seeded_db, uid) as c:
                barrier.wait(timeout=5)
                return c.execute(text("SELECT dbthon_claim_listing(1)")).scalar_one()
        except DBAPIError as error:
            assert "LISTING_UNAVAILABLE" in str(error)
            return None

    with ThreadPoolExecutor(max_workers=2) as pool:
        winners = list(pool.map(claim, [102, 107]))
    assert sum(winner is not None for winner in winners) == 1
    with seeded_db.connect() as c:
        assert c.execute(text("SELECT count(*) FROM claims WHERE listing_id=1")).scalar_one() == 1
        assert c.execute(text("SELECT count(*) FROM notification_outbox")).scalar_one() == 2
        assert (
            verify(
                c.execute(text("SELECT * FROM trust_ledger ORDER BY user_id,sequence")).mappings()
            )
            == 22
        )


def test_claim_rechecks_clock_after_actual_lock_wait(seeded_db):
    with seeded_db.begin() as c:
        c.execute(
            text(
                "UPDATE food_listings SET expiry_window_end=clock_timestamp()+interval '2 seconds' "
                "WHERE listing_id=1"
            )
        )
    entered = threading.Event()
    pid = []

    def waiting_claim():
        with pytest.raises(DBAPIError, match="LISTING_EXPIRED"), actor(seeded_db, 102) as c:
            pid.append(c.execute(text("SELECT pg_backend_pid()")).scalar_one())
            entered.set()
            c.execute(text("SELECT dbthon_claim_listing(1)"))

    with seeded_db.begin() as blocker, ThreadPoolExecutor(max_workers=1) as pool:
        blocker.execute(text("SELECT FROM food_listings WHERE listing_id=1 FOR UPDATE"))
        future = pool.submit(waiting_claim)
        assert entered.wait(timeout=5)
        deadline = time.monotonic() + 5
        with seeded_db.connect() as observer:
            while time.monotonic() < deadline:
                waiting = observer.execute(
                    text("SELECT wait_event_type FROM pg_stat_activity WHERE pid=:pid"),
                    {"pid": pid[0]},
                ).scalar_one()
                observer.commit()
                if waiting == "Lock":
                    break
                time.sleep(0.02)
            else:
                pytest.fail("The competing connection never waited on the listing lock")
            observer.execute(
                text(
                    "SELECT pg_sleep(greatest(0,extract(epoch FROM "
                    "expiry_window_end-clock_timestamp()))+0.1) "
                    "FROM food_listings WHERE listing_id=1"
                )
            )
        blocker.commit()
        future.result(timeout=5)
    with seeded_db.connect() as c:
        assert c.execute(text("SELECT count(*) FROM claims WHERE listing_id=1")).scalar_one() == 0


def test_independent_unicode_verification_and_tamper_detection(seeded_db):
    payload = {"é": "e\u0301", "emoji": "🥕", "controls": '\n\t"', "flags": [True, None, 7]}
    with seeded_db.begin() as c:
        sql_bytes = (
            c.execute(
                text("SELECT dbthon_canonical_json(CAST(:body AS jsonb))"),
                {"body": json.dumps(payload)},
            )
            .scalar_one()
            .encode()
        )
        assert sql_bytes == canonical_bytes(payload)
        c.execute(
            text(
                "SELECT dbthon_record_event(ARRAY[102::bigint],'test.unicode','users',102,NULL,"
                "CAST(:body AS jsonb))"
            ),
            {"body": json.dumps(payload)},
        )
        rows = [
            dict(row)
            for row in c.execute(
                text("SELECT * FROM trust_ledger ORDER BY user_id,sequence")
            ).mappings()
        ]
        assert verify(rows) == 21
        tampered = copy.deepcopy(rows)
        tampered[0]["payload"]["synthetic"] = False
        with pytest.raises(ValueError, match="hash mismatch"):
            verify(tampered)
        with pytest.raises(ValueError, match="broken sequence"):
            verify([row for row in rows if row["user_id"] == 102][1:])


def test_concurrent_ledger_appends_are_serialized(seeded_db):
    barrier = threading.Barrier(2)

    def append(number):
        with seeded_db.begin() as c:
            barrier.wait(timeout=5)
            c.execute(
                text(
                    "SELECT dbthon_record_event(ARRAY[102::bigint],'test.append','users',102,NULL,"
                    "jsonb_build_object('number',CAST(:number AS integer)))"
                ),
                {"number": number},
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(append, [1, 2]))
    with seeded_db.connect() as c:
        assert (
            verify(
                c.execute(text("SELECT * FROM trust_ledger ORDER BY user_id,sequence")).mappings()
            )
            == 22
        )
        assert (
            c.execute(text("SELECT max(sequence) FROM trust_ledger WHERE user_id=102")).scalar_one()
            == 3
        )
