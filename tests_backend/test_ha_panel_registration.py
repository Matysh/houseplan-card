"""Home Assistant panel registration and ownership tests for issue #486."""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from homeassistant.components import frontend
from homeassistant.core import HomeAssistant

from custom_components.houseplan import panel_registration as panel
from custom_components.houseplan.const import (
    DOMAIN,
    FRONTEND_URL,
    PANEL_COMPONENT_NAME,
    PANEL_FRONTEND_URL,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL,
    PANEL_URL_PATH,
    VERSION,
)
from custom_components.houseplan.frontend_registration import (
    FRONTEND_STATIC_REGISTERED_KEY,
    StaticPathRegistrationOutcome,
    async_register_frontend_static_path,
)


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom_components in the test hass."""
    yield


class _Entry:
    """Minimal config-entry lifecycle surface used by panel setup."""

    def __init__(self) -> None:
        self.unload_callbacks = []

    def async_on_unload(self, callback) -> None:
        self.unload_callbacks.append(callback)


def _make_panel_file(tmp_path: Path) -> Path:
    path = tmp_path / "houseplan-panel.js"
    path.write_text("// panel", encoding="utf-8")
    return path


def _stub_static_success(monkeypatch) -> AsyncMock:
    register = AsyncMock(return_value=StaticPathRegistrationOutcome(True))
    monkeypatch.setattr(panel, "async_register_frontend_static_path", register)
    return register


def _stub_successful_panel_api(
    hass: HomeAssistant, monkeypatch
) -> tuple[list[dict], list[object]]:
    calls: list[dict] = []
    objects: list[object] = []

    async def register(**kwargs) -> None:
        calls.append(kwargs)
        owned = object()
        objects.append(owned)
        hass.data.setdefault(frontend.DATA_PANELS, {})[kwargs["frontend_url_path"]] = (
            owned
        )

    monkeypatch.setattr(panel.panel_custom, "async_register_panel", register)
    return calls, objects


async def test_registers_exact_public_panel_contract_and_static_url(
    hass: HomeAssistant, tmp_path: Path, monkeypatch
) -> None:
    path = _make_panel_file(tmp_path)
    static_register = AsyncMock()
    monkeypatch.setattr(
        hass,
        "http",
        SimpleNamespace(async_register_static_paths=static_register),
    )
    calls, objects = _stub_successful_panel_api(hass, monkeypatch)
    entry = _Entry()

    state = await panel.async_setup_panel_registration(hass, entry, path)

    configs = static_register.await_args.args[0]
    assert len(configs) == 1
    assert configs[0].url_path == PANEL_FRONTEND_URL
    assert configs[0].path == str(path)
    assert configs[0].cache_headers is False
    assert calls == [
        {
            "hass": hass,
            "frontend_url_path": PANEL_URL_PATH,
            "webcomponent_name": PANEL_COMPONENT_NAME,
            "sidebar_title": PANEL_TITLE,
            "sidebar_icon": PANEL_ICON,
            "module_url": f"{PANEL_FRONTEND_URL}?v={VERSION}",
            "embed_iframe": False,
            "trust_external": False,
            "require_admin": False,
        }
    ]
    assert state.panel_file_present is True
    assert state.panel_static_path_registered is True
    assert state.panel_status == "registered"
    assert state.panel_url == PANEL_URL
    assert state.panel_module_url == f"{PANEL_FRONTEND_URL}?v={VERSION}"
    assert state.panel_error is None
    assert state._owned_panel is objects[0]
    assert entry.unload_callbacks and len(entry.unload_callbacks) == 1
    assert hass.data[DOMAIN][FRONTEND_STATIC_REGISTERED_KEY] == {PANEL_FRONTEND_URL}


async def test_legacy_card_boolean_becomes_per_url_static_registration(
    hass: HomeAssistant, tmp_path: Path, monkeypatch
) -> None:
    path = _make_panel_file(tmp_path)
    hass.data.setdefault(DOMAIN, {})[FRONTEND_STATIC_REGISTERED_KEY] = True
    registered: list[tuple[str, str, bool]] = []
    monkeypatch.setitem(sys.modules, "homeassistant.components.http", None)
    monkeypatch.setattr(
        hass,
        "http",
        SimpleNamespace(
            register_static_path=lambda url, file_path, cache_headers: (
                registered.append((url, file_path, cache_headers))
            )
        ),
    )

    outcome = await async_register_frontend_static_path(hass, PANEL_FRONTEND_URL, path)

    assert outcome == StaticPathRegistrationOutcome(True)
    assert registered == [(PANEL_FRONTEND_URL, str(path), False)]
    assert hass.data[DOMAIN][FRONTEND_STATIC_REGISTERED_KEY] == {
        FRONTEND_URL,
        PANEL_FRONTEND_URL,
    }


async def test_missing_panel_asset_is_fail_soft(
    hass: HomeAssistant, tmp_path: Path, monkeypatch
) -> None:
    static_register = _stub_static_success(monkeypatch)
    register_panel = AsyncMock()
    monkeypatch.setattr(panel.panel_custom, "async_register_panel", register_panel)

    state = await panel.async_setup_panel_registration(
        hass, _Entry(), tmp_path / "missing-panel.js"
    )

    assert state.panel_file_present is False
    assert state.panel_status == "missing_asset"
    assert state.panel_url is None
    assert state.panel_module_url is None
    assert state.panel_error is None
    static_register.assert_not_awaited()
    register_panel.assert_not_awaited()


async def test_static_failure_is_safe_and_does_not_attempt_panel_registration(
    hass: HomeAssistant, tmp_path: Path, monkeypatch, caplog
) -> None:
    path = _make_panel_file(tmp_path)
    monkeypatch.setattr(
        hass,
        "http",
        SimpleNamespace(
            async_register_static_paths=AsyncMock(
                side_effect=OSError("C:/private/secret-panel.js")
            )
        ),
    )
    register_panel = AsyncMock()
    monkeypatch.setattr(panel.panel_custom, "async_register_panel", register_panel)
    caplog.set_level(logging.WARNING, logger=panel.__name__)

    state = await panel.async_setup_panel_registration(hass, _Entry(), path)

    assert state.panel_status == "static_error"
    assert state.panel_error == "static_path:OSError"
    assert state.panel_static_path_registered is False
    assert state.panel_url is None
    assert "private" not in caplog.text
    assert "secret-panel" not in caplog.text
    register_panel.assert_not_awaited()


async def test_collision_preserves_foreign_panel_and_redacts_exception(
    hass: HomeAssistant, tmp_path: Path, monkeypatch, caplog
) -> None:
    path = _make_panel_file(tmp_path)
    _stub_static_success(monkeypatch)
    foreign = object()
    hass.data[frontend.DATA_PANELS] = {PANEL_URL_PATH: foreign}
    monkeypatch.setattr(
        panel.panel_custom,
        "async_register_panel",
        AsyncMock(side_effect=ValueError("foreign C:/secret/config")),
    )
    remove = Mock()
    monkeypatch.setattr(panel.frontend, "async_remove_panel", remove)
    caplog.set_level(logging.WARNING, logger=panel.__name__)

    state = await panel.async_setup_panel_registration(hass, _Entry(), path)

    assert state.panel_status == "collision"
    assert state.panel_error == "registration:ValueError"
    assert state.panel_url is None
    assert hass.data[frontend.DATA_PANELS][PANEL_URL_PATH] is foreign
    remove.assert_not_called()
    assert "secret" not in caplog.text
    assert "System Health" in caplog.text


@pytest.mark.parametrize("error_type", [RuntimeError, OSError])
async def test_registration_exception_is_fail_soft_and_safe(
    hass: HomeAssistant, tmp_path: Path, monkeypatch, caplog, error_type
) -> None:
    path = _make_panel_file(tmp_path)
    _stub_static_success(monkeypatch)
    hass.data[frontend.DATA_PANELS] = {}
    monkeypatch.setattr(
        panel.panel_custom,
        "async_register_panel",
        AsyncMock(side_effect=error_type("C:/private/token")),
    )
    caplog.set_level(logging.WARNING, logger=panel.__name__)

    state = await panel.async_setup_panel_registration(hass, _Entry(), path)

    assert state.panel_status == "registration_error"
    assert state.panel_error == f"registration:{error_type.__name__}"
    assert state.panel_url is None
    assert "private" not in caplog.text
    assert "token" not in caplog.text


async def test_unreadable_registry_removes_just_registered_route_with_old_api_shape(
    hass: HomeAssistant, tmp_path: Path, monkeypatch
) -> None:
    path = _make_panel_file(tmp_path)
    _stub_static_success(monkeypatch)
    hass.data.pop(frontend.DATA_PANELS, None)
    monkeypatch.setattr(
        panel.panel_custom, "async_register_panel", AsyncMock(return_value=None)
    )
    remove_calls: list[tuple[HomeAssistant, str]] = []

    def remove(hass_arg: HomeAssistant, url_path: str) -> None:
        remove_calls.append((hass_arg, url_path))

    monkeypatch.setattr(panel.frontend, "async_remove_panel", remove)
    entry = _Entry()

    state = await panel.async_setup_panel_registration(hass, entry, path)

    assert state.panel_status == "ownership_error"
    assert state.panel_error == "ownership:Unavailable"
    assert state._owned_panel is None
    assert state.panel_url is None
    assert remove_calls == [(hass, PANEL_URL_PATH)]
    assert entry.unload_callbacks == []


async def test_generation_and_identity_guards_make_cleanup_exact_and_idempotent(
    hass: HomeAssistant, tmp_path: Path, monkeypatch
) -> None:
    path = _make_panel_file(tmp_path)
    _stub_static_success(monkeypatch)
    hass.data[frontend.DATA_PANELS] = {}
    _calls, objects = _stub_successful_panel_api(hass, monkeypatch)
    removed: list[tuple[HomeAssistant, str]] = []

    def remove(hass_arg: HomeAssistant, url_path: str) -> None:
        removed.append((hass_arg, url_path))
        hass_arg.data[frontend.DATA_PANELS].pop(url_path, None)

    monkeypatch.setattr(panel.frontend, "async_remove_panel", remove)

    first_entry = _Entry()
    first = await panel.async_setup_panel_registration(hass, first_entry, path)
    first_callback = first_entry.unload_callbacks[0]
    second_entry = _Entry()
    second = await panel.async_setup_panel_registration(hass, second_entry, path)

    assert first.panel_status == "removed"
    assert second.panel_status == "registered"
    assert second.generation == first.generation + 1
    assert removed == [(hass, PANEL_URL_PATH)]
    assert hass.data[frontend.DATA_PANELS][PANEL_URL_PATH] is objects[1]

    first_callback()
    assert removed == [(hass, PANEL_URL_PATH)]
    assert hass.data[frontend.DATA_PANELS][PANEL_URL_PATH] is objects[1]

    foreign = object()
    hass.data[frontend.DATA_PANELS][PANEL_URL_PATH] = foreign
    second_entry.unload_callbacks[0]()
    second_entry.unload_callbacks[0]()
    assert removed == [(hass, PANEL_URL_PATH)]
    assert hass.data[frontend.DATA_PANELS][PANEL_URL_PATH] is foreign
    assert second.panel_status == "removed"

    hass.data[frontend.DATA_PANELS].pop(PANEL_URL_PATH)
    third_entry = _Entry()
    third = await panel.async_setup_panel_registration(hass, third_entry, path)
    hass.data[DOMAIN][panel.PANEL_GENERATION_KEY] = third.generation + 1
    panel.remove_panel_registration(hass)
    assert third.panel_status == "registered"
    assert hass.data[frontend.DATA_PANELS][PANEL_URL_PATH] is objects[2]
    hass.data[DOMAIN][panel.PANEL_GENERATION_KEY] = third.generation
    panel.remove_panel_registration(hass)
    panel.remove_panel_registration(hass)
    assert third.panel_status == "removed"
    assert removed == [(hass, PANEL_URL_PATH), (hass, PANEL_URL_PATH)]


async def test_panel_is_visible_to_admin_and_read_only_users(
    hass: HomeAssistant, tmp_path: Path, monkeypatch
) -> None:
    path = _make_panel_file(tmp_path)
    _stub_static_success(monkeypatch)
    hass.data[frontend.DATA_PANELS] = {}
    hass.data[frontend.DATA_PANELS_CONFIG] = {}

    state = await panel.async_setup_panel_registration(hass, _Entry(), path)
    assert state.panel_status == "registered"
    assert hass.data[frontend.DATA_PANELS][PANEL_URL_PATH].require_admin is False

    class _Connection:
        def __init__(self, is_admin: bool) -> None:
            self.hass = hass
            self.user = SimpleNamespace(is_admin=is_admin)
            self.messages = []

        def send_message(self, message) -> None:
            self.messages.append(message)

    for is_admin in (True, False):
        connection = _Connection(is_admin)
        frontend.websocket_get_panels(hass, connection, {"id": 1, "type": "get_panels"})
        assert PANEL_URL_PATH in connection.messages[0]["result"]


@pytest.mark.parametrize(
    ("state", "expected"),
    [
        pytest.param(
            None,
            {
                "panel_file": "missing",
                "panel_static_path": "not_registered",
                "panel_status": "not_attempted",
                "panel_url": "unavailable",
                "panel_module_url": "unavailable",
                "panel_error": "none",
            },
            id="not-attempted",
        ),
        pytest.param(
            panel.PanelRegistrationState(
                panel_file_present=True,
                generation=1,
                panel_static_path_registered=True,
                panel_status="registered",
                panel_url=PANEL_URL,
                panel_module_url=f"{PANEL_FRONTEND_URL}?v={VERSION}",
            ),
            {
                "panel_file": "present",
                "panel_static_path": "registered",
                "panel_status": "registered",
                "panel_url": PANEL_URL,
                "panel_module_url": f"{PANEL_FRONTEND_URL}?v={VERSION}",
                "panel_error": "none",
            },
            id="registered",
        ),
        pytest.param(
            panel.PanelRegistrationState(
                panel_file_present=False,
                generation=2,
                panel_status="missing_asset",
            ),
            {
                "panel_file": "missing",
                "panel_static_path": "not_registered",
                "panel_status": "missing_asset",
                "panel_url": "unavailable",
                "panel_module_url": "unavailable",
                "panel_error": "none",
            },
            id="missing-asset",
        ),
        pytest.param(
            panel.PanelRegistrationState(
                panel_file_present=True,
                generation=3,
                panel_status="static_error",
                panel_error="static_path:OSError",
            ),
            {
                "panel_file": "present",
                "panel_static_path": "not_registered",
                "panel_status": "static_error",
                "panel_url": "unavailable",
                "panel_module_url": "unavailable",
                "panel_error": "static_path:OSError",
            },
            id="static-error",
        ),
        pytest.param(
            panel.PanelRegistrationState(
                panel_file_present=True,
                generation=4,
                panel_static_path_registered=True,
                panel_status="collision",
                panel_error="registration:ValueError",
            ),
            {
                "panel_file": "present",
                "panel_static_path": "registered",
                "panel_status": "collision",
                "panel_url": "unavailable",
                "panel_module_url": "unavailable",
                "panel_error": "registration:ValueError",
            },
            id="collision",
        ),
        pytest.param(
            panel.PanelRegistrationState(
                panel_file_present=True,
                generation=5,
                panel_static_path_registered=True,
                panel_status="registration_error",
                panel_error="registration:RuntimeError",
            ),
            {
                "panel_file": "present",
                "panel_static_path": "registered",
                "panel_status": "registration_error",
                "panel_url": "unavailable",
                "panel_module_url": "unavailable",
                "panel_error": "registration:RuntimeError",
            },
            id="registration-error",
        ),
        pytest.param(
            panel.PanelRegistrationState(
                panel_file_present=True,
                generation=6,
                panel_static_path_registered=True,
                panel_status="ownership_error",
                panel_error="ownership:Unavailable",
            ),
            {
                "panel_file": "present",
                "panel_static_path": "registered",
                "panel_status": "ownership_error",
                "panel_url": "unavailable",
                "panel_module_url": "unavailable",
                "panel_error": "ownership:Unavailable",
            },
            id="ownership-error",
        ),
        pytest.param(
            panel.PanelRegistrationState(
                panel_file_present=True,
                generation=7,
                panel_static_path_registered=True,
                panel_status="removed",
            ),
            {
                "panel_file": "present",
                "panel_static_path": "registered",
                "panel_status": "removed",
                "panel_url": "unavailable",
                "panel_module_url": "unavailable",
                "panel_error": "none",
            },
            id="removed",
        ),
    ],
)
async def test_system_health_reports_complete_panel_matrix(
    hass: HomeAssistant, monkeypatch, state, expected
) -> None:
    from custom_components.houseplan import system_health

    class _Store:
        async def async_load(self):
            return {}

    monkeypatch.setattr(
        system_health,
        "get_data",
        lambda _hass: SimpleNamespace(config_store=_Store(), store=_Store()),
    )
    domain_data = hass.data.setdefault(DOMAIN, {})
    domain_data.pop(panel.PANEL_REGISTRATION_KEY, None)
    if state is not None:
        domain_data[panel.PANEL_REGISTRATION_KEY] = state

    result = await system_health.system_health_info(hass)

    assert {key: result[key] for key in expected} == expected
