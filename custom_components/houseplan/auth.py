"""Single source of truth for the write-authorization policy.

The WS and HTTP paths used to duplicate this decision and drifted apart: the
WS copy was fixed to fail closed while the upload view still failed OPEN when
the config entry was unavailable (audit follow-up B2, 2026-07-27). One helper,
one behaviour.
"""
from __future__ import annotations

from homeassistant.auth.const import GROUP_ID_READ_ONLY
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
    # Default TRUE when the key is absent (audit P0-4, 2026-08-05): the card
    # UI has always been admin-gated, and an unset option must not open every
    # write WS/HTTP path to every authenticated household user.
    admin_only = bool(entry.options.get(CONF_ADMIN_ONLY, True))
    if admin_only:
        return is_admin

    # Turning off ``admin_only`` grants editing to ordinary household users,
    # not to HA's explicitly read-only role (#626).  ``groups`` is part of the
    # supported HA User model; if a non-admin connection cannot provide a
    # complete group list, the safe interpretation is that write permission
    # has not been established.
    groups = getattr(user, "groups", None)
    if not isinstance(groups, list) or not groups:
        return False
    group_ids: list[str] = []
    for group in groups:
        group_id = getattr(group, "id", None)
        if not isinstance(group_id, str):
            return False
        group_ids.append(group_id)
    return GROUP_ID_READ_ONLY not in group_ids
