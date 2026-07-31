"""The map sensor of the stand simulator — Tasshack-shaped attributes.

`vacuum_position` is a plain dict on purpose: the real Tasshack integration
keeps a Point OBJECT in memory (houseplan's trail recorder handles both), but
a dict is what any template/attribute tooling on the stand can also read.
"""
from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.core import HomeAssistant

from . import DOMAIN, ROOMS, RobotSim


async def async_setup_platform(hass: HomeAssistant, config, add_entities, discovery_info=None) -> None:
    add_entities([DemoRobotMap(hass.data[DOMAIN])])


class DemoRobotMap(SensorEntity):
    _attr_should_poll = False
    _attr_name = "Карта робота-пылесоса"
    _attr_unique_id = "demo_robot_map"
    _attr_icon = "mdi:map"

    def __init__(self, sim: RobotSim) -> None:
        self._sim = sim
        self.entity_id = "sensor.demo_robot_map"

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self._sim.add_listener(self.async_write_ha_state))

    @property
    def native_value(self) -> str:
        return self._sim.state

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        x, y = self._sim.pos
        return {
            "vacuum_position": {
                "x": round(x, 1),
                "y": round(y, 1),
                "a": round(self._sim.heading, 1),
            },
            "rooms": {
                rid: {
                    "name": name,
                    "x0": x0, "y0": y0, "x1": x1, "y1": y1,
                    "x": (x0 + x1) / 2, "y": (y0 + y1) / 2,
                }
                for rid, (name, x0, y0, x1, y1) in ROOMS.items()
            },
            "map_index": 1,
        }
