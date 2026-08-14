"""Pure operational-store rules independent of the HA WebSocket harness.

virtual_lights.py is loaded by path, without importing the HA integration
package: the ordinary `from custom_components.houseplan...` import executes the
package __init__, which unconditionally imports homeassistant — and a missing
homeassistant then breaks pytest collection for the whole tests_backend/
directory, not just this file (#135). test_validation.py established the
pattern; the module itself imports nothing beyond the standard library.
"""
import asyncio
import importlib.util
import os

_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "custom_components", "houseplan", "virtual_lights.py",
)
_spec = importlib.util.spec_from_file_location("hp_virtual_lights", _PATH)
_vl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_vl)

async_reconcile_virtual_lights = _vl.async_reconcile_virtual_lights
async_toggle_virtual_light = _vl.async_toggle_virtual_light
async_virtual_light_snapshot = _vl.async_virtual_light_snapshot
eligible_virtual_light_ids = _vl.eligible_virtual_light_ids


class FakeStore:
    def __init__(self, data=None):
        self.data = data
        self.writes = []

    async def async_load(self):
        return self.data

    async def async_save(self, data):
        self.data = data
        self.writes.append(data)


def _config(*markers):
    return {"spaces": [], "markers": list(markers), "settings": {}}


def _manual(marker_id, **extra):
    return {
        "id": marker_id, "binding": "virtual", "is_light": True,
        "tap_action": "toggle", **extra,
    }


def test_eligibility_is_the_exact_triple_and_hidden_is_not_lifecycle():
    config = _config(
        _manual("eligible", hidden=True),
        _manual("wrong-action", tap_action="info"),
        _manual("wrong-role", is_light=False),
        _manual("removed", removed=True),
        {"id": "ha", "binding": "entity:light.lamp", "is_light": True, "tap_action": "toggle"},
    )
    assert eligible_virtual_light_ids(config) == {"eligible"}


def test_revision_gap_fails_safe_on_and_known_transition_preserves_only_eligible():
    # asyncio.run вместо pytest.mark.asyncio: маркер требует плагина
    # pytest-asyncio, которого в офлайн-окружении без HA нет, и тесты падали бы
    # как «async def not natively supported» — офлайн-гейт обязан быть зелёным.
    store = FakeStore({"rev": 5, "config_rev": 2, "off": ["keep", "drop"]})
    gap = asyncio.run(async_virtual_light_snapshot(store, _config(_manual("keep")), 4))
    assert gap == {"rev": 6, "config_rev": 4, "off": []}

    store = FakeStore({"rev": 8, "config_rev": 4, "off": ["keep", "drop"]})
    carried = asyncio.run(async_reconcile_virtual_lights(
        store,
        _config(_manual("keep", hidden=True), _manual("drop", is_light=False)),
        5,
        previous_config_rev=4,
    ))
    assert carried == {"rev": 9, "config_rev": 5, "off": ["keep"]}


def test_toggle_accepts_only_an_id_and_inverts_server_current_state():
    store = FakeStore()
    config = _config(_manual("lamp"))
    first = asyncio.run(async_toggle_virtual_light(store, config, 1, "lamp"))
    second = asyncio.run(async_toggle_virtual_light(store, config, 1, "lamp"))
    assert first == {"marker_id": "lamp", "on": False, "rev": 1}
    assert second == {"marker_id": "lamp", "on": True, "rev": 2}
    assert asyncio.run(async_toggle_virtual_light(store, config, 1, "missing")) is None
