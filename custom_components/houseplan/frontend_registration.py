"""Register the House Plan card with the Home Assistant frontend."""
from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from homeassistant.components import frontend, persistent_notification
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.translation import async_get_translations

from .const import DOMAIN, FRONTEND_URL, VERSION
from .store import HouseplanConfigEntry

_LOGGER = logging.getLogger(__name__)

FRONTEND_REGISTRATION_KEY = "frontend_registration"
FRONTEND_STATIC_REGISTERED_KEY = "static_registered"
FRONTEND_FALLBACK_URLS_KEY = "frontend_fallback_urls"
FRONTEND_RELOAD_NOTICE_DATA_KEY = "frontend_reload_notice_created"
FRONTEND_RELOAD_NOTICE_ID = "houseplan_frontend_reload_notice"
FRONTEND_RETRY_DELAY_SECONDS = 1.0

_NOTICE_TITLE_KEY = "component.houseplan.issues.frontend_reload_notice.title"
_NOTICE_DESCRIPTION_KEY = (
    "component.houseplan.issues.frontend_reload_notice.description"
)
_NOTICE_TITLE_FALLBACK = "House Plan card connected"
_NOTICE_DESCRIPTION_FALLBACK = (
    "The House Plan card is connected. Fully reload this page to use the latest "
    "frontend (`Ctrl+F5` on Windows/Linux or `Cmd+Shift+R` on macOS). If you "
    "manage dashboard resources manually in storage mode, open Settings → "
    "Dashboards → Resources."
)

RegistrationStatus = Literal[
    "not_attempted",
    "created",
    "updated",
    "existing",
    "registry_pending",
    "yaml_fallback",
    "transient_error",
    "error_fallback",
]
ResourceLoader = Literal[
    "none",
    "lovelace_resource",
    "extra_module_url",
    "lovelace_resource_with_session_fallback",
]
ReloadNoticeStatus = Literal[
    "created",
    "already_created",
    "pending_frontend",
]


@dataclass(frozen=True, slots=True)
class RegistrationOutcome:
    """Result of one Lovelace resource registry attempt."""

    status: RegistrationStatus
    last_error: str | None = None


@dataclass(slots=True)
class FrontendRegistrationState:
    """Observable state and lifecycle handles for the current config-entry run."""

    card_file_present: bool
    static_path_registered: bool = False
    resource_status: RegistrationStatus = "not_attempted"
    loader: ResourceLoader = "none"
    module_url: str | None = None
    retry_pending: bool = False
    retry_attempted: bool = False
    last_error: str | None = None
    first_reload_notice: ReloadNoticeStatus = "pending_frontend"
    active: bool = True
    fallback_added: bool = False
    _cancel_started: Callable[[], None] | None = field(default=None, repr=False)
    _cancel_timer: Callable[[], None] | None = field(default=None, repr=False)
    _retry_task: asyncio.Task[None] | None = field(default=None, repr=False)
    _notice_lock: asyncio.Lock = field(default_factory=asyncio.Lock, repr=False)

    @callback
    def cancel(self) -> None:
        """Prevent all delayed work for this setup generation."""
        self.active = False
        self.retry_pending = False
        if self._cancel_started is not None:
            self._cancel_started()
            self._cancel_started = None
        if self._cancel_timer is not None:
            self._cancel_timer()
            self._cancel_timer = None
        if self._retry_task is not None and not self._retry_task.done():
            self._retry_task.cancel()
        self._retry_task = None


def _safe_error(phase: str, err: BaseException) -> str:
    """Return a support-safe failure fingerprint without message or path data."""
    return f"{phase}:{type(err).__name__}"


def _lovelace_resources(hass: HomeAssistant):
    """Return the Lovelace resource collection across supported HA versions."""
    lovelace = hass.data.get("lovelace")
    resources = getattr(lovelace, "resources", None)
    if resources is None and isinstance(lovelace, dict):
        resources = lovelace.get("resources")
    return resources


def _is_current(hass: HomeAssistant, state: FrontendRegistrationState) -> bool:
    """Return whether a delayed operation still belongs to the loaded entry."""
    return (
        state.active
        and hass.data.get(DOMAIN, {}).get(FRONTEND_REGISTRATION_KEY) is state
    )


