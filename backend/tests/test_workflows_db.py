"""Redistribution acceptance against real restricted logins and PostgreSQL locks."""

import csv
import io
import secrets
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.access import Access
from app.identity.security import HASHER
from app.main import create_app
from app.trust.verify import verify
from app.workflows.worker import tick

pytestmark = pytest.mark.database
HEADERS = {"X-Requested-With": "SecondTable", "Origin": "http://127.0.0.1:5173"}


@pytest.fixture
def workflow(seeded_db, identity_settings):
    password = secrets.token_urlsafe(24)
    with seeded_db.begin() as c:
        c.execute(text("UPDATE users SET password_hash=:hashed"), {"hashed": HASHER.hash(password)})
    with ExitStack() as stack:
        clients = {}

        def client(uid):
            if uid not in clients:
                with seeded_db.connect() as c:
                    email = c.execute(
                        text("SELECT email FROM users WHERE user_id=:uid"), {"uid": uid}
                    ).scalar_one()
                value = stack.enter_context(
                    TestClient(create_app(identity_settings), headers=HEADERS)
                )
                login = value.post(
                    "/api/v1/auth/login", json={"email": email, "password": password}
                )
                assert login.status_code == 200
                value.headers["X-CSRF-Token"] = login.json()["data"]["csrf_token"]
                value.actor_client = client
                clients[uid] = value
            return clients[uid]

        worker = Access(identity_settings)
        stack.callback(worker.close)
        yield seeded_db, client, worker


def body(**changes):
    now = datetime.now(UTC)
    return {
        "food_type": "Synthetic rice and vegetables",
        "category": "Veg",
        "quantity_kg": "4.00",
        "prepared_at": (now - timedelta(hours=1)).isoformat(),
        "expiry_window_start": (now - timedelta(minutes=1)).isoformat(),
        "expiry_window_end": (now + timedelta(hours=1)).isoformat(),
        "pickup_lat": "12.9692",
        "pickup_long": "79.1559",
        **changes,
    }


def post(client, path, payload, key=None):
    return client.post(
        "/api/v1" + path, json=payload, headers={"Idempotency-Key": key or secrets.token_hex(16)}
    )


def create(client, **changes):
    result = post(client, "/listings", body(**changes))
    assert result.status_code == 201, result.text
    return result.json()["data"]["listing_id"]


def claim(client, lid):
    result = post(client, f"/listings/{lid}/claims", {})
    assert result.status_code == 201, result.text
    return result.json()["data"]["claim_id"]


def accept(client, cid):
    result = post(
        client,
        f"/claims/{cid}/pickups",
        {"scheduled_time": (datetime.now(UTC) + timedelta(minutes=1)).isoformat()},
    )
    assert result.status_code == 201, result.text
    pid = result.json()["data"]["pickup_id"]
    confirm_booking(client, cid, pid)
    return pid


def confirm_booking(volunteer, cid, pid):
    exchange = volunteer.get(f"/api/v1/claims/{cid}").json()["data"]
    for uid in [exchange["donor_id"], exchange["receiver_id"]]:
        response = post(
            volunteer.actor_client(uid),
            f"/claims/{cid}/pickups/{pid}/schedule",
            {"version": exchange["schedule_version"]},
        )
        assert response.status_code == 200, response.text


def deliver(client, cid, pid):
    assert post(client, f"/claims/{cid}/pickups/{pid}/picked-up", {}).status_code == 200
    result = post(client, f"/claims/{cid}/pickups/{pid}/delivered", {})
    assert result.status_code == 200, result.text


def test_listing_crud_scope_constraints_and_retry_identity(workflow):
    db, client, _ = workflow
    donor, receiver, pending, other = client(101), client(102), client(106), client(201)
    key = secrets.token_hex(16)
    payload = body()
    first = post(donor, "/listings", payload, key)
    assert first.status_code == 201, first.text
    lid = first.json()["data"]["listing_id"]
    assert post(donor, "/listings", payload, key).json() == first.json()
    assert (
        post(donor, "/listings", {**payload, "food_type": "Changed request"}, key).status_code
        == 409
    )
    assert receiver.get(f"/api/v1/listings/{lid}").json()["data"]["donor_name"] == "Demo Z1 Donor"
    assert other.get(f"/api/v1/listings/{lid}").status_code == 404
    assert pending.get("/api/v1/listings").status_code == 403
    assert post(receiver, "/listings", payload).status_code == 403
    assert donor.post("/api/v1/listings", json=payload).status_code == 422
    assert post(donor, "/listings", {**payload, "donor_id": 201}).status_code == 422
    assert post(donor, "/listings", body(quantity_kg="0")).status_code == 422
    assert (
        post(
            donor,
            "/listings",
            body(prepared_at=(datetime.now(UTC) + timedelta(hours=2)).isoformat()),
        ).status_code
        == 422
    )
    edit = donor.patch(
        f"/api/v1/listings/{lid}",
        json={"food_type": "Updated synthetic food"},
        headers={"Idempotency-Key": secrets.token_hex(16)},
    )
    assert edit.status_code == 200, edit.text
    assert (
        donor.get(f"/api/v1/listings/{lid}").json()["data"]["food_type"] == "Updated synthetic food"
    )
    cid = claim(receiver, lid)
    assert (
        donor.patch(
            f"/api/v1/listings/{lid}",
            json={"quantity_kg": "5"},
            headers={"Idempotency-Key": secrets.token_hex(16)},
        ).status_code
        == 409
    )
    assert (
        post(
            donor, f"/listings/{lid}/cancel", {"reason": "Synthetic donor cancellation"}
        ).status_code
        == 200
    )
    assert receiver.get(f"/api/v1/claims/{cid}").json()["data"]["status"] == "Cancelled"
    assert donor.get(f"/api/v1/listings/{lid}").json()["data"]["status"] == "Cancelled"
    with db.connect() as c:
        verify(c.execute(text("SELECT * FROM trust_ledger ORDER BY user_id,sequence")).mappings())


