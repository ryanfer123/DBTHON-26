import pytest

from app.trust.verify import canonical_bytes, timestamp


def test_canonical_unicode_and_integer_contract():
    assert canonical_bytes({"z": [True, None, 1], "a": "e\u0301"}) == (
        '{"a":"é","z":[true,null,1]}'.encode()
    )
    assert timestamp("2026-10-05T17:30:00+05:30") == "2026-10-05T12:00:00.000000Z"
    for bad in [{"mass": 1.25}, {"e\u0301": 1}, {1: "key"}]:
        with pytest.raises(ValueError):
            canonical_bytes(bad)
    with pytest.raises(ValueError, match="timezone"):
        timestamp("2026-10-05T12:00:00")
