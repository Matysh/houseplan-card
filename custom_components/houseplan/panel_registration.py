"""Register the House Plan application panel with strict lifecycle ownership."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping
from dataclasses import dataclass, field
from functools import partial
from pathlib import Path
from typing import Literal

from homeassistant.components import frontend, panel_custom
from homeassistant.core import HomeAssistant, callback

from .const import (
    DOMAIN,
    PANEL_COMPONENT_NAME,
    PANEL_FRONTEND_URL,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL,
    PANEL_URL_PATH,
    VERSION,
)
from .frontend_registration import async_register_frontend_static_path
from .store import HouseplanConfigEntry

_LOGGER = logging.getLogger(__name__)

PANEL_REGISTRATION_KEY = "panel_registration"
PANEL_GENERATION_KEY = "panel_generation"

PanelStatus = Literal[
    "not_attempted",
    "registered",
    "missing_asset",
    "collision",
    "static_error",
    "registration_error",
    "ownership_error",
    "removed",
]


@dataclass(slots=True)
class PanelRegistrationState:
    """Observable state for one config-entry setup generation."""

    panel_file_present: bool
    generation: int
    panel_static_path_registered: bool = False
    panel_status: PanelStatus = "not_attempted"
    panel_url: str | None = None
    panel_module_url: str | None = None
    panel_error: str | None = None
    _owned_panel: object | None = field(default=None, repr=False)


def _safe_error(phase: str, err: BaseException) -> str:
    """Return a support-safe fingerprint without an exception message."""
    return f"{phase}:{type(err).__name__}"


def _panel_registry(hass: HomeAssistant) -> Mapping[str, object] | None:
    """Read HA's in-memory panel registry without mutating private storage."""
    key = getattr(frontend, "DATA_PANELS", None)
    if not isinstance(key, str):
        return None
    panels = hass.data.get(key)
    return panels if isinstance(panels, Mapping) else None


def _is_current(hass: HomeAssistant, state: PanelRegistrationState) -> bool:
    """Return whether state still owns the current setup generation."""
    domain_data = hass.data.get(DOMAIN, {})
    return (
        domain_data.get(PANEL_REGISTRATION_KEY) is state
        and domain_data.get(PANEL_GENERATION_KEY) == state.generation
    )


@callback
def _remove_owned_panel(hass: HomeAssistant, state: PanelRegistrationState) -> None:
    """Remove only the exact registry object owned by this generation."""
    if not _is_current(hass, state) or state._owned_panel is None:
        return

    panels = _panel_registry(hass)
    if panels is None:
        # An unknown registry shape is not authority to remove a route by name.
        return
    if panels.get(PANEL_URL_PATH) is not state._owned_panel:
        # The route was removed or replaced outside this integration.  It is no
        # longer ours, and a later cleanup must not reconsider that identity.
        state._owned_panel = None
        state.panel_status = "removed"
        state.panel_url = None
        state.panel_module_url = None
        return

    try:
        # Keep the HA 2024.6-compatible two-argument call.  In particular, do
        # not pass the newer warn_if_unknown keyword.
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
    except Exception as err:  # noqa: BLE001 - unload remains fail-soft
        fingerprint = _safe_error("remove", err)
        state.panel_error = fingerprint
        _LOGGER.warning("Could not remove the owned House Plan panel (%s)", fingerprint)
        return

    state._owned_panel = None
    state.panel_status = "removed"
    state.panel_url = None
    state.panel_module_url = None


@callback
def remove_panel_registration(hass: HomeAssistant) -> None:
    """Idempotently clean up the current owned panel, if one still exists."""
    state = get_panel_registration_state(hass)
    if state is not None:
        _remove_owned_panel(hass, state)