def test_feed_rank_filters_privacy_pagination_and_server_clock(workflow):
    _, client, _ = workflow
    donor, receiver = client(101), client(102)
    early = create(donor, expiry_window_end=(datetime.now(UTC) + timedelta(minutes=10)).isoformat())
    later = create(
        donor,
        category="NonVeg",
        expiry_window_end=(datetime.now(UTC) + timedelta(hours=3)).isoformat(),
    )
    too_large = create(donor, quantity_kg="999.00")
    future = create(
        donor,
        expiry_window_start=(datetime.now(UTC) + timedelta(hours=1)).isoformat(),
        expiry_window_end=(datetime.now(UTC) + timedelta(hours=2)).isoformat(),
    )
    far = create(donor, pickup_lat="11.000000")
    found = []
    cursor = None
    while True:
        response = receiver.get(
            "/api/v1/listings", params={"limit": 1, **({"cursor": cursor} if cursor else {})}
        )
        assert response.status_code == 200, response.text
        page = response.json()
        found.extend(page["data"])
        cursor = page["meta"]["next_cursor"]
        if cursor is None:
            break
        assert (
            receiver.get(
                "/api/v1/listings", params={"cursor": cursor, "category": "NonVeg"}
            ).status_code
            == 422
        )
    ids = [item["listing_id"] for item in found]
    assert early in ids and later in ids
    assert not set([too_large, future, far]) & set(ids)
    assert found == sorted(
        found, key=lambda x: (x["expiry_window_end"], x["distance_m"], x["listing_id"])
    )
    assert next(item for item in found if item["listing_id"] == early)["approaching_expiry"]
    assert all(
        item["category"] == "NonVeg"
        for item in receiver.get("/api/v1/listings?category=NonVeg").json()["data"]
    )
    assert receiver.get("/api/v1/listings?cursor=invalid").status_code == 422
    assert receiver.get("/api/v1/listings?radius_m=5001").status_code == 422
    response = receiver.get("/api/v1/listings")
    assert response.headers["cache-control"] == "private, no-store"
    assert not any(
        field in response.text for field in ["phone", "password_hash", "receiver_phone", "email"]
    )


def test_claim_race_and_replay_have_one_domain_result(workflow):
    db, client, _ = workflow
    donor, one, two = client(101), client(102), client(107)
    lid = create(donor)
    barrier = Barrier(2)
    keys = [secrets.token_hex(16), secrets.token_hex(16)]

    def run(item):
        value, key = item
        barrier.wait()
        return post(value, f"/listings/{lid}/claims", {}, key)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, zip([one, two], keys, strict=True)))
    assert sorted(result.status_code for result in results) == [201, 409]
    winner = next(index for index, result in enumerate(results) if result.status_code == 201)
    assert (
        post([one, two][winner], f"/listings/{lid}/claims", {}, keys[winner]).json()
        == results[winner].json()
    )
    with db.connect() as c:
        assert (
            c.execute(
                text("SELECT count(*) FROM claims WHERE listing_id=:id"), {"id": lid}
            ).scalar_one()
            == 1
        )
        cid = results[winner].json()["data"]["claim_id"]
        assert (
            c.execute(
                text(
                    "SELECT count(*) FROM trust_ledger WHERE claim_id=:cid AND "
                    "action_type='claim.confirmed'"
                ),
                {"cid": cid},
            ).scalar_one()
            == 2
        )
    revoked = [one, two][winner]
    uid = 102 if winner == 0 else 107
    assert (
        post(
            client(104),
            f"/admin/users/{uid}/verify",
            {"roles": [], "verified": False, "reason": "Synthetic revocation"},
        ).status_code
        == 200
    )
    assert post(revoked, f"/listings/{lid}/claims", {}, keys[winner]).status_code == 403


def test_receiver_cancel_releases_listing_and_preserves_attempt(workflow):
    _, client, _ = workflow
    donor, receiver, volunteer = client(101), client(102), client(103)
    lid = create(donor)
    cid = claim(receiver, lid)
    pid = accept(volunteer, cid)
    result = post(receiver, f"/claims/{cid}/cancel", {"reason": "Synthetic receiver cancellation"})
    assert result.status_code == 200, result.text
    assert donor.get(f"/api/v1/listings/{lid}").json()["data"]["status"] == "Available"
    assert volunteer.get("/api/v1/pickups/mine").json()["data"][-1]["pickup_status"] == "Cancelled"
    cid2 = claim(receiver, lid)
    assert cid2 != cid
    assert post(volunteer, f"/claims/{cid}/pickups/{pid}/picked-up", {}).status_code == 409


