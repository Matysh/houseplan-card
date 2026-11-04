"""#1287: only owners removed by an explicit gesture authorize layout cleanup."""
from copy import deepcopy

import pytest
import voluptuous as vol

from custom_components.houseplan.deletion_layout import deletion_layout_candidate


def test_cleanup_and_label_restore_preserve_foreign_and_unverified_positions():
    before = {"spaces": [{"id": "f", "rooms": [{"id": "a"}, {"id": "b"}]}],
              "markers": [{"id": "m", "binding": "virtual"}]}
    after = deepcopy(before)
    after["spaces"][0]["rooms"] = [{"id": "b"}]
    after["markers"] = []
    layout = {"rl_a": {"x": .25, "y": .25, "s": "f", "opaque": 7},
              "rl_b": {"x": .5, "y": .5, "s": "f"}, "m": {"x": .75, "y": .75, "s": "f"},
              "unverified": {"x": .25, "y": .5, "s": "foreign"}}
    original = deepcopy(layout)
    positions, changes = deletion_layout_candidate(before, after, layout)
    assert changes == {"rl_a": None, "m": None}
    assert positions == {"rl_b": layout["rl_b"], "unverified": layout["unverified"]}
    restored, delta = deletion_layout_candidate(after, before, positions, {"rl_a": layout["rl_a"]})
    assert restored["rl_a"] == layout["rl_a"]
    assert delta == {"rl_a": layout["rl_a"]}
    assert layout == original
    foreign = {"rl_a": {"x": .25, "y": .25, "s": "other"}}
    assert deletion_layout_candidate(before, after, foreign)[0] == foreign


@pytest.mark.parametrize("patch", [{"unknown": None}, {"rl_a": {"x": 0, "y": 0, "s": "other"}},
                                  {"rl_missing": {"x": 0, "y": 0, "s": "f"}}])
def test_label_patch_cannot_replace_unrelated_layout(patch):
    config = {"spaces": [{"id": "f", "rooms": [{"id": "a"}]}]}
    with pytest.raises(vol.Invalid):
        deletion_layout_candidate(config, config, {}, patch)


def test_new_tombstone_removes_only_its_implicit_position_and_old_tombstones_are_opaque():
    before = {"spaces": [], "markers": [{"id": "old", "removed": True}]}
    after = {**before, "markers": [*before["markers"], {"id": "new", "removed": True}]}
    layout = {"old": {"x": 0, "y": 0}, "new": {"x": 1, "y": 1}, "unverified": {"x": 2, "y": 2}}
    positions, changes = deletion_layout_candidate(before, after, layout)
    assert changes == {"new": None}
    assert positions == {"old": layout["old"], "unverified": layout["unverified"]}