def _owned_fallback_urls(hass: HomeAssistant) -> set[str]:
    """Return exact extra-module URLs owned for this Home Assistant run."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    urls = domain_data.get(FRONTEND_FALLBACK_URLS_KEY)
    if not isinstance(urls, set):
        urls = set()
        domain_data[FRONTEND_FALLBACK_URLS_KEY] = urls
    return urls


def _active_extra_module_urls(hass: HomeAssistant) -> frozenset[str] | None:
    """Return HA's current module URLs, or None when the API is unknowable.

    ``add_extra_js_url`` is intentionally idempotent and has no ownership
    return value.  Looking before adding is therefore the only way to avoid
    claiming (and later removing) an identical URL configured by the user.
    Both the oldest supported HA and current HA expose ``UrlManager.urls``;
    unknown future/legacy shapes fail closed and are never claimed.
    """
    key = getattr(frontend, "DATA_EXTRA_MODULE_URL", None)
    if key is None:
        return None
    manager = hass.data.get(key)
    if manager is None:
        # Frontend setup normally creates the manager before this integration.
        # If it is genuinely absent, no configured URL can predate our add;
        # add_extra_js_url will either create/use its supported path or fail.
        return frozenset()
    urls = getattr(manager, "urls", None)
    if not isinstance(urls, (set, frozenset, list, tuple)):
        return None
    return frozenset(url for url in urls if isinstance(url, str))


async def _async_remove_duplicate_resources(
    resources,
    existing: list[dict],
    canonical_id: str,
    *,
    is_active: Callable[[], bool],
) -> None:
    """Best-effort remove legacy duplicates after choosing one authority."""
    remover = getattr(resources, "async_delete_item", None)
    if remover is None:
        return
    for item in existing:
        if item.get("id") == canonical_id:
            continue
        if not is_active():
            return
        try:
            await remover(item["id"])
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - canonical registration still succeeded
            _LOGGER.debug(
                "Could not remove a duplicate House Plan Lovelace resource",
                exc_info=True,
            )


async def async_register_lovelace_resource(
    hass: HomeAssistant,
    module_url: str,
    *,
    is_active: Callable[[], bool] | None = None,
) -> RegistrationOutcome:
    """Create or update the canonical Lovelace resource entry."""
    active = is_active or (lambda: True)
    resources = _lovelace_resources(hass)
    if resources is None:
        return RegistrationOutcome("registry_pending")
    if not hasattr(resources, "async_create_item"):
        return RegistrationOutcome("yaml_fallback")

    try:
        if not active():
            return RegistrationOutcome("registry_pending")
        if hasattr(resources, "async_get_info"):
            await resources.async_get_info()
        elif hasattr(resources, "loaded") and not resources.loaded:
            await resources.async_load()
            resources.loaded = True
        if not active():
            return RegistrationOutcome("registry_pending")

        existing = [
            item
            for item in resources.async_items()
            if str(item.get("url", "")).split("?", 1)[0] == FRONTEND_URL
        ]
        if existing:
            # Prefer an already-current entry when legacy duplicates exist. This
            # preserves its stable id while the remaining same-base entries are
            # removed best effort below.
            item = next(
                (candidate for candidate in existing if candidate.get("url") == module_url),
                existing[0],
            )
            if item.get("url") == module_url and item.get("type") == "module":
                await _async_remove_duplicate_resources(
                    resources,
                    existing,
                    item["id"],
                    is_active=active,
                )
                return RegistrationOutcome("existing")
            if not hasattr(resources, "async_update_item"):
                return RegistrationOutcome(
                    "transient_error", "registry_update:UnsupportedOperation"
                )
            if not active():
                return RegistrationOutcome("registry_pending")
            await resources.async_update_item(
                item["id"], {"url": module_url, "res_type": "module"}
            )
            await _async_remove_duplicate_resources(
                resources,
                existing,
                item["id"],
                is_active=active,
            )
            return RegistrationOutcome("updated")

        if not active():
            return RegistrationOutcome("registry_pending")
        await resources.async_create_item(
            {"url": module_url, "res_type": "module"}
        )
        _LOGGER.debug("House Plan card registered as a Lovelace resource")
        return RegistrationOutcome("created")
    except asyncio.CancelledError:
        raise
    except Exception as err:  # noqa: BLE001 - typed fallback is intentional
        _LOGGER.debug("Could not register the House Plan Lovelace resource", exc_info=True)
        return RegistrationOutcome("transient_error", _safe_error("registry", err))


def _add_fallback(
    hass: HomeAssistant, state: FrontendRegistrationState
) -> None:
    """Add this setup's exact versioned extra-module URL, best effort."""
    if state.module_url is None or not _is_current(hass, state):
        return
    owned_urls = _owned_fallback_urls(hass)
    if state.module_url in owned_urls:
        state.fallback_added = True
        state.loader = "extra_module_url"
        return
    active_before = _active_extra_module_urls(hass)
    if active_before is not None and state.module_url in active_before:
        # The exact URL predates this setup. It is a working loader, but it is
        # not ours to remove after registry recovery or on uninstall.
        state.fallback_added = True
        state.loader = "extra_module_url"
        return
    try:
        frontend.add_extra_js_url(hass, state.module_url)
    except Exception as err:  # noqa: BLE001 - frontend setup must remain available
        state.loader = "none"
        state.last_error = _safe_error("fallback_add", err)
        _LOGGER.warning("Could not add the House Plan frontend fallback", exc_info=True)
        return
    if active_before is not None:
        owned_urls.add(state.module_url)
    else:
        _LOGGER.debug(
            "House Plan could not prove ownership of the frontend fallback; "
            "it will remain until Home Assistant restarts"
        )
    state.fallback_added = True
    state.loader = "extra_module_url"