def test_volunteer_race_contacts_and_composite_retry_history(workflow):
    _, client, _ = workflow
    donor, receiver, one, two = client(101), client(102), client(103), client(108)
    lid = create(donor)
    cid = claim(receiver, lid)
    tasks = one.get("/api/v1/pickup-tasks")
    assert any(task["claim_id"] == cid for task in tasks.json()["data"])
    assert "phone" not in tasks.text and "receiver_latitude" not in tasks.text
    assert one.get(f"/api/v1/claims/{cid}").status_code == 404
    barrier = Barrier(2)
    scheduled = (datetime.now(UTC) + timedelta(minutes=1)).isoformat()

    def run(value):
        barrier.wait()
        return post(value, f"/claims/{cid}/pickups", {"scheduled_time": scheduled})

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, [one, two]))
    assert sorted(result.status_code for result in results) == [201, 409]
    winner = [one, two][next(i for i, r in enumerate(results) if r.status_code == 201)]
    pid = next(r.json()["data"]["pickup_id"] for r in results if r.status_code == 201)
    assert winner.get(f"/api/v1/claims/{cid}").json()["data"]["receiver_phone"]
    assert (
        post(
            winner, f"/claims/{cid}/pickups/{pid}/cancel", {"reason": "Synthetic replacement"}
        ).status_code
        == 200
    )
    pid2 = accept(winner, cid)
    assert pid2 != pid
    rows = winner.get("/api/v1/pickups/mine?limit=1").json()
    all_rows = []
    while True:
        all_rows.extend(rows["data"])
        cursor = rows["meta"]["next_cursor"]
        if cursor is None:
            break
        rows = winner.get("/api/v1/pickups/mine", params={"limit": 1, "cursor": cursor}).json()
    assert {p["pickup_id"] for p in all_rows if p["claim_id"] == cid} == {pid, pid2}


def test_delivery_ratings_ledger_and_impact_reconcile(workflow):
    db, client, worker = workflow
    donor, receiver, volunteer, admin = client(101), client(102), client(103), client(104)
    baseline = admin.get("/api/v1/admin/impact").json()["data"][0]
    lid = create(donor)
    cid = claim(receiver, lid)
    pid = accept(volunteer, cid)
    assert (
        post(donor, f"/claims/{cid}/ratings", {"target_user_id": 102, "score": 5}).status_code
        == 409
    )
    assert post(volunteer, f"/claims/{cid}/pickups/{pid}/delivered", {}).status_code == 409
    collect_key = secrets.token_hex(16)
    collected = post(volunteer, f"/claims/{cid}/pickups/{pid}/picked-up", {}, collect_key)
    assert collected.status_code == 200
    assert (
        post(receiver, f"/claims/{cid}/cancel", {"reason": "Too late to release"}).status_code
        == 409
    )
    assert (
        post(donor, f"/listings/{lid}/cancel", {"reason": "Too late to release"}).status_code == 409
    )
    assert post(volunteer, f"/claims/{cid}/pickups/{pid}/delivered", {}).status_code == 200
    assert (
        post(volunteer, f"/claims/{cid}/pickups/{pid}/picked-up", {}, collect_key).json()
        == collected.json()
    )
    assert donor.get(f"/api/v1/listings/{lid}").json()["data"]["status"] == "Delivered"
    assert post(receiver, f"/listings/{lid}/claims", {}).status_code == 409
    assert (
        post(volunteer, f"/claims/{cid}/ratings", {"target_user_id": 101, "score": 5}).status_code
        == 404
    )
    assert (
        post(receiver, f"/claims/{cid}/ratings", {"target_user_id": 103, "score": 5}).status_code
        == 403
    )
    rating_key = secrets.token_hex(16)
    rating = post(
        receiver,
        f"/claims/{cid}/ratings",
        {"target_user_id": 101, "score": 5, "comments": "Synthetic completed exchange"},
        rating_key,
    )
    assert rating.status_code == 201, rating.text
    assert (
        post(
            receiver,
            f"/claims/{cid}/ratings",
            {"target_user_id": 101, "score": 5, "comments": "Synthetic completed exchange"},
            rating_key,
        ).json()
        == rating.json()
    )
    assert (
        post(receiver, f"/claims/{cid}/ratings", {"target_user_id": 101, "score": 4}).status_code
        == 409
    )
    assert receiver.get("/api/v1/users/101/trust").json()["data"]["rating_count"] >= 1
    tick(worker)
    notifications = receiver.get("/api/v1/notifications").json()["data"]
    assert notifications
    nid = notifications[-1]["notification_id"]
    assert post(receiver, f"/notifications/{nid}/read", {}).status_code == 200
    assert all(
        n["notification_id"] != nid
        for n in receiver.get("/api/v1/notifications?unread_only=true").json()["data"]
    )
    assert post(volunteer, f"/notifications/{nid}/read", {}).status_code == 404
    with db.connect() as c:
        read_events = c.execute(
            text(
                "SELECT count(*) FROM trust_ledger WHERE action_type='inbox.read' AND ref_id=:nid"
            ),
            {"nid": nid},
        ).scalar_one()
    assert post(receiver, f"/notifications/{nid}/read", {}).status_code == 200
    with db.connect() as c:
        assert (
            c.execute(
                text(
                    "SELECT count(*) FROM trust_ledger WHERE "
                    "action_type='inbox.read' AND ref_id=:nid"
                ),
                {"nid": nid},
            ).scalar_one()
            == read_events
        )

    report = admin.get("/api/v1/admin/impact").json()
    result = report["data"][0]
    assert Decimal(result["picked_up_kg"]) - Decimal(baseline["picked_up_kg"]) == Decimal("4.00")
    assert Decimal(result["delivered_kg"]) - Decimal(baseline["delivered_kg"]) == Decimal("4.00")
    assert result["estimated_co2e_kg"] is None and report["factors"]["meal_weight_kg"] == "0.4"
    assert admin.get("/api/v1/admin/impact?zone_id=2").status_code == 404
    assert receiver.get("/api/v1/admin/impact").status_code == 403
    assert receiver.get("/api/v1/users/201/trust").status_code == 404
    assert admin.get("/api/v1/admin/users/201/trust-ledger").status_code == 404
    ledger = receiver.get("/api/v1/trust-ledger/mine?limit=100").json()["data"]
    assert any(event["action_type"] == "pickup.deliver" for event in ledger)
    with db.connect() as c:
        verify(c.execute(text("SELECT * FROM trust_ledger ORDER BY user_id,sequence")).mappings())
    row = receiver.get(f"/api/v1/claims/{cid}").json()["data"]
    assert (
        row["claimed_at"]
        <= row["actual_pickup_time"]
        <= row["delivery_time"]
        < row["expiry_window_end"]
    )


