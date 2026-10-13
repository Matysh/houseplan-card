"""#842 AC3: the K3 «Delete and save» document passes the unchanged backend schema.

`test/fixtures/842-geometry-cleanup.json` is emitted by the production editor
write path (test/helpers/geometry-cleanup-scenarios.mjs) and replayed by
test/geometry-cleanup-842.test.mjs, so this test judges the frontend's actual
output, not a Python reconstruction. The stored plan carries a degenerate
partition that hosts an opening and a column off the canvas.
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest
import voluptuous as vol

from pure_imports import load_pure

_ROOT = Path(__file__).resolve().parent.parent
v = load_pure("hp_validation_842", _ROOT / "custom_components" / "houseplan" / "validation.py")
_FIXTURE = json.loads((_ROOT / "test" / "fixtures" / "842-geometry-cleanup.json").read_text(encoding="utf-8"))


def test_cleaned_document_passes_config_schema_with_unknown_column_fields() -> None:
    cleaned = copy.deepcopy(_FIXTURE["cleaned"])
    validated = v.CONFIG_SCHEMA(cleaned)
    space = validated["spaces"][0]
    assert [item["id"] for item in space["partitions"]] == ["p-host", "p-free"]
    assert [item["id"] for item in space["openings"]] == ["o-room", "o-partition"]
    columns = {item["id"]: item for item in space["wall_columns"]}
    assert set(columns) == {"c-square", "c-round"}
    assert columns["c-square"]["finish"] == "brick"  # WALL_COLUMN_SCHEMA extra=ALLOW_EXTRA
    assert columns["c-round"]["label"] == "pillar"
    assert cleaned == _FIXTURE["cleaned"], "validation does not rewrite the accepted document"


def test_stored_document_with_the_damaged_records_is_rejected() -> None:
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA(copy.deepcopy(_FIXTURE["before"]))


def test_removing_the_partition_without_its_opening_is_rejected() -> None:
    """The mutant «R without openings on partitions»: the backend refuses it."""
    space = copy.deepcopy(_FIXTURE["cleaned"])
    hosted = next(
        item for item in _FIXTURE["before"]["spaces"][0]["openings"] if item["id"] == "o-lost"
    )
    space["spaces"][0]["openings"].append(copy.deepcopy(hosted))
    with pytest.raises(vol.Invalid, match="partition opening host must exist in the same space"):
        v.CONFIG_SCHEMA(space)
