"""Home Assistant actions to show and clear a signal on the plan."""
from __future__ import annotations

from asyncio import sleep
import logging
import re

import voluptuous as vol
from homeassistant.core import callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv, service

from .const import DOMAIN
from .external_alerts import AlertActionError, ExternalAlerts, LEVELS, Target
from .store import get_data

_LOGGER = logging.getLogger(__name__)
_KEY = re.compile(r"[A-Za-z0-9_-]{1,64}")
_MAX_AUTOMATION_CONTEXTS = 256


def _one_target(value):
    if ("device_id" in value) == ("entity_id" in value):
        raise vol.Invalid("Select exactly one Home Assistant device or entity")
    return value


def _key(value):
    if not isinstance(value, str):
        raise vol.Invalid("The signal key must be text")
    value = value.strip()
    if value and not _KEY.fullmatch(value):
        raise vol.Invalid("Use up to 64 letters, digits, underscores or hyphens for a signal key")
    return value or None


def _message(value):
    if not isinstance(value, str):
        raise vol.Invalid("The reason must be text")
    value = value.strip()
    if len(value) > 255 or len(value.splitlines()) > 1:
        raise vol.Invalid("The reason must fit on one line of up to 255 characters")
    return value or None


_TARGET_FIELDS = {
    vol.Optional("device_id"): vol.All(str, vol.Length(min=1, max=128)),
    vol.Optional("entity_id"): cv.entity_id,
    vol.Optional("key"): _key,
}
CLEAR_ALERT_SCHEMA = vol.All(vol.Schema(_TARGET_FIELDS), _one_target)
SET_ALERT_SCHEMA = vol.All(vol.Schema({
    **_TARGET_FIELDS,
    vol.Optional("level", default="attention"): vol.In(LEVELS),
    vol.Optional("message"): _message,
}), _one_target)


@callback
def async_setup_services(hass):
    domain = hass.data.setdefault(DOMAIN, {})
    if "external_alerts" in domain:
        return
    alerts = domain["external_alerts"] = ExternalAlerts(hass)
    hass.bus.async_listen("entity_registry_updated", alerts.remove_deleted_targets)
    hass.bus.async_listen("device_registry_updated", alerts.remove_deleted_targets)
    automation_sources: dict[str, str] = {}

    @callback
    def remember_automation(event):
        entity_id = event.data.get("entity_id")
        if isinstance(entity_id, str) and entity_id.startswith("automation."):
            automation_sources[event.context.id] = entity_id
            if len(automation_sources) > _MAX_AUTOMATION_CONTEXTS:
                del automation_sources[next(iter(automation_sources))]

    hass.bus.async_listen("automation_triggered", remember_automation)

    async def apply(call):
        runtime = get_data(hass)
        if runtime is None:
            raise AlertActionError("alerts_unavailable")
        data = call.data
        level = data["level"] if call.service == "set_alert" else None
        # An automation state can also carry the context of a call that turned
        # it off. Use only a recorded start with the same context.
        source = None
        if level:
            # HA defers a nested automation_triggered event until it finishes
            # dispatching the trigger that started the automation.
            await sleep(0)
            source = automation_sources.get(call.context.id)
        try:
            await alerts.change(
                runtime, Target.from_call(hass, data), data.get("key"),
                level, data.get("message"), source,
            )
        except HomeAssistantError:
            raise
        except (OSError, ValueError, KeyError, TypeError) as err:
            # Store errors may contain the user-entered reason. Keep it out of logs.
            _LOGGER.error("House Plan: external signal storage failed (%s)", type(err).__name__)
            raise AlertActionError("alerts_unavailable") from None

    service.async_register_admin_service(hass, DOMAIN, "set_alert", apply, SET_ALERT_SCHEMA)
    service.async_register_admin_service(hass, DOMAIN, "clear_alert", apply, CLEAR_ALERT_SCHEMA)
