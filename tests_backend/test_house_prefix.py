"""Fixed cross-language byte vector, independent of either classifier."""
import json
from pathlib import Path

import pytest

from custom_components.houseplan.core.house_prefix import (
    canonical_prefix,
    classify_prefix,
)

VECTOR = json.loads((Path(__file__).parents[1] / "test/fixtures/1464-house-prefix.json").read_text())


def test_canonical_first_record_matches_independent_vector():
    raw = bytes.fromhex(VECTOR["prefixHex"])
    assert canonical_prefix() == raw and len(raw) == VECTOR["length"] == 82
    assert classify_prefix(raw) == "house"
    assert classify_prefix(raw + b"opaque unread payload" * 10000) == "house"
    assert classify_prefix(canonical_prefix(2)) == "unsupported"


@pytest.mark.parametrize("offset", [0, 4, 6, 8, 10, 12, 14, 18, 22, 26, 28, 30, 38, 81])
def test_corrupted_or_noncanonical_first_record_does_not_route_as_house(offset):
    raw = bytearray.fromhex(VECTOR["prefixHex"])
    raw[offset] ^= 1
    assert classify_prefix(raw) == "other"


def test_truncated_and_ordinary_archives_do_not_claim_house():
    raw = bytes.fromhex(VECTOR["prefixHex"])
    for length in range(len(raw)):
        assert classify_prefix(raw[:length]) == "other"
    assert classify_prefix(b"PK\x03\x04not a house") == "other"