async def async_setup_panel_registration(
    hass: HomeAssistant,
    entry: HouseplanConfigEntry,
    panel_path: Path,
) -> PanelRegistrationState:
    """Register the panel last without making integration setup depend on it."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    previous = domain_data.get(PANEL_REGISTRATION_KEY)
    if isinstance(previous, PanelRegistrationState):
        # Normally entry unload already did this.  Keeping setup self-contained
        # also makes a direct repeated setup deterministic and duplicate-free.
        _remove_owned_panel(hass, previous)

    old_generation = domain_data.get(PANEL_GENERATION_KEY)
    generation = old_generation + 1 if isinstance(old_generation, int) else 1
    domain_data[PANEL_GENERATION_KEY] = generation

    panel_file_present = panel_path.is_file()
    state = PanelRegistrationState(
        panel_file_present=panel_file_present,
        generation=generation,
    )
    domain_data[PANEL_REGISTRATION_KEY] = state

    if not panel_file_present:
        state.panel_status = "missing_asset"
        _LOGGER.warning("houseplan-panel.js was not found next to the integration")
        return state

    static_outcome = await async_register_frontend_static_path(
        hass, PANEL_FRONTEND_URL, panel_path
    )
    state.panel_static_path_registered = static_outcome.registered
    if not static_outcome.registered:
        state.panel_status = "static_error"
        state.panel_error = static_outcome.last_error
        _LOGGER.warning(
            "Could not register the House Plan panel static path (%s)",
            static_outcome.last_error or "static_path:UnknownError",
        )
        return state

    module_url = f"{PANEL_FRONTEND_URL}?v={VERSION}"
    try:
        await panel_custom.async_register_panel(
            hass=hass,
            frontend_url_path=PANEL_URL_PATH,
            webcomponent_name=PANEL_COMPONENT_NAME,
            sidebar_title=PANEL_TITLE,
            sidebar_icon=PANEL_ICON,
            module_url=module_url,
            embed_iframe=False,
            trust_external=False,
            require_admin=False,
        )
    except asyncio.CancelledError:
        raise
    except ValueError as err:
        state.panel_error = _safe_error("registration", err)
        panels = _panel_registry(hass)
        if panels is not None and PANEL_URL_PATH in panels:
            state.panel_status = "collision"
            _LOGGER.warning(
                "House Plan cannot register /%s because that panel route is "
                "already in use; open House Plan in System Health for details",
                PANEL_URL_PATH,
            )
        else:
            state.panel_status = "registration_error"
            _LOGGER.warning(
                "Could not register the House Plan panel (%s)", state.panel_error
            )
        return state
    except Exception as err:  # noqa: BLE001 - the card/backend remain available
        state.panel_status = "registration_error"
        state.panel_error = _safe_error("registration", err)
        _LOGGER.warning(
            "Could not register the House Plan panel (%s)", state.panel_error
        )
        return state

    panels = _panel_registry(hass)
    owned_panel = panels.get(PANEL_URL_PATH) if panels is not None else None
    if owned_panel is None:
        # The public register API has no ownership return value.  If the exact
        # object cannot be captured now, leaving a route until a later blind
        # cleanup would be unsafe.  Remove the just-created route immediately.
        state.panel_status = "ownership_error"
        state.panel_error = "ownership:Unavailable"
        try:
            frontend.async_remove_panel(hass, PANEL_URL_PATH)
        except Exception as err:  # noqa: BLE001 - setup must still succeed
            _LOGGER.warning(
                "Could not clean up an unowned House Plan panel (%s)",
                _safe_error("ownership_remove", err),
            )
        _LOGGER.warning(
            "House Plan panel ownership could not be verified; the panel was removed"
        )
        return state

    state._owned_panel = owned_panel
    state.panel_status = "registered"
    state.panel_url = PANEL_URL
    state.panel_module_url = module_url
    entry.async_on_unload(partial(_remove_owned_panel, hass, state))
    return state


@callback
def get_panel_registration_state(
    hass: HomeAssistant,
) -> PanelRegistrationState | None:
    """Return the current panel state for System Health."""
    state = hass.data.get(DOMAIN, {}).get(PANEL_REGISTRATION_KEY)
    return state if isinstance(state, PanelRegistrationState) else None
