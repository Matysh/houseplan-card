"""#1228: the raw saved-model10 boundary must precede graph migration."""
from copy import deepcopy

import pytest

from custom_components.houseplan.opening_repair import _place_on_wall, repair_imported_openings
from custom_components.houseplan.validation import CONFIG_SCHEMA
from custom_components.houseplan.wall_segment_model import (
    _wall_key,
    commit_wall_segment_model,
    decode_legacy_wall_segment_model,
)


def _two_carriers(gap=0.00005):
    # By default two carriers lie inside the import placement tolerance.
    upper = [[.2, .1], [.6, .1], [.6, .2], [.2, .2]]
    lower = [[.2, .2 + gap], [.6, .2 + gap], [.6, .4], [.2, .4]]
    config, _ = decode_legacy_wall_segment_model({
        "model_version": 9, "spaces": [{
            "id": "ground", "title": "Ground", "view_box": [0, 0, 1, 1],
            "rooms": [{"id": "upper", "name": "Upper", "poly": upper},
                      {"id": "lower", "name": "Lower", "poly": lower}],
            "walls": [{"key": _wall_key(p[i], p[(i + 1) % 4]),
                       "a": p[i], "b": p[(i + 1) % 4], "cm": 15}
                      for p in (upper, lower) for i in range(4)],
            "openings": [],
        }], "markers": [], "settings": {},
    })
    assert config["model_version"] == 10
    assert "plan_graph" not in config["spaces"][0]
    opening = {"id": "door", "type": "door", "x": .4, "y": .2 + gap / 2,
               "angle": 0, "length": .08, "lock": "lock.front",
               "contact": "binary_sensor.front",
               "host": {"kind": "wall", "id": "gone", "t": .5}}
    return config, opening


@pytest.mark.parametrize("model,expected", [(8, "rehosted"), (9, "rehosted"), (10, "detached")])
def test_raw_legacy_import_retains_its_own_carrier_policy(model, expected):
    config, opening = _two_carriers()
    config["model_version"] = model
    config["spaces"][0]["openings"] = [opening]
    before = deepcopy(config)
    report = repair_imported_openings(config, model)
    assert report[expected] == 1
    assert report["rehosted"] + report["detached"] == 1
    assert report["examples"][0]["result"] == expected
    assert {k: v for k, v in opening.items() if k not in ("host", "x", "y")} == {
        k: v for k, v in before["spaces"][0]["openings"][0].items() if k not in ("host", "x", "y")}
    if model == 10:
        assert opening == {k: v for k, v in before["spaces"][0]["openings"][0].items() if k != "host"}
    assert {k: v for k, v in config["spaces"][0].items() if k != "openings"} == {
        k: v for k, v in before["spaces"][0].items() if k != "openings"}
    validated = CONFIG_SCHEMA(deepcopy(config))
    current, _ = commit_wall_segment_model(validated)
    host = current["spaces"][0]["openings"][0].get("host")
    assert ({k: v for k, v in host.items() if k != "tq"} if host else host) == opening.get("host")
    assert commit_wall_segment_model(current)[0] == current
    assert repair_imported_openings(config, model)["detached"] == 0


def test_saved_model10_can_still_repair_onto_its_only_eligible_carrier():
    config, opening = _two_carriers(gap=.03)
    opening["y"] = .20001
    config["spaces"][0]["openings"] = [opening]
    report = repair_imported_openings(config, 10)
    assert (report["rehosted"], report["detached"]) == (1, 0)
    assert opening["y"] == .2
    assert opening["lock"] == "lock.front" and opening["length"] == .08
    current, _ = commit_wall_segment_model(CONFIG_SCHEMA(deepcopy(config)))
    assert current["spaces"][0]["openings"][0]["host"]["id"] == opening["host"]["id"]


def test_current_graph_still_requires_a_unique_eligible_carrier():
    config, opening = _two_carriers()
    current, _ = commit_wall_segment_model(config)
    space = current["spaces"][0]
    assert current["model_version"] == 11 and space["plan_graph"]
    space["openings"] = [opening]
    before = deepcopy(current)
    assert _place_on_wall(space, opening, space["wall_segments"], 11) is None
    assert current == before
