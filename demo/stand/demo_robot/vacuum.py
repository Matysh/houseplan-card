"""The vacuum entity of the stand simulator."""
from __future__ import annotations

from typing import Any

from homeassistant.components.vacuum import (
    StateVacuumEntity,
    VacuumActivity,
    VacuumEntityFeature,
)
from homeassistant.core import HomeAssistant

from . import DOMAIN, RobotSim

ACTIVITY = {
    "docked": VacuumActivity.DOCKED,
    "cleaning": VacuumActivity.CLEANING,
    "paused": VacuumActivity.PAUSED,
    "returning": VacuumActivity.RETURNING,
}


async def async_setup_platform(hass: HomeAssistant, config, add_entities, discovery_info=None) -> None:
    add_entities([DemoRobotVacuum(hass.data[DOMAIN])])


class DemoRobotVacuum(StateVacuumEntity):
    _attr_should_poll = False
    _attr_name = "Робот-пылесос"
    _attr_unique_id = "demo_robot_vacuum"
    _attr_supported_features = (
        VacuumEntityFeature.START
        | VacuumEntityFeature.STOP
        | VacuumEntityFeature.PAUSE
        | VacuumEntityFeature.RETURN_HOME
        | VacuumEntityFeature.STATE
    )

    def __init__(self, sim: RobotSim) -> None:
        self._sim = sim
        self.entity_id = "vacuum.demo_robot"

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self._sim.add_listener(self.async_write_ha_state))

    @property
    def activity(self) -> VacuumActivity:
        return ACTIVITY.get(self._sim.state, VacuumActivity.IDLE)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        # the card resolves the active map name through the vacuum entity
        return {"selected_map": "1"}

    async def async_start(self) -> None:
        self._sim.start()

    async def async_pause(self) -> None:
        self._sim.pause()

    async def async_stop(self, **kwargs: Any) -> None:
        self._sim.stop()

    async def async_return_to_base(self, **kwargs: Any) -> None:
        self._sim.return_to_base()
