"""Entry setup/unload tests (CI)."""
import pytest


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom_components in the test hass."""
    yield

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan.const import DOMAIN


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_setup_creates_runtime_data(hass: HomeAssistant) -> None:
    entry = await _setup(hass)
    assert entry.state.value == "loaded"
    assert entry.runtime_data is not None
    assert entry.runtime_data.store is not None
    assert entry.runtime_data.config_store is not None
    assert entry.runtime_data.virtual_light_store is not None


async def test_setup_tolerates_unreadable_virtual_light_state(
    hass: HomeAssistant, monkeypatch
) -> None:
    """Operational light state must not take the whole integration offline."""
    from custom_components.houseplan.store import HouseplanStore

    real_load = HouseplanStore.async_load

    async def failing_load(self):
        if self.key == "houseplan.virtual_lights":
            raise OSError("corrupt operational store")
        return await real_load(self)

    monkeypatch.setattr(HouseplanStore, "async_load", failing_load)
    entry = await _setup(hass)
    assert entry.state.value == "loaded"


async def test_unload(hass: HomeAssistant) -> None:
    entry = await _setup(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state.value == "not_loaded"


async def test_square_migration_finishes_after_a_crash_between_the_writes(
    hass: HomeAssistant, hass_storage, monkeypatch
) -> None:
    """HP-1490-01, end to end on the real stores.

    The layout write is made to fail once, AFTER the config write succeeded —
    the exact boundary that used to strand the layout in the old coordinates
    forever, because the config write had already deleted the `aspect` fields
    the layout half needed. The durable intent must finish the job on the next
    setup.
    """
    from custom_components.houseplan.store import HouseplanStore

    hass_storage["houseplan.config"] = {
        "version": 1, "data": {
            "config": {"spaces": [{"id": "f1", "aspect": 2.0, "rooms": []}],
                       "markers": [], "settings": {}},
            "rev": 3,
        },
    }
    hass_storage["houseplan.layout"] = {
        "version": 1, "data": {"layout": {"m": {"s": "f1", "x": 0.1, "y": 0.1}}, "rev": 7},
    }

    real_save = HouseplanStore.async_save
    state = {"layout_saves": 0}

    async def failing_save(self, data):
        if self.key == "houseplan.layout" and "geom_pending" not in data:
            state["layout_saves"] += 1
            if state["layout_saves"] == 1:
                raise OSError("disk full at the worst possible moment")
        await real_save(self, data)

    monkeypatch.setattr(HouseplanStore, "async_save", failing_save)

    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options={})
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    # the crash boundary: config migrated, layout not, intent saved
    cfg = hass_storage["houseplan.config"]["data"]["config"]
    assert "aspect" not in cfg["spaces"][0], "the config half committed"
    lay = hass_storage["houseplan.layout"]["data"]
    assert lay["layout"]["m"]["y"] == 0.1, "the layout half did NOT commit"
    assert lay.get("geom_pending") == {"f1": 2.0}, "but the intent is durable"

    # next start: the store write works again
    monkeypatch.setattr(HouseplanStore, "async_save", real_save)
    if entry.state.value == "loaded":
        await hass.config_entries.async_unload(entry.entry_id)
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()

    lay = hass_storage["houseplan.layout"]["data"]
    assert lay["layout"]["m"] == {"s": "f1", "x": 0.1, "y": 0.3}, (
        "the saved intent finished the layout half"
    )
    assert "geom_pending" not in lay, "and left with the layout write"
    cfg = hass_storage["houseplan.config"]["data"]["config"]
    assert cfg["spaces"][0]["view_box"] == [0.0, 0.0, 1.0, 1.0]

    # a third start changes nothing — both triggers are gone
    before = repr(hass_storage["houseplan.layout"]) + repr(hass_storage["houseplan.config"])
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert repr(hass_storage["houseplan.layout"]) + repr(hass_storage["houseplan.config"]) == before
