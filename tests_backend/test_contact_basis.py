"""Pure reference-face validation and relocation; no HA stubs or migrations."""
import copy
import importlib.util
from pathlib import Path

import pytest
import voluptuous as vol

_SPEC = importlib.util.spec_from_file_location(
    "contact_basis_pure_1003", Path(__file__).parents[1] / "custom_components/houseplan/contact_basis.py",
)
assert _SPEC and _SPEC.loader
basis = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(basis)


def entry():
    return {"x": 0.2, "y": 0.3, "s": "floor", "future": {"keep": True}, "contact_basis": {
        "v": 1, "at": {"x": 0.2, "y": 0.3, "s": "floor"},
        "diameter": 0.04, "box": [-0.025375, -0.025375, 0.06, 0.025375],
    }}


def test_new_valid_basis_and_read_are_lossless():
    candidate = {"a": entry()}
    before = copy.deepcopy(candidate)
    assert basis.valid_contact_basis(candidate["a"]["contact_basis"])
    basis.validate_contact_bases(candidate, {})
    assert candidate == before


@pytest.mark.parametrize("patch", [
    {"diameter": 0}, {"diameter": True}, {"diameter": float("nan")}, {"diameter": 10001},
    {"v": True}, {"at": {"x": 0.3, "y": 0.3, "s": "floor"}},
    {"box": [0, 0, 0, 1]}, {"box": [0, 0, float("inf"), 1]}, {"box": [0, 0, 1]},
])
def test_changed_invalid_v1_is_rejected(patch):
    value = entry()
    value["contact_basis"].update(patch)
    with pytest.raises(vol.Invalid, match="invalid device contact basis"):
        basis.validate_contact_bases({"a": value}, {})


def test_unrelated_legacy_and_future_blocks_survive():
    legacy = entry()
    legacy["contact_basis"]["diameter"] = -1
    basis.validate_contact_bases({"a": legacy}, {"a": copy.deepcopy(legacy)})
    future = entry()
    future["contact_basis"] = {"v": 2, "unknown": {"retained": True}}
    before = copy.deepcopy(future)
    basis.validate_contact_bases({"a": future}, {})
    assert not basis.valid_contact_basis(future["contact_basis"])
    assert future == before


def test_space_copy_remaps_only_a_valid_matching_basis():
    value = entry()
    before = copy.deepcopy(value)
    result = basis.remap_contact_basis(value, "upstairs")
    assert result["s"] == result["contact_basis"]["at"]["s"] == "upstairs"
    assert result["future"] == value["future"]
    assert value == before
    stale = entry()
    stale["x"] += 0.01
    assert basis.remap_contact_basis(stale, "upstairs")["contact_basis"] == stale["contact_basis"]