def _remove_owned_fallback_url(
    hass: HomeAssistant,
    state: FrontendRegistrationState,
    module_url: str,
) -> bool:
    """Remove one exact integration-owned fallback when HA supports it."""
    owned_urls = _owned_fallback_urls(hass)
    if module_url not in owned_urls:
        return True
    remover = getattr(frontend, "remove_extra_js_url", None)
    if remover is None:
        return False
    try:
        remover(hass, module_url)
    except KeyError:
        # Another lifecycle path already removed the exact URL.
        owned_urls.discard(module_url)
        return True
    except Exception as err:  # noqa: BLE001 - registry remains authoritative
        state.last_error = _safe_error("fallback_remove", err)
        _LOGGER.debug("Could not remove the House Plan frontend fallback", exc_info=True)
        return False
    owned_urls.discard(module_url)
    return True


def _remove_fallback(
    hass: HomeAssistant, state: FrontendRegistrationState
) -> bool:
    """Remove this setup's exact fallback when the running HA supports it."""
    if state.module_url is None:
        return True
    owned_urls = _owned_fallback_urls(hass)
    if state.module_url in owned_urls:
        removed = _remove_owned_fallback_url(hass, state, state.module_url)
        state.fallback_added = not removed
        return removed

    # A pre-existing/user-owned or uninspectable exact URL must never be
    # removed. Report the combined loader while it is known (or conservatively
    # assumed) to remain active in this HA document lifecycle.
    active = _active_extra_module_urls(hass)
    state.fallback_added = active is None or state.module_url in active
    return not state.fallback_added


async def _async_create_reload_notice(
    hass: HomeAssistant,
    entry: HouseplanConfigEntry,
    state: FrontendRegistrationState,
) -> None:
    """Create and persist the one-time localized hard-reload instruction."""
    # Initial fallback setup and the one-second retry may overlap when loading a
    # translation is slow. Serialize the persisted one-shot contract rather
    # than relying only on the stable notification ID (which prevents two UI
    # rows but would still perform and persist two creates).
    async with state._notice_lock:
        if entry.data.get(FRONTEND_RELOAD_NOTICE_DATA_KEY) is True:
            if state.first_reload_notice != "created":
                state.first_reload_notice = "already_created"
            return
        if (
            not _is_current(hass, state)
            or not state.card_file_present
            or not state.static_path_registered
            or state.loader == "none"
        ):
            state.first_reload_notice = "pending_frontend"
            return

        title = _NOTICE_TITLE_FALLBACK
        description = _NOTICE_DESCRIPTION_FALLBACK
        try:
            translations = await async_get_translations(
                hass,
                hass.config.language,
                "issues",
                integrations={DOMAIN},
            )
            title = translations.get(_NOTICE_TITLE_KEY, title)
            description = translations.get(_NOTICE_DESCRIPTION_KEY, description)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - built-in English fallback is intentional
            _LOGGER.debug(
                "Could not load the House Plan reload notice translation",
                exc_info=True,
            )

        if not _is_current(hass, state):
            return
        try:
            persistent_notification.async_create(
                hass,
                description,
                title=title,
                notification_id=FRONTEND_RELOAD_NOTICE_ID,
            )
        except Exception:  # noqa: BLE001 - do not consume flag on failure
            state.first_reload_notice = "pending_frontend"
            _LOGGER.warning(
                "Could not create the House Plan reload notice", exc_info=True
            )
            return
        try:
            hass.config_entries.async_update_entry(
                entry,
                data={**entry.data, FRONTEND_RELOAD_NOTICE_DATA_KEY: True},
            )
        except Exception:  # noqa: BLE001 - roll back the unpersisted notice
            # A stable ID prevents duplicate rows, but dismissing the notice is
            # still important: without a durable flag, displaying it would make
            # System Health claim that the one-shot contract is pending while a
            # user-visible notice already exists. A later setup/retry can now
            # attempt the complete create+persist operation honestly.
            try:
                persistent_notification.async_dismiss(
                    hass, FRONTEND_RELOAD_NOTICE_ID
                )
            except Exception:  # noqa: BLE001 - stable ID remains a safe fallback
                _LOGGER.debug(
                    "Could not roll back an unpersisted House Plan reload notice",
                    exc_info=True,
                )
            state.first_reload_notice = "pending_frontend"
            _LOGGER.warning(
                "Could not persist the House Plan reload notice state",
                exc_info=True,
            )
            return
        state.first_reload_notice = "created"


