"""Community extensions exercise PostgreSQL RLS, locking and atomic commands."""

import secrets
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.access import Access
from app.identity.security import HASHER
from app.main import create_app

from .test_workflows_db import claim, create, post


@pytest.fixture
def community_workflow(seeded_db, identity_settings):
    password = secrets.token_urlsafe(24)
    with seeded_db.begin() as connection:
        connection.execute(
            text("UPDATE users SET password_hash=:hashed"), {"hashed": HASHER.hash(password)}
        )
    with ExitStack() as stack:
        clients = {}

        def client(user_id):
            if user_id not in clients:
                with seeded_db.connect() as connection:
                    email = connection.execute(
                        text("SELECT email FROM users WHERE user_id=:user_id"),
                        {"user_id": user_id},
                    ).scalar_one()
                value = stack.enter_context(
                    TestClient(
                        create_app(identity_settings),
                        headers={
                            "X-Requested-With": "SecondTable",
                            "Origin": "http://127.0.0.1:5173",
                        },
                    )
                )
                login = value.post(
                    "/api/v1/auth/login", json={"email": email, "password": password}
                )
                assert login.status_code == 200
                value.headers["X-CSRF-Token"] = login.json()["data"]["csrf_token"]
                value.actor_client = client
                clients[user_id] = value
            return clients[user_id]

        worker = Access(identity_settings)
        stack.callback(worker.close)
        yield seeded_db, client, worker


pytestmark = pytest.mark.database


def need(**changes):
    return dict(
        food_type="Rice 50%_needed",
        category="Veg",
        quantity_kg="4.00",
        needed_by=(datetime.now(UTC) + timedelta(days=1)).isoformat(),
        note="For our kitchen",
        **changes,
    )


def update(**changes):
    return {
        "kind": "Announcement",
        "title": "Community collection day",
        "body": "Bring food to the collection point.",
        "link": "https://example.com/community",
        "ends_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
        **changes,
    }


def test_request_offers_scope_search_and_delivery_fulfilment(community_workflow):
    workflow = community_workflow
    db, client, _ = workflow
    receiver, donor, volunteer, other, pending = [client(x) for x in [102, 101, 103, 201, 106]]
    response = post(receiver, "/requests", need())
    assert response.status_code == 201, response.text
    rid = response.json()["data"]["id"]
    assert other.get(f"/api/v1/requests/{rid}").status_code == 404
    assert pending.get("/api/v1/requests").status_code == 403
    assert post(donor, "/requests", need()).status_code == 403
    assert len(donor.get("/api/v1/requests", params={"q": "50%25_"}).json()["data"]) == 0
    assert len(donor.get("/api/v1/requests", params={"q": "50%_"}).json()["data"]) == 1
    lid = create(donor)
    key = secrets.token_hex(16)
    offered = post(donor, f"/requests/{rid}/offers", {"listing_id": lid}, key)
    assert offered.status_code == 201, offered.text
    assert post(donor, f"/requests/{rid}/offers", {"listing_id": lid}, key).json() == offered.json()
    assert post(donor, f"/requests/{rid}/offers", {"listing_id": lid}).status_code == 409
    assert post(other, f"/requests/{rid}/offers", {"listing_id": lid}).status_code == 404
    cid = claim(receiver, lid)
    result = post(
        volunteer,
        f"/claims/{cid}/pickups",
        {"scheduled_time": (datetime.now(UTC) + timedelta(minutes=5)).isoformat()},
    )
    pid = result.json()["data"]["pickup_id"]
    for actor in [donor, receiver]:
        assert (
            post(actor, f"/claims/{cid}/pickups/{pid}/schedule", {"version": 1}).status_code == 200
        )
    assert post(volunteer, f"/claims/{cid}/pickups/{pid}/picked-up", {}).status_code == 200
    assert post(volunteer, f"/claims/{cid}/pickups/{pid}/delivered", {}).status_code == 200
    assert receiver.get(f"/api/v1/requests/{rid}").json()["data"]["status"] == "Fulfilled"
    with db.connect() as c:
        assert (
            c.execute(
                text("SELECT count(*) FROM food_request_offers WHERE request_id=:id"), {"id": rid}
            ).scalar_one()
            == 1
        )


