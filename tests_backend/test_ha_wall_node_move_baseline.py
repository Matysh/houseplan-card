"""#1102: node movement may reuse only an exact-revision junction baseline."""
import copy

import pytest
from test_ha_wall_node_delete import setup
from test_wall_node_move import fixture, intent

from custom_components.houseplan import junction_limits as limits
from custom_components.houseplan import websocket_api as endpoint
from custom_components.houseplan.store import get_data


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


@pytest.mark.parametrize("cache", ["exact", "stale", "missing"])
async def test_issue_1102_node_move_junction_baseline_has_exact_revision_authority(
    hass, hass_ws_client, monkeypatch, cache,
):
    _, client, snapshot = await setup(hass, hass_ws_client, source=fixture())
    rt = get_data(hass)
    original = endpoint.validate_junction_limits
    counts = original(snapshot["config"], snapshot["config"])
    rt.junction_baseline = None if cache == "missing" else (snapshot["rev"] + (cache == "stale"), counts)
    observed, previous_reads = [], []
    migrate = limits._migrated_spaces

    def record_previous(config, *, side="previous"):
        if side == "previous":
            previous_reads.append(config)
        return migrate(config, side=side)

    def record(config, previous=None, **kwargs):
        observed.append(copy.deepcopy(kwargs.get("baseline_counts")))
        return original(config, previous, **kwargs)

    monkeypatch.setattr(limits, "_migrated_spaces", record_previous)
    monkeypatch.setattr(endpoint, "validate_junction_limits", record)
    await client.send_json_auto_id({
        "type": "houseplan/wall/node_move", "space_id": "f", "intent": intent(),
        "expected_rev": snapshot["rev"],
    })
    accepted = await client.receive_json()
    assert accepted["success"], accepted
    assert observed == [counts if cache == "exact" else None]
    assert len(previous_reads) == (0 if cache == "exact" else 1)
    assert rt.junction_baseline == (accepted["result"]["rev"], counts)
    assert (await rt.config_store.async_load())["config"] == accepted["result"]["config"]