def test_expiry_and_missed_collection_without_user_updates(workflow):
    db, client, worker = workflow
    donor, receiver, volunteer = client(101), client(102), client(103)
    # Available deadlines may be altered by the bootstrap fixture to exercise a due sweep.
    lid = create(donor)
    with db.begin() as c:
        c.execute(
            text(
                "UPDATE food_listings SET expiry_window_end=clock_timestamp()-interval '1 second' "
                "WHERE "
                "listing_id=:id"
            ),
            {"id": lid},
        )
    assert all(
        item["listing_id"] != lid for item in receiver.get("/api/v1/listings").json()["data"]
    )
    assert post(receiver, f"/listings/{lid}/claims", {}).status_code == 409
    assert tick(worker)["expired_or_missed"] >= 1
    assert donor.get(f"/api/v1/listings/{lid}").json()["data"]["status"] == "Expired"
    lid2 = create(donor)
    cid = claim(receiver, lid2)
    pid = accept(volunteer, cid)
    with db.begin() as c:
        c.execute(
            text(
                "UPDATE pickups SET scheduled_time=clock_timestamp()-interval '16 minutes' WHERE "
                "claim_id=:cid AND pickup_id=:pid"
            ),
            {"cid": cid, "pid": pid},
        )
    assert post(volunteer, f"/claims/{cid}/pickups/{pid}/picked-up", {}).status_code == 409
    assert tick(worker)["expired_or_missed"] == 1
    assert volunteer.get(f"/api/v1/claims/{cid}").json()["data"]["pickup_status"] == "Missed"
    assert any(
        task["claim_id"] == cid for task in volunteer.get("/api/v1/pickup-tasks").json()["data"]
    )
    assert accept(volunteer, cid) != pid


def test_picked_up_deadline_failure_retains_mass(workflow):
    _, client, worker = workflow
    donor, receiver, volunteer, admin = client(101), client(102), client(103), client(104)
    baseline = admin.get("/api/v1/admin/impact").json()["data"][0]
    now = datetime.now(UTC)
    lid = create(donor, expiry_window_end=(now + timedelta(seconds=2)).isoformat())
    cid = claim(receiver, lid)
    response = post(
        volunteer,
        f"/claims/{cid}/pickups",
        {"scheduled_time": (datetime.now(UTC) + timedelta(milliseconds=100)).isoformat()},
    )
    assert response.status_code == 201, response.text
    pid = response.json()["data"]["pickup_id"]
    confirm_booking(volunteer, cid, pid)
    assert post(volunteer, f"/claims/{cid}/pickups/{pid}/picked-up", {}).status_code == 200
    time.sleep(2.1)
    assert post(volunteer, f"/claims/{cid}/pickups/{pid}/delivered", {}).status_code == 409
    tick(worker)
    result = volunteer.get(f"/api/v1/claims/{cid}").json()["data"]
    assert (
        result["pickup_status"] == "Failed"
        and result["actual_pickup_time"]
        and result["status"] == "Expired"
    )
    impact = admin.get("/api/v1/admin/impact").json()["data"][0]
    assert Decimal(impact["picked_up_kg"]) - Decimal(baseline["picked_up_kg"]) == Decimal("4.00")
    assert impact["delivered_kg"] == baseline["delivered_kg"]


