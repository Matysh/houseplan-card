"""Single source of truth for the write-authorization policy.

The WS and HTTP paths used to duplicate this decision and drifted apart: the
WS copy was fixed to fail closed while the upload view still failed OPEN when
the config entry was unavailable (audit follow-up B2, 2026-07-27). One helper,
one behaviour.
"""
from __future__ import annotations

from homeassistant.core import HomeAssistant

from .const import CONF_ADMIN_ONLY
from .store import get_entry


def may_write(hass: HomeAssistant, user) -> bool:
    """True when `user` may modify House Plan data.

    Fails CLOSED: when the entry cannot be read — during a reload, or while the
    integration is disabled — the policy is unknown, and "unknown" is not the
    same as "permissive": only admins are allowed through.
    """
    is_admin = bool(getattr(user, "is_admin", False))
    entry = get_entry(hass)
    if entry is None:
        return is_admin
    admin_only = bool(entry.options.get(CONF_ADMIN_ONLY, False))
    return is_admin if admin_only else True
