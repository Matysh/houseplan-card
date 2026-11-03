"""#1223: projected Low-only settings cross both closed support boundaries."""
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path
import sys

import pytest

from custom_components.houseplan import support_wire_schema as canonical
from custom_components.houseplan.support_package import build_support_package
from tests_backend.test_support_package import _facts, _source


@pytest.fixture
def validators():
    path = Path(__file__).parents[1] / "scripts/support-relay/hp_relay/support_wire_schema.py"
    spec = importlib.util.spec_from_file_location("support_wire_lqi1223", path)
    relay = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = relay
    try:
        spec.loader.exec_module(relay)
        yield canonical, relay
    finally:
        del sys.modules[spec.name]


def package_for(global_mode="low", space_mode="low"):
    config, layout, forbidden = _source()
    config["settings"]["show_lqi"] = global_mode
    config["spaces"][0].setdefault("settings", {})["show_lqi_mode"] = space_mode
    before = copy.deepcopy(config)
    raw, _ = build_support_package(
        config, layout, config_rev=17, layout_rev=24,
        card_version="1.84.0-beta.2", integration_version="1.84.0-beta.2",
        home_assistant_version="2026.10.4", runtime=_facts(),
        namespace="lqi1223", package_version=2,
    )
    assert config == before
    assert all(value not in raw.decode() for value in forbidden)
    return json.loads(raw)


@pytest.mark.parametrize("global_mode", [True, False, "low"])
@pytest.mark.parametrize("space_mode", ["inherit", "on", "low", "off"])
def test_projected_lqi_modes_pass_both_real_wire_validators(validators, global_mode, space_mode):
    package = package_for(global_mode, space_mode)
    config = package["plan_backup"]["config"]
    assert config["settings"]["show_lqi"] == global_mode
    assert config["spaces"][0]["settings"]["show_lqi_mode"] == space_mode
    for validator in validators:
        validator.validate_package(package)


@pytest.mark.parametrize("scope,value", [
    ("global", value) for value in (0, 1, "on", "LOW", [], {})
] + [
    ("space", value) for value in (None, True, False, 0, 1, "LOW", [], {})
])
def test_lqi_wire_rejects_wrong_types_and_values(validators, scope, value):
    package = package_for()
    config = package["plan_backup"]["config"]
    settings = config["settings"] if scope == "global" else config["spaces"][0]["settings"]
    settings["show_lqi" if scope == "global" else "show_lqi_mode"] = value
    for validator in validators:
        with pytest.raises(validator.WireRejected):
            validator.validate_package(package)


@pytest.mark.parametrize("scope", ["global", "space"])
def test_lqi_support_settings_remain_closed(validators, scope):
    package = package_for()
    config = package["plan_backup"]["config"]
    settings = config["settings"] if scope == "global" else config["spaces"][0]["settings"]
    settings["unknown_lqi_private"] = "not part of the wire contract"
    for validator in validators:
        with pytest.raises(validator.WireRejected):
            validator.validate_package(package)