def test_outbox_leases_retry_recovery_and_worker_isolation(workflow):
    db, client, worker = workflow
    create(client(101))

    class Offline:
        def available(self):
            return False

    assert tick(worker, Offline())["notifications_retried"] > 0
    with db.begin() as c:
        c.execute(
            text(
                "UPDATE notification_outbox SET "
                "next_attempt_at=clock_timestamp()-interval '1 second' "
                "WHERE status='Pending'"
            )
        )
    with worker.transaction("worker") as c:
        lease = c.execute(text("SELECT * FROM dbthon_lease_notifications(1)")).mappings().one()
    with db.begin() as c:
        c.execute(
            text(
                "UPDATE notification_outbox SET locked_until=clock_timestamp()-interval '1 second' "
                "WHERE outbox_id=:id"
            ),
            {"id": lease["outbox_id"]},
        )
    with worker.transaction("worker") as c:
        assert not c.execute(
            text("SELECT dbthon_finish_notification(:id,:token,true)"),
            {"id": lease["outbox_id"], "token": lease["lease_token"]},
        ).scalar_one()
    assert tick(worker)["notifications_delivered"] > 0
    with worker.transaction("worker") as c:
        with pytest.raises(DBAPIError):
            c.execute(text("SELECT * FROM users"))
    with db.begin() as c:
        c.execute(text("SET LOCAL ROLE dbthon_runtime"))
        with pytest.raises(DBAPIError):
            c.execute(text("SELECT dbthon_due_listings(10)"))
    with db.begin() as c:
        c.execute(
            text(
                "UPDATE notification_outbox SET "
                "status='Processing',attempts=5,locked_until=clock_timestamp()-interval '1 second' "
                "WHERE outbox_id=:id"
            ),
            {"id": lease["outbox_id"]},
        )
    tick(worker)
    with db.connect() as c:
        assert (
            c.execute(
                text("SELECT status FROM notification_outbox WHERE outbox_id=:id"),
                {"id": lease["outbox_id"]},
            ).scalar_one()
            == "Failed"
        )