async def _async_retry_registration(
    hass: HomeAssistant,
    entry: HouseplanConfigEntry,
    state: FrontendRegistrationState,
) -> None:
    """Perform the single delayed resource-registry retry."""
    if not _is_current(hass, state) or state.module_url is None:
        return
    state.retry_pending = False
    state.retry_attempted = True
    outcome = await async_register_lovelace_resource(
        hass,
        state.module_url,
        is_active=lambda: _is_current(hass, state),
    )
    if not _is_current(hass, state):
        return

    if outcome.status in {"created", "updated", "existing"}:
        state.resource_status = outcome.status
        state.last_error = outcome.last_error
        state.loader = (
            "lovelace_resource"
            if _remove_fallback(hass, state)
            else "lovelace_resource_with_session_fallback"
        )
    elif outcome.status == "yaml_fallback":
        state.resource_status = "yaml_fallback"
        state.last_error = outcome.last_error
        _add_fallback(hass, state)
    else:
        state.resource_status = "error_fallback"
        state.last_error = outcome.last_error or "registry_retry:Unavailable"
        _add_fallback(hass, state)

    await _async_create_reload_notice(hass, entry, state)


def _schedule_retry(
    hass: HomeAssistant,
    entry: HouseplanConfigEntry,
    state: FrontendRegistrationState,
) -> None:
    """Schedule exactly one lifecycle-bound retry after HA start plus one second."""
    state.retry_pending = True

    @callback
    def _after_started(_event=None) -> None:
        if not _is_current(hass, state):
            return
        state._cancel_started = None

        @callback
        def _after_delay(_now=None) -> None:
            if not _is_current(hass, state):
                return
            state._cancel_timer = None
            state._retry_task = entry.async_create_background_task(
                hass,
                _async_retry_registration(hass, entry, state),
                "houseplan frontend resource retry",
            )

        state._cancel_timer = async_call_later(
            hass, FRONTEND_RETRY_DELAY_SECONDS, _after_delay
        )

    state._cancel_started = async_at_started(hass, _after_started)


