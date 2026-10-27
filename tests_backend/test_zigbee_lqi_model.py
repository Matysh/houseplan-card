"""Strict ordinary negative inputs; no mutations of the implementation."""
import json
from types import SimpleNamespace

import pytest

from custom_components.houseplan.zigbee_lqi_model import (
    MAX_INVENTORY_BYTES,
    config_entry_ids,
    device_entries,
    inventory_of,
    lqi_number,
    registry_ieee,
)


@pytest.mark.parametrize("raw,expected", [(0, 0), (255, 255), ("12.5", 12.5), (" 0 ", 0),
    (True, None), (False, None), (None, None), ("", None), ("3abc", None), ("NaN", None),
    (float("nan"), None), (float("inf"), None), (-1, None), (256, None), ({}, None)])
def test_lqi_is_a_whole_finite_number_in_range(raw, expected):
    assert lqi_number(raw) == expected


def test_inventory_exact_nested_addresses_collisions_and_limits():
    def row(ieee, name):
        return {"ieee_address": f"0x{ieee:016x}", "friendly_name": name}
    assert inventory_of(json.dumps([row(1, "floor/room/device")])) == {"0000000000000001": "floor/room/device"}
    for rows in [[row(1, "a"), row(2, "a")], [row(1, "a"), row(1, "b")],
                 [row(1, "a"), row(2, "a/linkquality")], [row(1, "bad/#")],
                 [row(1, "bridge/devices")], [row(i, f"d{i}") for i in range(1501)]]:
        assert inventory_of(json.dumps(rows)) is None
    assert inventory_of(b"[broken") is None
    assert inventory_of(b" " * (MAX_INVENTORY_BYTES + 1)) is None
    assert inventory_of(b"[" + b" " * MAX_INVENTORY_BYTES + b"]") is None, "even valid empty oversized JSON is refused before parsing"


def test_other_mqtt_integrations_cannot_claim_a_z2m_radio_from_a_bare_ieee():
    assert registry_ieee("mqtt", "0000000000000001") is None
    assert registry_ieee("mqtt", "another_0000000000000001") is None
    assert registry_ieee("mqtt", "zigbee2mqtt_0x0000000000000001") == "0000000000000001"
    assert registry_ieee("zha", "00:00:00:00:00:00:00:01") == "0000000000000001"


def test_registry_api_legacy_mapping_modern_collection_and_composite_entry():
    legacy = SimpleNamespace(id="old", config_entries={"a", "b"})
    modern = SimpleNamespace(id="new", config_entry_id="c")
    composite = SimpleNamespace(id="composite", is_composite_device=True,
                                config_entry_id=None, config_entries={"d", "e"})
    assert config_entry_ids(legacy) == {"a", "b"}
    assert config_entry_ids(modern) == {"c"}
    assert config_entry_ids(composite) == {"d", "e"}
    assert config_entry_ids(SimpleNamespace(config_entry_id=None)) == set()
    assert list(device_entries(SimpleNamespace(devices={"old": legacy}))) == [legacy]
    assert list(device_entries(SimpleNamespace(devices=[modern, composite]))) == [modern, composite]
