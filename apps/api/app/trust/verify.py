"""Reconstruct hashes without calling the database's canonicalization routine."""

import hashlib
import json
import unicodedata
from collections.abc import Iterable, Mapping
from datetime import UTC, datetime
from typing import Any

GENESIS = "0" * 64


def normalize(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int)):
        return value
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value)
    if isinstance(value, list):
        return [normalize(item) for item in value]
    if isinstance(value, dict):
        if any(
            not isinstance(key, str) or key != unicodedata.normalize("NFC", key) for key in value
        ):
            raise ValueError("Ledger keys must be NFC strings")
        return {key: normalize(item) for key, item in value.items()}
    raise ValueError("Ledger values must be JSON without floating point numbers")


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        normalize(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")


def timestamp(value: datetime | str) -> str:
    moment = (
        datetime.fromisoformat(value.replace("Z", "+00:00")) if isinstance(value, str) else value
    )
    if moment.tzinfo is None:
        raise ValueError("Ledger timestamps must include a timezone")
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def envelope(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "v": row["payload_version"],
        "user_id": row["user_id"],
        "sequence": row["sequence"],
        "action_type": row["action_type"],
        "ref_table": row["ref_table"],
        "ref_id": row["ref_id"],
        "claim_id": row["claim_id"],
        "occurred_at": timestamp(row["occurred_at"]),
        "payload": row["payload"],
        "prev_hash": row["prev_hash"],
    }


def verify(rows: Iterable[Mapping[str, Any]]) -> int:
    """Require each supplied user's complete chain, ordered by user and sequence."""
    tails: dict[int, tuple[int, str]] = {}
    count = 0
    for row in rows:
        uid, sequence = row["user_id"], row["sequence"]
        previous_sequence, previous_hash = tails.get(uid, (0, GENESIS))
        if row["payload_version"] != 1:
            raise ValueError(f"User {uid} sequence {sequence}: unsupported payload version")
        if sequence != previous_sequence + 1 or row["prev_hash"] != previous_hash:
            raise ValueError(f"User {uid} sequence {sequence}: broken sequence or previous hash")
        calculated = hashlib.sha256(canonical_bytes(envelope(row))).hexdigest()
        if calculated != row["curr_hash"]:
            raise ValueError(f"User {uid} sequence {sequence}: hash mismatch")
        tails[uid] = (sequence, calculated)
        count += 1
    return count