async def async_setup_frontend_registration(
    hass: HomeAssistant,
    entry: HouseplanConfigEntry,
    card_path: Path,
) -> FrontendRegistrationState:
    """Register static/card resources without blocking the rest of entry setup."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    previous = domain_data.get(FRONTEND_REGISTRATION_KEY)
    if isinstance(previous, FrontendRegistrationState):
        previous.cancel()

    card_file_present = card_path.is_file()
    module_url = f"{FRONTEND_URL}?v={VERSION}" if card_file_present else None
    active_fallbacks = _active_extra_module_urls(hass)
    fallback_added = module_url is not None and (
        module_url in _owned_fallback_urls(hass)
        or (active_fallbacks is not None and module_url in active_fallbacks)
    )
    state = FrontendRegistrationState(
        card_file_present=card_file_present,
        loader="extra_module_url" if fallback_added else "none",
        module_url=module_url,
        first_reload_notice=(
            "already_created"
            if entry.data.get(FRONTEND_RELOAD_NOTICE_DATA_KEY) is True
            else "pending_frontend"
        ),
        fallback_added=fallback_added,
    )
    domain_data[FRONTEND_REGISTRATION_KEY] = state
    entry.async_on_unload(state.cancel)

    if domain_data.get(FRONTEND_STATIC_REGISTERED_KEY):
        state.static_path_registered = True
    elif card_file_present:
        try:
            try:
                from homeassistant.components.http import StaticPathConfig
            except ImportError:  # Home Assistant versions before the async API
                hass.http.register_static_path(
                    FRONTEND_URL, str(card_path), cache_headers=False
                )
            else:
                await hass.http.async_register_static_paths(
                    [StaticPathConfig(FRONTEND_URL, str(card_path), cache_headers=False)]
                )
        except asyncio.CancelledError:
            raise
        except Exception as err:  # noqa: BLE001 - setup continues without frontend
            state.last_error = _safe_error("static_path", err)
            _LOGGER.warning("Could not register the House Plan static path", exc_info=True)
        else:
            domain_data[FRONTEND_STATIC_REGISTERED_KEY] = True
            state.static_path_registered = True

    if not card_file_present:
        _LOGGER.warning("houseplan-card.js was not found next to the integration")
        return state
    if not state.static_path_registered or state.module_url is None:
        return state

    outcome = await async_register_lovelace_resource(
        hass,
        state.module_url,
        is_active=lambda: _is_current(hass, state),
    )
    if not _is_current(hass, state):
        return state
    state.resource_status = outcome.status
    state.last_error = outcome.last_error

    if outcome.status in {"created", "updated", "existing"}:
        state.loader = (
            "lovelace_resource"
            if _remove_fallback(hass, state)
            else "lovelace_resource_with_session_fallback"
        )
        _LOGGER.info(
            "House Plan card auto-registered as a Lovelace resource: %s",
            state.module_url,
        )
    else:
        _add_fallback(hass, state)
        if outcome.status in {"registry_pending", "transient_error"}:
            _schedule_retry(hass, entry, state)
        else:
            _LOGGER.info(
                "House Plan card uses the frontend extra-module fallback: %s",
                state.module_url,
            )

    await _async_create_reload_notice(hass, entry, state)
    return state


@callback
def get_frontend_registration_state(
    hass: HomeAssistant,
) -> FrontendRegistrationState | None:
    """Return current frontend registration state for System Health."""
    state = hass.data.get(DOMAIN, {}).get(FRONTEND_REGISTRATION_KEY)
    return state if isinstance(state, FrontendRegistrationState) else None


async def async_remove_frontend_registration(
    hass: HomeAssistant, entry: HouseplanConfigEntry
) -> None:
    """Remove all House Plan resource entries and its one-time notice."""
    state = get_frontend_registration_state(hass)
    if state is not None:
        state.cancel()
        domain_data = hass.data.get(DOMAIN, {})
        if domain_data.get(FRONTEND_REGISTRATION_KEY) is state:
            domain_data.pop(FRONTEND_REGISTRATION_KEY, None)

    # Fallback ownership belongs to this HA run, not to the latest config-entry
    # generation. A bundle-missing reload can therefore have no current URL
    # while an earlier exact URL is still registered. Uninstall cleans every
    # URL that this integration itself added, and never pattern-matches foreign
    # extra-module entries.
    cleanup_state = state or FrontendRegistrationState(card_file_present=False)
    for module_url in tuple(_owned_fallback_urls(hass)):
        _remove_owned_fallback_url(hass, cleanup_state, module_url)

    try:
        persistent_notification.async_dismiss(hass, FRONTEND_RELOAD_NOTICE_ID)
    except Exception:  # noqa: BLE001 - uninstall cleanup is best effort
        _LOGGER.debug("Could not dismiss the House Plan reload notice", exc_info=True)

    try:
        resources = _lovelace_resources(hass)
        if resources is None or not hasattr(resources, "async_delete_item"):
            return
        if hasattr(resources, "async_get_info"):
            await resources.async_get_info()
        for item in list(resources.async_items()):
            if str(item.get("url", "")).split("?", 1)[0] != FRONTEND_URL:
                continue
            try:
                await resources.async_delete_item(item["id"])
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - continue best-effort cleanup
                _LOGGER.debug(
                    "Could not remove one House Plan Lovelace resource",
                    exc_info=True,
                )
                continue
            _LOGGER.debug("House Plan Lovelace resource removed")
    except asyncio.CancelledError:
        raise
    except Exception:  # noqa: BLE001 - uninstall cleanup is best effort
        _LOGGER.debug("Could not remove the House Plan Lovelace resource", exc_info=True)
