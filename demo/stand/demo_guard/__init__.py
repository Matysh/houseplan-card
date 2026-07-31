"""Stand-only guard: keep visitor-admins from killing the public demo.

Visitors log in as `demo`, and that user HAS to be an administrator — the
House Plan card gates its editor on `user.is_admin`, and demonstrating the
editor is the whole point of the stand. But an administrator can also call
`homeassistant.restart` / `homeassistant.stop`, and visitors do exactly that
(seen live 2026-07-31: HA exited with the restart code 100 minutes after a
scheduled reset, right as a visitor session from an external IP was active —
that is what looked like «стенд перезагружается чаще, чем раз в час»).

Once startup finishes this component re-registers both services as no-ops:
the UI buttons stay, pressing them only leaves a WARNING in the log. The
hourly stand reset is NOT affected — hp-reset.timer restarts the docker
container from the outside.
"""
from __future__ import annotations

import logging

from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.helpers.typing import ConfigType

_LOGGER = logging.getLogger(__name__)

DOMAIN = "demo_guard"
BLOCKED = ("restart", "stop")


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    async def _blocked(call: ServiceCall) -> None:
        _LOGGER.warning(
            "демо-стенд: homeassistant.%s отключён для посетителей "
            "(стенд и так сбрасывается сам, ежечасно в :00)",
            call.service,
        )

    @callback
    def _neuter(_event) -> None:
        # After EVENT_HOMEASSISTANT_STARTED every core service is in place;
        # registering the same domain/name again replaces the handler.
        for service in BLOCKED:
            hass.services.async_register("homeassistant", service, _blocked)

    hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _neuter)
    return True
