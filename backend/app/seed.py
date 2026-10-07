"""Atomic, idempotent synthetic fixture import. Existing application data is preserved."""

import hashlib
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import Connection, text

from app.core.config import ROOT

FIXTURE = ROOT / "data/fixtures/demo.json"
IDENTITIES = {
    "zones": "zone_id",
    "users": "user_id",
    "food_listings": "listing_id",
    "claims": "claim_id",
    "pickups": "pickup_id",
    "ratings": "rating_id",
}


def import_demo(connection: Connection, anchor: datetime, path: Path = FIXTURE) -> bool:
    if anchor.tzinfo is None:
        raise ValueError("The fixture anchor must include a timezone")
    anchor = anchor.astimezone(UTC)
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    data: dict[str, Any] = json.loads(raw)
    if not data.get("synthetic") or data.get("fixture_version") != 1:
        raise ValueError("Expected version-1 synthetic fixtures")
    # Serializes two importers before they check seed_runs; never truncate live data.
    connection.execute(text("SELECT pg_advisory_xact_lock(26001,1)"))
    previous = (
        connection.execute(
            text("SELECT fixture_hash,anchor FROM seed_runs WHERE seed_name='demo-v1'")
        )
        .mappings()
        .first()
    )
    if previous:
        if previous["fixture_hash"] != digest or previous["anchor"] != anchor:
            raise ValueError("Demo is already seeded with a different anchor or fixture")
        return False
    for table in IDENTITIES:
        if connection.execute(text(f"SELECT EXISTS(SELECT FROM {table})")).scalar_one():
            raise ValueError(
                "Demo import requires an empty project schema; existing data preserved"
            )
    for table in IDENTITIES:
        for source in data[table]:
            row: dict[str, Any] = {}
            for key, value in source.items():
                if key.endswith("_offset_min"):
                    row[key.removesuffix("_offset_min")] = (
                        anchor + timedelta(minutes=value) if value is not None else None
                    )
                elif key not in {"roles", "capacity_kg"}:
                    row[key] = value
            if table == "users":
                # No reusable demo password in Git. P03 supplies explicit account setup.
                row["password_hash"] = "!disabled-synthetic-fixture"
                row["created_at"] = anchor - timedelta(days=7)
            columns = list(row)
            connection.execute(
                text(
                    f"INSERT INTO {table} ({','.join(columns)}) VALUES "
                    f"({','.join(':' + column for column in columns)})"
                ),
                row,
            )
    for source in data["users"]:
        for role in source["roles"]:
            connection.execute(
                text("""
                INSERT INTO user_roles(user_id,role,approved_at,approved_by)
                VALUES(:uid,:role,:approved,:admin)
            """),
                {
                    "uid": source["user_id"],
                    "role": role,
                    "approved": anchor - timedelta(days=6) if source["verified_status"] else None,
                    "admin": source["zone_id"] * 100 + 4 if source["verified_status"] else None,
                },
            )
        if source["capacity_kg"] is not None:
            connection.execute(
                text("INSERT INTO receiver_profiles(user_id,capacity_kg) VALUES(:uid,:capacity)"),
                {"uid": source["user_id"], "capacity": source["capacity_kg"]},
            )
        connection.execute(
            text("""
            SELECT dbthon_record_event(ARRAY[CAST(:uid AS bigint)],'fixture.imported','users',
              :uid,NULL,CAST(:payload AS jsonb),:moment)
        """),
            {
                "uid": source["user_id"],
                "moment": anchor,
                "payload": json.dumps({"synthetic": True, "fixture_version": 1}),
            },
        )
    for table, column in IDENTITIES.items():
        connection.execute(
            text(
                f"SELECT setval(pg_get_serial_sequence('{table}','{column}'),"
                f"greatest(coalesce(max({column}),1),1),true) FROM {table}"
            )
        )
    connection.execute(
        text("""
        INSERT INTO seed_runs(seed_name,fixture_hash,anchor) VALUES('demo-v1',:digest,:anchor)
    """),
        {"digest": digest, "anchor": anchor},
    )
    return True