def test_requests_close_expiry_capacity_csrf_and_revoked_role(community_workflow):
    workflow = community_workflow
    db, client, _ = workflow
    receiver, donor, admin = client(102), client(101), client(104)
    rid = post(receiver, "/requests", need()).json()["data"]["id"]
    assert (
        receiver.post(
            f"/api/v1/requests/{rid}/close",
            json={"reason": "Enough food"},
            headers={"Idempotency-Key": secrets.token_hex(16), "X-CSRF-Token": "wrong"},
        ).status_code
        == 403
    )
    assert post(donor, f"/requests/{rid}/close", {"reason": "Enough food"}).status_code == 404
    assert post(admin, f"/requests/{rid}/close", {"reason": "Duplicate need"}).status_code == 200
    assert receiver.get(f"/api/v1/requests/{rid}").json()["data"]["status"] == "Closed"
    rid2 = post(receiver, "/requests", need()).json()["data"]["id"]
    with db.begin() as c:
        c.execute(
            text("""
                UPDATE food_requests
                SET created_at=clock_timestamp()-interval '2 days',
                    needed_by=clock_timestamp()-interval '1 day'
                WHERE request_id=:id
            """),
            {"id": rid2},
        )
    assert receiver.get(f"/api/v1/requests/{rid2}").json()["data"]["status"] == "Expired"
    assert post(donor, f"/requests/{rid2}/offers", {"listing_id": create(donor)}).status_code == 409
    with db.begin() as c:
        c.execute(text("UPDATE user_roles SET approved_at=NULL,approved_by=NULL WHERE user_id=102"))
    assert post(receiver, "/requests", need()).status_code == 403


def test_pickup_confirm_reschedule_stale_and_concurrent_accepts(community_workflow):
    workflow = community_workflow
    _, client, _ = workflow
    donor, receiver, volunteer, other = client(101), client(102), client(103), client(201)
    cid = claim(receiver, create(donor))
    pid = post(
        volunteer,
        f"/claims/{cid}/pickups",
        {"scheduled_time": (datetime.now(UTC) + timedelta(minutes=5)).isoformat()},
    ).json()["data"]["pickup_id"]
    path = f"/claims/{cid}/pickups/{pid}/schedule"
    assert post(volunteer, f"/claims/{cid}/pickups/{pid}/picked-up", {}).status_code == 409
    assert post(other, path, {"version": 1}).status_code == 404
    assert post(donor, path, {"version": 1}).status_code == 200
    assert post(volunteer, f"/claims/{cid}/pickups/{pid}/picked-up", {}).status_code == 409
    assert (
        post(
            receiver,
            path,
            {
                "version": 1,
                "scheduled_time": (datetime.now(UTC) + timedelta(minutes=10)).isoformat(),
            },
        ).status_code
        == 200
    )
    assert post(donor, path, {"version": 1}).status_code == 409
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(
            pool.map(lambda x: post(x, path, {"version": 2}).status_code, [donor, volunteer])
        )
    assert statuses == [200, 200]
    booking = receiver.get(f"/api/v1/claims/{cid}").json()["data"]
    assert booking["schedule_version"] == 2 and len(booking["schedule_confirmed_by"]) == 3
    key = secrets.token_hex(16)
    agreed = post(receiver, path, {"version": 2}, key)
    assert post(receiver, path, {"version": 2}, key).json() == agreed.json()
    assert post(volunteer, f"/claims/{cid}/pickups/{pid}/picked-up", {}).status_code == 200
    assert (
        post(
            donor,
            path,
            {
                "version": 2,
                "scheduled_time": (datetime.now(UTC) + timedelta(minutes=15)).isoformat(),
            },
        ).status_code
        == 409
    )


def test_updates_review_pending_visibility_archive_and_zone(community_workflow):
    workflow = community_workflow
    db, client, _ = workflow
    member, admin, pending, other = client(102), client(104), client(106), client(204)
    assert post(member, "/admin/community/updates", update()).status_code == 403
    assert post(pending, "/community/suggestions", update()).status_code == 403
    response = post(member, "/community/suggestions", update())
    assert response.status_code == 201, response.text
    sid = response.json()["data"]["id"]
    assert pending.get("/api/v1/community/updates").json()["data"] == []
    assert other.get("/api/v1/admin/community/suggestions").json()["data"] == []
    assert post(other, f"/admin/community/suggestions/{sid}/publish", {}).status_code == 404
    published = post(admin, f"/admin/community/suggestions/{sid}/publish", {})
    assert published.status_code == 200, published.text
    uid = published.json()["data"]["id"]
    assert pending.get("/api/v1/community/updates").json()["data"][0]["update_id"] == uid
    assert (
        member.get("/api/v1/community/suggestions/mine").json()["data"][0]["status"] == "Published"
    )
    assert post(admin, f"/admin/community/updates/{uid}/archive", {}).status_code == 200
    assert pending.get("/api/v1/community/updates").json()["data"] == []
    sid = post(member, "/community/suggestions", update()).json()["data"]["id"]
    assert (
        post(
            admin,
            f"/admin/community/suggestions/{sid}/reject",
            {"reason": "Details need clarification"},
        ).status_code
        == 200
    )
    assert (
        member.get("/api/v1/community/suggestions/mine").json()["data"][-1]["reason"]
        == "Details need clarification"
    )
    assert (
        post(admin, "/admin/community/updates", update(link="javascript:alert(1)")).status_code
        == 422
    )
    with db.connect() as c:
        assert c.execute(text("SELECT count(*) FROM notification_outbox")).scalar_one() > 0