def test_report_empty_days_half_open_range_csv_and_bounds(workflow):
    db, client, _ = workflow
    admin = client(104)
    begin = (datetime.now(UTC) + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    end = begin + timedelta(days=2)
    response = admin.get(
        "/api/v1/admin/impact",
        params={"from": begin.isoformat(), "to": end.isoformat(), "grouping": "day"},
    )
    assert response.status_code == 200, response.text
    assert len(response.json()["data"]) == 2
    assert all(row["delivered_kg"] == "0.00" for row in response.json()["data"])
    assert (
        admin.get(
            "/api/v1/admin/impact", params={"from": end.isoformat(), "to": begin.isoformat()}
        ).status_code
        == 422
    )
    assert (
        admin.get(
            "/api/v1/admin/impact",
            params={"from": begin.isoformat(), "to": (begin + timedelta(days=367)).isoformat()},
        ).status_code
        == 422
    )
    with db.begin() as c:
        c.execute(
            text("UPDATE zones SET zone_name='=Synthetic spreadsheet formula' WHERE zone_id=1")
        )
    exported = admin.get("/api/v1/admin/impact/export")
    assert exported.status_code == 200 and "attachment" in exported.headers["content-disposition"]
    parsed = list(csv.DictReader(io.StringIO(exported.text)))
    assert parsed[0]["zone_name"].startswith("'=Synthetic")
    assert parsed[0]["meal_weight_kg"] == "0.4" and parsed[0]["estimated_co2e_kg"] == ""


def test_admin_exchange_failure_is_scoped_and_never_relists_picked_up_food(workflow):
    db, client, _worker = workflow
    donor, receiver, volunteer, admin = client(101), client(102), client(103), client(104)
    other_admin = client(204)
    lid = create(donor)
    cid = claim(receiver, lid)
    pid = accept(volunteer, cid)
    assert post(volunteer, f"/claims/{cid}/pickups/{pid}/picked-up", {}).status_code == 200
    assert receiver.get("/api/v1/admin/claims").status_code == 403
    assert any(row["claim_id"] == cid for row in admin.get("/api/v1/admin/claims").json()["data"])
    assert all(
        row["claim_id"] != cid for row in other_admin.get("/api/v1/admin/claims").json()["data"]
    )
    body = {"reason": "Synthetic test: delivery cannot be completed"}
    assert post(other_admin, f"/admin/claims/{cid}/fail", body).status_code == 404
    assert post(receiver, f"/admin/claims/{cid}/fail", body).status_code == 403
    key = secrets.token_hex(16)
    result = post(admin, f"/admin/claims/{cid}/fail", body, key)
    assert result.status_code == 200, result.text
    assert post(admin, f"/admin/claims/{cid}/fail", body, key).json() == result.json()
    row = receiver.get(f"/api/v1/claims/{cid}").json()["data"]
    assert row["status"] == "Expired" and row["pickup_status"] == "Failed"
    assert row["actual_pickup_time"] is not None and row["delivery_time"] is None
    assert donor.get(f"/api/v1/listings/{lid}").json()["data"]["status"] == "Expired"
    assert post(client(107), f"/listings/{lid}/claims", {}).status_code == 409
    with db.connect() as c:
        verify(c.execute(text("SELECT * FROM trust_ledger ORDER BY user_id,sequence")).mappings())


@pytest.mark.parametrize("uid", [101, 102, 103, 104, 106, 202])
def test_overview_exact_scoped_role_counts_and_private_projection(workflow, uid):
    db, client, worker = workflow
    tick(worker)
    response = client(uid).get("/api/v1/workspace/overview")
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    with db.connect() as c:
        assert (
            data["unread_count"]
            == c.execute(
                text("""
            SELECT count(*) FROM notifications WHERE user_id=:uid
              AND sent_at IS NOT NULL AND read_at IS NULL AND hidden_at IS NULL
        """),
                {"uid": uid},
            ).scalar_one()
        )
        if uid == 101:
            assert (
                data["summaries"]["live_donations"]
                == c.execute(
                    text("""
              SELECT count(*) FROM food_listings WHERE donor_id=101
              AND status='Available' AND expiry_window_end>clock_timestamp()
            """)
                ).scalar_one()
            )
        if uid in [101, 102, 202]:
            assert (
                data["summaries"]["active_exchanges"]
                == c.execute(
                    text("""
              SELECT count(*) FROM claims c JOIN food_listings l USING(listing_id)
              WHERE c.status='Confirmed' AND (c.receiver_id=:uid OR l.donor_id=:uid)
            """),
                    {"uid": uid},
                ).scalar_one()
            )
        if uid == 103:
            assert (
                data["summaries"]["active_deliveries"]
                == c.execute(
                    text("""
              SELECT count(*) FROM pickups WHERE volunteer_id=103
                AND status IN ('Scheduled','PickedUp')
            """)
                ).scalar_one()
            )
        if uid == 104:
            assert data["summaries"] == {
                "pending_reviews": c.execute(
                    text("SELECT count(*) FROM users WHERE zone_id=1 AND NOT verified_status")
                ).scalar_one()
            }
    if uid == 106:
        assert data["capabilities"] == [] and data["summaries"] == {} and data["upcoming"] == []
    else:
        assert len(data["upcoming"]) <= 5
        assert data["upcoming"] == sorted(
            data["upcoming"],
            key=lambda row: (
                row["expiry_window_end"],
                row["claim_id"],
                row["kind"],
                row["pickup_id"] or 0,
            ),
        )
    assert not any(
        field in response.text
        for field in ["password_hash", "donor_phone", "receiver_phone", "latitude", "session_hash"]
    )


def test_overview_current_approvals_and_multi_role_counts(workflow):
    db, client, _ = workflow
    member = client(102)
    with db.begin() as c:
        c.execute(
            text(
                "INSERT INTO user_roles(user_id,role,approved_by,approved_at) "
                "VALUES(102,'Donor',104,clock_timestamp())"
            )
        )
    data = member.get("/api/v1/workspace/overview").json()["data"]
    assert set(data["capabilities"]) == {"Receiver", "Donor"}
    assert set(data["summaries"]) == {"live_donations", "active_exchanges"}
    with db.begin() as c:
        c.execute(text("UPDATE users SET verified_status=false WHERE user_id=102"))
    data = member.get("/api/v1/workspace/overview").json()["data"]
    assert data["capabilities"] == [] and data["summaries"] == {} and data["upcoming"] == []


def test_food_search_literals_case_and_cursor_scope(workflow):
    _, client, _ = workflow
    donor, receiver = client(101), client(102)
    literal = create(donor, food_type="100%_Bread\\special")
    other = create(donor, food_type="100 percent bread")
    for endpoint, actor in [("/listings", receiver), ("/listings/mine", donor)]:
        result = actor.get("/api/v1" + endpoint, params={"q": "  %_bREAD\\  "})
        assert result.status_code == 200, result.text
        assert [row["listing_id"] for row in result.json()["data"]] == [literal]
        assert actor.get("/api/v1" + endpoint, params={"q": "' OR 1=1 --"}).json()["data"] == []
        assert actor.get("/api/v1" + endpoint, params={"q": "x" * 81}).status_code == 422
    first = receiver.get("/api/v1/listings", params={"q": " 100 ", "limit": 1}).json()
    cursor = first["meta"]["next_cursor"]
    assert cursor is not None
    next_page = receiver.get("/api/v1/listings", params={"q": "100", "cursor": cursor, "limit": 1})
    assert next_page.status_code == 200
    assert {first["data"][0]["listing_id"], next_page.json()["data"][0]["listing_id"]} == {
        literal,
        other,
    }
    assert (
        receiver.get("/api/v1/listings", params={"q": "rice", "cursor": cursor}).status_code == 422
    )
    foreign = client(202).get("/api/v1/listings", params={"q": "Bread\\special"})
    assert foreign.status_code == 200 and foreign.json()["data"] == []


def test_overview_counts_all_active_work_but_lists_only_five(workflow):
    db, client, _ = workflow
    donor, receiver = client(101), client(102)
    for offset in range(7):
        lid = create(
            donor,
            food_type=f"Upcoming meal {offset}",
            expiry_window_end=(datetime.now(UTC) + timedelta(minutes=30 + offset)).isoformat(),
        )
        claim(receiver, lid)
    data = receiver.get("/api/v1/workspace/overview").json()["data"]
    with db.connect() as c:
        expected = c.execute(
            text("SELECT count(*) FROM claims WHERE receiver_id=102 AND status='Confirmed'")
        ).scalar_one()
    assert data["summaries"]["active_exchanges"] == expected and expected >= 7
    assert len(data["upcoming"]) == 5
    assert len({item["claim_id"] for item in data["upcoming"]}) == 5


def test_overview_etag_is_actor_scoped_and_verification_checks_complete_chain(workflow):
    _, client, _ = workflow
    one, two = client(101), client(102)
    initial = one.get("/api/v1/workspace/overview")
    etag = initial.headers["etag"]
    assert one.get("/api/v1/workspace/overview", headers={"If-None-Match": etag}).status_code == 304
    assert two.get("/api/v1/workspace/overview", headers={"If-None-Match": etag}).status_code == 200
    create(one)
    assert one.get("/api/v1/workspace/overview", headers={"If-None-Match": etag}).status_code == 200
    result = one.get("/api/v1/trust-ledger/mine/verification").json()["data"]
    assert result["valid"] is True and result["entries_verified"] > 0
    assert result["checked_through_sequence"] == result["entries_verified"]
    assert len(result["head_hash"]) == 64


def test_capacity_count_trust_projection_and_cursor_scope(workflow):
    db, client, _ = workflow
    donor, receiver = client(101), client(102)
    small = create(donor, food_type="Capacity_% exact", quantity_kg="4.00")
    large = create(donor, food_type="Capacity_% exact", quantity_kg="99.00")
    create(client(201), food_type="Capacity_% exact", quantity_kg="99.00")
    feed = receiver.get("/api/v1/listings", params={"q": "  CAPACITY_% exact ", "limit": 1}).json()
    assert [row["listing_id"] for row in feed["data"]] == [small]
    assert feed["meta"]["hidden_over_capacity_count"] == 1
    expanded = receiver.get(
        "/api/v1/listings",
        params={"q": "Capacity_% exact", "include_over_capacity": True, "limit": 1},
    ).json()
    cursor = expanded["meta"]["next_cursor"]
    assert cursor is not None
    assert (
        receiver.get(
            "/api/v1/listings", params={"q": "Capacity_% exact", "cursor": cursor}
        ).status_code
        == 422
    )
    next_page = receiver.get(
        "/api/v1/listings",
        params={"q": "Capacity_% exact", "include_over_capacity": True, "cursor": cursor},
    ).json()
    assert next_page["meta"]["hidden_over_capacity_count"] == 1
    assert next_page["data"][0]["listing_id"] == large
    assert next_page["data"][0]["claim_eligible"] is False
    assert "capacity" in next_page["data"][0]["claim_ineligible_reason"]
    assert post(receiver, f"/listings/{large}/claims", {}).status_code == 409
    detail = receiver.get(f"/api/v1/listings/{small}").json()["data"]
    trust = receiver.get("/api/v1/users/101/trust").json()["data"]
    assert detail["donor_verified"] is True
    assert detail["donor_rating_avg"] == trust["average_score"]
    assert detail["donor_rating_count"] == trust["rating_count"]
    assert not any(
        key in detail for key in ["email", "phone", "donor_phone", "donor_email", "password_hash"]
    )
    assert client(106).get("/api/v1/listings").status_code == 403
    with db.begin() as c:
        c.execute(
            text(
                "UPDATE user_roles SET approved_at=NULL,approved_by=NULL "
                "WHERE user_id=101 AND role='Donor'"
            )
        )
    assert receiver.get("/api/v1/listings", params={"q": "Capacity_% exact"}).json()["data"] == []
    revoked = receiver.get(f"/api/v1/listings/{small}").json()["data"]
    assert not revoked["donor_verified"] and not revoked["claim_eligible"]
    assert revoked["donor_rating_avg"] is None


def test_thumbnail_upload_is_atomic_scoped_metadata_free_and_moderated(workflow):
    import base64

    from PIL import Image

    db, client, _ = workflow
    donor, receiver, admin, outsider = client(101), client(102), client(104), client(201)
    image = Image.new("RGB", (900, 600), "green")
    exif = Image.Exif()
    exif[0x010E] = "Synthetic metadata must be removed"
    output = io.BytesIO()
    image.save(output, format="JPEG", exif=exif)
    photo = base64.b64encode(output.getvalue()).decode()
    payload = body(food_type="Photo synthetic food", photo_base64=photo)
    key = secrets.token_hex(16)
    created = post(donor, "/listings", payload, key)
    assert created.status_code == 201, created.text
    lid = created.json()["data"]["listing_id"]
    assert post(donor, "/listings", payload, key).json() == created.json()
    response = receiver.get(f"/api/v1/listings/{lid}/photo")
    assert response.status_code == 200 and response.headers["content-type"] == "image/jpeg"
    with Image.open(io.BytesIO(response.content)) as result:
        assert max(result.size) <= 800
        assert not result.getexif()
    assert len(response.content) <= 153600
    assert outsider.get(f"/api/v1/listings/{lid}/photo").status_code == 404
    assert client(106).get(f"/api/v1/listings/{lid}/photo").status_code == 403
    assert receiver.get(f"/api/v1/listings/{lid}").json()["data"]["has_photo"] is True
    before = donor.get("/api/v1/listings/mine").json()["data"]
    assert post(donor, "/listings", body(photo_base64="NotBase64")).status_code == 422
    assert [row["listing_id"] for row in donor.get("/api/v1/listings/mine").json()["data"]] == [
        row["listing_id"] for row in before
    ]
    assert post(donor, "/listings", body(photo_base64="A" * 204804)).status_code == 422
    assert post(receiver, f"/admin/listings/{lid}/photo/remove", {}).status_code == 403
    removed = post(admin, f"/admin/listings/{lid}/photo/remove", {})
    assert removed.status_code == 200, removed.text
    assert receiver.get(f"/api/v1/listings/{lid}/photo").status_code == 404
    with db.connect() as c:
        assert (
            c.execute(
                text(
                    "SELECT count(*) FROM trust_ledger "
                    "WHERE ref_id=:id AND action_type='photo.removed'"
                ),
                {"id": lid},
            ).scalar_one()
            == 2
        )
        assert (
            verify(
                c.execute(text("SELECT * FROM trust_ledger ORDER BY user_id,sequence")).mappings()
            )
            > 0
        )


def test_public_impact_only_aggregates_and_report_median_matches_sql(workflow):
    db, client, _ = workflow
    receiver = client(102)
    public = receiver.get("/api/v1/public/impact")
    assert public.status_code == 200, public.text
    assert set(public.json()["data"]) == {
        "delivered_kg",
        "estimated_meals",
        "active_listings",
        "includes_demo_data",
        "month_start",
        "server_time",
        "meal_weight_kg",
    }
    assert public.json()["data"]["includes_demo_data"] is True
    start = (datetime.now(UTC) - timedelta(days=7)).isoformat()
    end = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    admin = client(104)
    report = admin.get(
        "/api/v1/admin/impact", params={"from": start, "to": end, "grouping": "zone"}
    )
    assert report.status_code == 200, report.text
    summary = report.json()["summary"]
    with db.connect() as c:
        median = c.execute(
            text(
                "SELECT percentile_cont(.5) WITHIN GROUP "
                "(ORDER BY extract(epoch FROM c.claimed_at-l.created_at)) "
                "FROM claims c JOIN food_listings l USING(listing_id) "
                "WHERE l.zone_id=1 AND c.claimed_at>=:start AND c.claimed_at<:end"
            ),
            {"start": datetime.fromisoformat(start), "end": datetime.fromisoformat(end)},
        ).scalar_one()
    assert summary["median_claim_latency_seconds"] == median
    csv_response = admin.get(
        "/api/v1/admin/impact/export", params={"from": start, "to": end, "grouping": "zone"}
    )
    row = next(csv.DictReader(io.StringIO(csv_response.text)))
    for key in ["delivered_kg", "picked_up_kg", "expired_kg", "cancelled_listing_kg"]:
        assert Decimal(row[key]) == Decimal(report.json()["data"][0][key])
    assert client(204).get("/api/v1/admin/impact", params={"zone_id": 1}).status_code == 404


def test_cleared_inbox_is_excluded_from_overview_and_preserves_other_users(workflow):
    db, client, worker = workflow
    with db.begin() as c:
        c.execute(text("""
            INSERT INTO notifications(user_id,event_id,message,type,sent_at)
            VALUES (101,'inbox-regression-1','Synthetic inbox update','InApp',clock_timestamp()),
                   (102,'inbox-regression-2','Other member update','InApp',clock_timestamp())
        """))
    member = client(101)
    other = client(102)
    initial = member.get("/api/v1/workspace/overview").json()["data"]
    assert initial["unread_count"] > 0 and initial["updates"]
    other_initial = other.get("/api/v1/workspace/overview").json()["data"]
    assert post(member, "/notifications/clear", {}).status_code == 200
    assert member.get("/api/v1/notifications").json()["data"] == []
    result = member.get("/api/v1/workspace/overview").json()["data"]
    assert result["unread_count"] == 0 and result["updates"] == []
    assert other.get("/api/v1/workspace/overview").json()["data"] == other_initial
    assert post(member, "/notifications/clear", {}).json()["cleared"] == 0
    with db.begin() as c:
        c.execute(text("""
            INSERT INTO notifications(user_id,event_id,message,type,sent_at)
            VALUES (101,'inbox-regression-3','Fresh visible update','InApp',clock_timestamp())
        """))
    fresh = member.get("/api/v1/workspace/overview").json()["data"]
    assert fresh["unread_count"] == 1
    assert [item["message"] for item in fresh["updates"]] == ["Fresh visible update"]
