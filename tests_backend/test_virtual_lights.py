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
VirtualLightController = _vl.VirtualLightController


class FakeStore:
    def __init__(self, data=None):
        self.data = data
        self.writes = []

    async def async_load(self):
        return self.data

    async def async_save(self, data):
        self.data = data
        self.writes.append(data)


class FakeHass:
    def __init__(self):
        self.created_tasks = 0

    def async_create_task(self, coroutine):
        self.created_tasks += 1
        return asyncio.create_task(coroutine)


def _config(*markers):
    return {"spaces": [], "markers": list(markers), "settings": {}}


def _manual(marker_id, **extra):
    return {
        "id": marker_id, "binding": "virtual", "is_light": True,
        "tap_action": "toggle", **extra,
    }


def _run(coroutine):
    """Run a pure async helper without replacing pytest's current HA loop."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coroutine)
    finally:
        loop.close()


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
    # A private loop instead of pytest.mark.asyncio keeps the offline suite
    # plugin-free without replacing the current loop owned by the HA harness.
    store = FakeStore({"rev": 5, "config_rev": 2, "off": ["keep", "drop"]})
    gap = _run(async_virtual_light_snapshot(store, _config(_manual("keep")), 4))
    assert gap == {"rev": 6, "config_rev": 4, "off": []}

    store = FakeStore({"rev": 8, "config_rev": 4, "off": ["keep", "drop"]})
    carried = _run(async_reconcile_virtual_lights(
        store,
        _config(_manual("keep", hidden=True), _manual("drop", is_light=False)),
        5,
        previous_config_rev=4,
    ))
    assert carried == {"rev": 9, "config_rev": 5, "off": ["keep"]}


def test_toggle_accepts_only_an_id_and_inverts_server_current_state():
    store = FakeStore()
    config = _config(_manual("lamp"))
    first = _run(async_toggle_virtual_light(store, config, 1, "lamp"))
    second = _run(async_toggle_virtual_light(store, config, 1, "lamp"))
    assert first == {"marker_id": "lamp", "on": False, "rev": 1}
    assert second == {"marker_id": "lamp", "on": True, "rev": 2}
    assert _run(async_toggle_virtual_light(store, config, 1, "missing")) is None


def test_runtime_controller_coalesces_rapid_toggles_into_one_durable_write():
    async def exercise():
        old_delay = _vl.SAVE_DELAY_S
        _vl.SAVE_DELAY_S = 0.01
        try:
            hass = FakeHass()
            store = FakeStore()
            controller = VirtualLightController(hass, store)
            first = await controller.async_toggle(_config(_manual("lamp")), 1, "lamp")
            second = await controller.async_toggle(_config(_manual("lamp")), 1, "lamp")
            await controller.async_flush()
            return first, second, store, hass
        finally:
            _vl.SAVE_DELAY_S = old_delay

    first, second, store, hass = _run(exercise())
    assert first == {"marker_id": "lamp", "on": False, "rev": 1}
    assert second == {"marker_id": "lamp", "on": True, "rev": 2}
    assert store.writes == [{"rev": 2, "config_rev": 1, "off": []}]
    assert hass.created_tasks == 1, "the delayed writer must be tracked by HA"


def test_concurrent_flushes_after_failed_delayed_save_write_once():
    class BlockingStore(FakeStore):
        def __init__(self):
            super().__init__()
            self.entered = 0
            self.release = asyncio.Event()

        async def async_save(self, data):
            self.entered += 1
            await self.release.wait()
            await super().async_save(data)

    async def exercise():
        store = BlockingStore()
        controller = VirtualLightController(FakeHass(), store)
        # This is the exact state left by a failed delayed save: the newest
        # payload is dirty, while its completed task has already detached.
        controller._state = {"rev": 1, "config_rev": 1, "off": ["lamp"]}
        controller._dirty = True
        controller._save_task = None

        first = asyncio.create_task(controller.async_flush())
        second = asyncio.create_task(controller.async_flush())
        for _ in range(3):
            await asyncio.sleep(0)
        entered_before_release = store.entered
        store.release.set()
        await asyncio.gather(first, second)
        return entered_before_release, store.writes

    entered, writes = _run(exercise())
    assert entered == 1, "only one concurrent flush may reach durable storage"
    assert writes == [{"rev": 1, "config_rev": 1, "off": ["lamp"]}]
