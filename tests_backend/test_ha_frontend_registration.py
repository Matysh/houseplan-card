"""Frontend resource registration lifecycle tests for issue #462."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan import frontend_registration as registration
from custom_components.houseplan.const import DOMAIN, FRONTEND_URL, VERSION


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom_components in the test hass."""
    yield


class _StorageResources:
    """Small faithful surface of HA's ResourceStorageCollection."""

    def __init__(self, items=None, *, fail_info: Exception | None = None) -> None:
        self.items = list(items or [])
        self.fail_info = fail_info
        self.created: list[dict] = []
        self.updated: list[tuple[str, dict]] = []
        self.deleted: list[str] = []

    async def async_get_info(self):
        if self.fail_info is not None:
            raise self.fail_info
        return {"resources": len(self.items)}

    def async_items(self):
        return self.items

    async def async_create_item(self, data):
        self.created.append(data)
        self.items.append(
            {
                "id": f"created-{len(self.created)}",
                "url": data["url"],
                "type": data["res_type"],
            }
        )

    async def async_update_item(self, item_id, data):
        self.updated.append((item_id, data))
        item = next(item for item in self.items if item["id"] == item_id)
        item.update({"url": data["url"], "type": data["res_type"]})

    async def async_delete_item(self, item_id):
        self.deleted.append(item_id)
        self.items = [item for item in self.items if item["id"] != item_id]


class _YamlResources:
    async def async_get_info(self):
        return {"resources": 0}

    def async_items(self):
        return []


class _Entry:
    """Config-entry lifecycle surface needed by the retry scheduler."""

    def __init__(self) -> None:
        self.data: dict = {}
        self.unload_callbacks = []

    def async_on_unload(self, callback):
        self.unload_callbacks.append(callback)

    def async_create_background_task(self, hass, coro, name):
        return hass.async_create_task(coro, name)


async def test_registration_outcomes_create_update_existing_yaml_and_pending(
    hass: HomeAssistant,
) -> None:
    module_url = f"{FRONTEND_URL}?v={VERSION}"

    hass.data.pop("lovelace", None)
    outcome = await registration.async_register_lovelace_resource(hass, module_url)
    assert outcome.status == "registry_pending"

    hass.data["lovelace"] = SimpleNamespace(resources=_YamlResources())
    outcome = await registration.async_register_lovelace_resource(hass, module_url)
    assert outcome.status == "yaml_fallback"

    resources = _StorageResources()
    hass.data["lovelace"] = SimpleNamespace(resources=resources)
    outcome = await registration.async_register_lovelace_resource(hass, module_url)
    assert outcome.status == "created"
    assert resources.created == [{"url": module_url, "res_type": "module"}]

    outcome = await registration.async_register_lovelace_resource(hass, module_url)
    assert outcome.status == "existing"

    resources.items[0]["url"] = f"{FRONTEND_URL}?v=old"
    outcome = await registration.async_register_lovelace_resource(hass, module_url)
    assert outcome.status == "updated"
    assert resources.updated == [
        ("created-1", {"url": module_url, "res_type": "module"})
    ]


async def test_registration_keeps_one_canonical_resource_and_removes_duplicates(
    hass: HomeAssistant,
) -> None:
    module_url = f"{FRONTEND_URL}?v={VERSION}"
    resources = _StorageResources(
        [
            {"id": "old-a", "url": f"{FRONTEND_URL}?v=old-a", "type": "module"},
            {"id": "current", "url": module_url, "type": "module"},
            {"id": "old-b", "url": f"{FRONTEND_URL}?v=old-b", "type": "module"},
            {"id": "other", "url": "/local/other.js", "type": "module"},
        ]
    )
    hass.data["lovelace"] = SimpleNamespace(resources=resources)

    outcome = await registration.async_register_lovelace_resource(hass, module_url)

    assert outcome.status == "existing"
    assert resources.updated == []
    assert resources.deleted == ["old-a", "old-b"]
    assert [item["id"] for item in resources.items] == ["current", "other"]


async def test_registration_error_is_typed_and_safe(hass: HomeAssistant) -> None:
    hass.data["lovelace"] = SimpleNamespace(
        resources=_StorageResources(fail_info=OSError("C:/secret/token"))
    )
    outcome = await registration.async_register_lovelace_resource(
        hass, f"{FRONTEND_URL}?v={VERSION}"
    )
    assert outcome.status == "transient_error"
    assert outcome.last_error == "registry:OSError"
    assert "secret" not in outcome.last_error


async def test_static_path_is_not_marked_registered_when_ha_rejects_it(
    hass: HomeAssistant, tmp_path: Path, monkeypatch
) -> None:
    card_path = tmp_path / "houseplan-card.js"
    card_path.write_text("// card", encoding="utf-8")
    entry = _Entry()
    monkeypatch.setattr(
        hass,
        "http",
        SimpleNamespace(
            async_register_static_paths=AsyncMock(side_effect=OSError("no router"))
        ),
    )
    register_resource = AsyncMock()
    monkeypatch.setattr(
        registration, "async_register_lovelace_resource", register_resource
    )

    state = await registration.async_setup_frontend_registration(
        hass, entry, card_path
    )

    assert state.card_file_present is True
    assert state.static_path_registered is False
    assert state.resource_status == "not_attempted"
    assert state.loader == "none"
    assert state.last_error == "static_path:OSError"
    assert registration.FRONTEND_STATIC_REGISTERED_KEY not in hass.data[DOMAIN]
    register_resource.assert_not_awaited()


async def test_legacy_static_path_api_is_supported(
    hass: HomeAssistant, tmp_path: Path, monkeypatch
) -> None:
    card_path = tmp_path / "houseplan-card.js"
    card_path.write_text("// card", encoding="utf-8")
    entry = _Entry()
    registered: list[tuple[str, str, bool]] = []
    monkeypatch.setitem(sys.modules, "homeassistant.components.http", None)
    monkeypatch.setattr(
        hass,
        "http",
        SimpleNamespace(
            register_static_path=lambda url, path, cache_headers: registered.append(
                (url, path, cache_headers)
            )
        ),
    )
    monkeypatch.setattr(
        registration,
        "async_register_lovelace_resource",
        AsyncMock(return_value=registration.RegistrationOutcome("yaml_fallback")),
    )
    monkeypatch.setattr(registration, "_async_create_reload_notice", AsyncMock())
    monkeypatch.setattr(registration.frontend, "add_extra_js_url", lambda *_: None)

    state = await registration.async_setup_frontend_registration(
        hass, entry, card_path
    )

    assert registered == [(FRONTEND_URL, str(card_path), False)]
    assert state.static_path_registered is True
    assert state.resource_status == "yaml_fallback"
    assert state.loader == "extra_module_url"


async def test_repeated_setup_updates_once_then_reuses_canonical_resource(
    hass: HomeAssistant, tmp_path: Path, monkeypatch
) -> None:
    card_path = tmp_path / "houseplan-card.js"
    card_path.write_text("// card", encoding="utf-8")
    module_url = f"{FRONTEND_URL}?v={VERSION}"
    resources = _StorageResources(
        [{"id": "houseplan", "url": f"{FRONTEND_URL}?v=old", "type": "module"}]
    )
    # Older HA releases exposed the Lovelace data container as a dictionary.
    hass.data["lovelace"] = {"resources": resources}
    register_static = AsyncMock()
    monkeypatch.setattr(
        hass,
        "http",
        SimpleNamespace(async_register_static_paths=register_static),
    )
    monkeypatch.setattr(registration, "_async_create_reload_notice", AsyncMock())
    added: list[str] = []
    monkeypatch.setattr(
        registration.frontend,
        "add_extra_js_url",
        lambda _hass, url: added.append(url),
    )

    first_entry = _Entry()
    first_state = await registration.async_setup_frontend_registration(
        hass, first_entry, card_path
    )
    second_entry = _Entry()
    second_state = await registration.async_setup_frontend_registration(
        hass, second_entry, card_path
    )

    assert first_state.active is False
    assert first_state.resource_status == "updated"
    assert second_state.resource_status == "existing"
    assert second_state.loader == "lovelace_resource"
    assert register_static.await_count == 1
    assert resources.created == []
    assert resources.updated == [
        ("houseplan", {"url": module_url, "res_type": "module"})
    ]
    assert resources.deleted == []
    assert resources.items == [
        {"id": "houseplan", "url": module_url, "type": "module"}
    ]
    assert added == []


async def test_retry_waits_one_second_and_removes_exact_session_fallback(
    hass: HomeAssistant, tmp_path: Path, monkeypatch
) -> None:
    card_path = tmp_path / "houseplan-card.js"
    card_path.write_text("// card", encoding="utf-8")
    entry = _Entry()
    outcomes = iter(
        (
            registration.RegistrationOutcome("registry_pending"),
            registration.RegistrationOutcome("created"),
        )
    )
    monkeypatch.setattr(
        registration,
        "async_register_lovelace_resource",
        AsyncMock(side_effect=lambda *args, **kwargs: next(outcomes)),
    )
    monkeypatch.setattr(
        registration, "_async_create_reload_notice", AsyncMock()
    )
    monkeypatch.setattr(
        hass,
        "http",
        SimpleNamespace(async_register_static_paths=AsyncMock()),
    )

    added: list[str] = []
    removed: list[str] = []
    monkeypatch.setattr(
        registration.frontend, "add_extra_js_url", lambda _hass, url: added.append(url)
    )
    monkeypatch.setattr(
        registration.frontend,
        "remove_extra_js_url",
        lambda _hass, url: removed.append(url),
        raising=False,
    )

    started = {}
    timer = {}

    def fake_at_started(_hass, callback):
        started["callback"] = callback
        return lambda: started.setdefault("cancelled", True)

    def fake_call_later(_hass, delay, callback):
        timer.update({"delay": delay, "callback": callback})
        return lambda: timer.setdefault("cancelled", True)

    monkeypatch.setattr(registration, "async_at_started", fake_at_started)
    monkeypatch.setattr(registration, "async_call_later", fake_call_later)

    state = await registration.async_setup_frontend_registration(
        hass, entry, card_path
    )
    module_url = f"{FRONTEND_URL}?v={VERSION}"
    assert added == [module_url]
    assert state.retry_pending is True
    assert "callback" in started
    assert timer == {}

    started["callback"]()
    assert timer["delay"] == 1.0
    timer["callback"]()
    assert state._retry_task is not None
    await state._retry_task

    assert state.resource_status == "created"
    assert state.loader == "lovelace_resource"
    assert state.retry_pending is False
    assert state.retry_attempted is True
    assert removed == [module_url]


async def test_already_running_setup_still_uses_the_fixed_one_second_delay(
    hass: HomeAssistant, tmp_path: Path, monkeypatch
) -> None:
    card_path = tmp_path / "houseplan-card.js"
    card_path.write_text("// card", encoding="utf-8")
    entry = _Entry()
    register_resource = AsyncMock(
        side_effect=(
            registration.RegistrationOutcome("registry_pending"),
            registration.RegistrationOutcome("created"),
        )
    )
    monkeypatch.setattr(
        registration, "async_register_lovelace_resource", register_resource
    )
    monkeypatch.setattr(registration, "_async_create_reload_notice", AsyncMock())
    monkeypatch.setattr(
        hass,
        "http",
        SimpleNamespace(async_register_static_paths=AsyncMock()),
    )
    monkeypatch.setattr(registration.frontend, "add_extra_js_url", lambda *_: None)
    monkeypatch.setattr(
        registration.frontend, "remove_extra_js_url", lambda *_: None, raising=False
    )

    timer: dict = {}

    def already_started(_hass, callback):
        callback()
        return lambda: None

    def fake_call_later(_hass, delay, callback):
        timer.update({"delay": delay, "callback": callback})
        return lambda: None

    monkeypatch.setattr(registration, "async_at_started", already_started)
    monkeypatch.setattr(registration, "async_call_later", fake_call_later)

    state = await registration.async_setup_frontend_registration(
        hass, entry, card_path
    )

    assert register_resource.await_count == 1
    assert timer["delay"] == registration.FRONTEND_RETRY_DELAY_SECONDS == 1.0
    assert state.retry_pending is True
    timer["callback"]()
    assert state._retry_task is not None
    await state._retry_task
    assert register_resource.await_count == 2
    assert state.resource_status == "created"
    assert state.retry_attempted is True


async def test_failed_retry_becomes_stable_error_fallback_without_another_timer(
    hass: HomeAssistant, tmp_path: Path, monkeypatch
) -> None:
    card_path = tmp_path / "houseplan-card.js"
    card_path.write_text("// card", encoding="utf-8")
    entry = _Entry()
    register_resource = AsyncMock(
        side_effect=(
            registration.RegistrationOutcome("registry_pending"),
            registration.RegistrationOutcome(
                "transient_error", "registry:OSError"
            ),
        )
    )
    monkeypatch.setattr(
        registration, "async_register_lovelace_resource", register_resource
    )
    monkeypatch.setattr(registration, "_async_create_reload_notice", AsyncMock())
    monkeypatch.setattr(
        hass,
        "http",
        SimpleNamespace(async_register_static_paths=AsyncMock()),
    )
    added: list[str] = []
    monkeypatch.setattr(
        registration.frontend,
        "add_extra_js_url",
        lambda _hass, url: added.append(url),
    )
    started: list = []
    timers: list[tuple[float, object]] = []
    monkeypatch.setattr(
        registration,
        "async_at_started",
        lambda _hass, callback: (started.append(callback), lambda: None)[1],
    )
    monkeypatch.setattr(
        registration,
        "async_call_later",
        lambda _hass, delay, callback: (
            timers.append((delay, callback)),
            lambda: None,
        )[1],
    )

    state = await registration.async_setup_frontend_registration(
        hass, entry, card_path
    )
    started[0]()
    timers[0][1]()
    assert state._retry_task is not None
    await state._retry_task

    assert register_resource.await_count == 2
    assert len(started) == 1
    assert len(timers) == 1
    assert state.resource_status == "error_fallback"
    assert state.loader == "extra_module_url"
    assert state.retry_pending is False
    assert state.retry_attempted is True
    assert state.last_error == "registry:OSError"
    assert added == [f"{FRONTEND_URL}?v={VERSION}"]


async def test_retry_lifecycle_handles_are_cancelled(
    hass: HomeAssistant, tmp_path: Path, monkeypatch
) -> None:
    """The entry unload hook owns listeners, timers and a running retry task."""
    card_path = tmp_path / "houseplan-card.js"
    card_path.write_text("// card", encoding="utf-8")
    register_calls = 0
    retry_started = asyncio.Event()

    async def register_resource(*args, **kwargs):
        nonlocal register_calls
        register_calls += 1
        if register_calls < 4:
            return registration.RegistrationOutcome("registry_pending")
        retry_started.set()
        await asyncio.Event().wait()

    monkeypatch.setattr(
        registration, "async_register_lovelace_resource", register_resource
    )
    monkeypatch.setattr(
        registration, "_async_create_reload_notice", AsyncMock()
    )
    monkeypatch.setattr(
        hass,
        "http",
        SimpleNamespace(async_register_static_paths=AsyncMock()),
    )
    monkeypatch.setattr(registration.frontend, "add_extra_js_url", lambda *_: None)

    started_records: list[dict] = []
    timer_records: list[dict] = []

    def fake_at_started(_hass, callback):
        record = {"callback": callback, "cancelled": 0}
        started_records.append(record)

        def cancel():
            record["cancelled"] += 1

        return cancel

    def fake_call_later(_hass, _delay, callback):
        record = {"callback": callback, "cancelled": 0}
        timer_records.append(record)

        def cancel():
            record["cancelled"] += 1

        return cancel

    monkeypatch.setattr(registration, "async_at_started", fake_at_started)
    monkeypatch.setattr(registration, "async_call_later", fake_call_later)

    # Generation 1: unload before HA starts cancels the registered start hook.
    before_start_entry = _Entry()
    before_start_state = await registration.async_setup_frontend_registration(
        hass, before_start_entry, card_path
    )
    assert len(before_start_entry.unload_callbacks) == 1
    before_start_entry.unload_callbacks[0]()
    assert started_records[0]["cancelled"] == 1
    started_records[0]["callback"]()
    assert timer_records == []
    assert before_start_state._retry_task is None

    # Generation 2: unload during the fixed delay cancels its timer and the
    # callback cannot create a late retry task.
    during_delay_entry = _Entry()
    during_delay_state = await registration.async_setup_frontend_registration(
        hass, during_delay_entry, card_path
    )
    started_records[1]["callback"]()
    assert len(timer_records) == 1
    during_delay_entry.unload_callbacks[0]()
    assert timer_records[0]["cancelled"] == 1
    timer_records[0]["callback"]()
    assert during_delay_state._retry_task is None

    # Generation 3: the task created by the real retry callback is cancelled by
    # that generation's registered entry unload callback.
    during_retry_entry = _Entry()
    during_retry_state = await registration.async_setup_frontend_registration(
        hass, during_retry_entry, card_path
    )
    started_records[2]["callback"]()
    assert len(timer_records) == 2
    timer_records[1]["callback"]()
    await retry_started.wait()
    task = during_retry_state._retry_task
    assert task is not None
    during_retry_entry.unload_callbacks[0]()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert task.cancelled()


async def test_old_ha_without_fallback_remover_reports_combined_loader(
    hass: HomeAssistant, monkeypatch
) -> None:
    entry = _Entry()
    state = registration.FrontendRegistrationState(
        card_file_present=True,
        static_path_registered=True,
        resource_status="registry_pending",
        loader="extra_module_url",
        module_url=f"{FRONTEND_URL}?v={VERSION}",
        fallback_added=True,
        retry_pending=True,
    )
    hass.data.setdefault(DOMAIN, {})[
        registration.FRONTEND_REGISTRATION_KEY
    ] = state
    hass.data[DOMAIN][registration.FRONTEND_FALLBACK_URLS_KEY] = {
        state.module_url
    }
    monkeypatch.delattr(registration.frontend, "remove_extra_js_url", raising=False)
    monkeypatch.setattr(
        registration,
        "async_register_lovelace_resource",
        AsyncMock(return_value=registration.RegistrationOutcome("existing")),
    )
    monkeypatch.setattr(
        registration, "_async_create_reload_notice", AsyncMock()
    )

    await registration._async_retry_registration(hass, entry, state)

    assert state.resource_status == "existing"
    assert state.loader == "lovelace_resource_with_session_fallback"
    assert state.fallback_added is True


@pytest.mark.parametrize(
    ("supports_remover", "expected_loader", "expected_fallback"),
    [
        (True, "lovelace_resource", False),
        (False, "lovelace_resource_with_session_fallback", True),
    ],
)
async def test_fallback_survives_unload_reload_and_registry_reconciliation(
    hass: HomeAssistant,
    tmp_path: Path,
    monkeypatch,
    supports_remover: bool,
    expected_loader: str,
    expected_fallback: bool,
) -> None:
    card_path = tmp_path / "houseplan-card.js"
    card_path.write_text("// card", encoding="utf-8")
    module_url = f"{FRONTEND_URL}?v={VERSION}"
    outcomes = iter(
        (
            registration.RegistrationOutcome("registry_pending"),
            registration.RegistrationOutcome("created"),
        )
    )
    monkeypatch.setattr(
        registration,
        "async_register_lovelace_resource",
        AsyncMock(side_effect=lambda *args, **kwargs: next(outcomes)),
    )
    monkeypatch.setattr(registration, "_async_create_reload_notice", AsyncMock())
    monkeypatch.setattr(
        hass,
        "http",
        SimpleNamespace(async_register_static_paths=AsyncMock()),
    )
    monkeypatch.setattr(registration, "async_at_started", lambda *_: lambda: None)

    added: list[str] = []
    removed: list[str] = []
    monkeypatch.setattr(
        registration.frontend,
        "add_extra_js_url",
        lambda _hass, url: added.append(url),
    )
    if supports_remover:
        monkeypatch.setattr(
            registration.frontend,
            "remove_extra_js_url",
            lambda _hass, url: removed.append(url),
            raising=False,
        )
    else:
        monkeypatch.delattr(
            registration.frontend, "remove_extra_js_url", raising=False
        )

    first_entry = _Entry()
    first_state = await registration.async_setup_frontend_registration(
        hass, first_entry, card_path
    )
    assert first_state.loader == "extra_module_url"
    assert registration._owned_fallback_urls(hass) == {module_url}

    for unload_callback in first_entry.unload_callbacks:
        unload_callback()

    second_entry = _Entry()
    second_state = await registration.async_setup_frontend_registration(
        hass, second_entry, card_path
    )

    assert added == [module_url]
    assert second_state.resource_status == "created"
    assert second_state.loader == expected_loader
    assert second_state.fallback_added is expected_fallback
    assert registration._owned_fallback_urls(hass) == (
        {module_url} if expected_fallback else set()
    )
    assert removed == ([module_url] if supports_remover else [])


async def test_preexisting_exact_fallback_is_used_but_never_claimed_or_removed(
    hass: HomeAssistant, monkeypatch
) -> None:
    """An identical user-configured module URL remains user-owned."""
    module_url = f"{FRONTEND_URL}?v={VERSION}"
    manager = SimpleNamespace(urls=frozenset({module_url}))
    monkeypatch.setitem(
        hass.data, registration.frontend.DATA_EXTRA_MODULE_URL, manager
    )
    added: list[str] = []
    removed: list[str] = []
    monkeypatch.setattr(
        registration.frontend,
        "add_extra_js_url",
        lambda _hass, url: added.append(url),
    )
    monkeypatch.setattr(
        registration.frontend,
        "remove_extra_js_url",
        lambda _hass, url: removed.append(url),
        raising=False,
    )
    monkeypatch.setattr(
        registration.persistent_notification,
        "async_dismiss",
        lambda *_: None,
    )
    hass.data.pop("lovelace", None)
    state = registration.FrontendRegistrationState(
        card_file_present=True,
        static_path_registered=True,
        resource_status="registry_pending",
        module_url=module_url,
    )
    hass.data.setdefault(DOMAIN, {})[
        registration.FRONTEND_REGISTRATION_KEY
    ] = state

    registration._add_fallback(hass, state)

    assert added == []
    assert state.loader == "extra_module_url"
    assert state.fallback_added is True
    assert registration._owned_fallback_urls(hass) == set()
    assert registration._remove_fallback(hass, state) is False
    assert state.loader == "extra_module_url"
    assert removed == []

    await registration.async_remove_frontend_registration(hass, _Entry())
    assert removed == []
    assert manager.urls == frozenset({module_url})


async def test_reload_notice_is_localized_and_persisted_once(
    hass: HomeAssistant, monkeypatch
) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    state = registration.FrontendRegistrationState(
        card_file_present=True,
        static_path_registered=True,
        resource_status="existing",
        loader="lovelace_resource",
        module_url=f"{FRONTEND_URL}?v={VERSION}",
    )
    hass.data.setdefault(DOMAIN, {})[
        registration.FRONTEND_REGISTRATION_KEY
    ] = state
    monkeypatch.setattr(
        registration,
        "async_get_translations",
        AsyncMock(
            return_value={
                registration._NOTICE_TITLE_KEY: "Локальный заголовок",
                registration._NOTICE_DESCRIPTION_KEY: "Локальный текст",
            }
        ),
    )
    created = []
    monkeypatch.setattr(
        registration.persistent_notification,
        "async_create",
        lambda _hass, message, *, title, notification_id: created.append(
            (message, title, notification_id)
        ),
    )

    await registration._async_create_reload_notice(hass, entry, state)
    assert created == [
        (
            "Локальный текст",
            "Локальный заголовок",
            registration.FRONTEND_RELOAD_NOTICE_ID,
        )
    ]
    assert entry.data[registration.FRONTEND_RELOAD_NOTICE_DATA_KEY] is True
    assert state.first_reload_notice == "created"

    await registration._async_create_reload_notice(hass, entry, state)
    assert len(created) == 1
    assert state.first_reload_notice == "created"


async def test_reload_notice_translation_is_available_from_issues_catalog(
    hass: HomeAssistant,
) -> None:
    translations = await registration.async_get_translations(
        hass, "ru", "issues", integrations={DOMAIN}
    )
    assert translations[registration._NOTICE_TITLE_KEY] == (
        "Карточка House Plan подключена"
    )
    assert "Ctrl+F5" in translations[registration._NOTICE_DESCRIPTION_KEY]


async def test_reload_notice_uses_english_fallback_when_translation_fails(
    hass: HomeAssistant, monkeypatch
) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    state = registration.FrontendRegistrationState(
        card_file_present=True,
        static_path_registered=True,
        resource_status="existing",
        loader="lovelace_resource",
        module_url=f"{FRONTEND_URL}?v={VERSION}",
    )
    hass.data.setdefault(DOMAIN, {})[
        registration.FRONTEND_REGISTRATION_KEY
    ] = state
    monkeypatch.setattr(
        registration,
        "async_get_translations",
        AsyncMock(side_effect=OSError("translation store unavailable")),
    )
    created: list[tuple[str, str, str]] = []
    monkeypatch.setattr(
        registration.persistent_notification,
        "async_create",
        lambda _hass, message, *, title, notification_id: created.append(
            (message, title, notification_id)
        ),
    )

    await registration._async_create_reload_notice(hass, entry, state)

    assert created == [
        (
            registration._NOTICE_DESCRIPTION_FALLBACK,
            registration._NOTICE_TITLE_FALLBACK,
            registration.FRONTEND_RELOAD_NOTICE_ID,
        )
    ]
    assert entry.data[registration.FRONTEND_RELOAD_NOTICE_DATA_KEY] is True
    assert state.first_reload_notice == "created"


async def test_reload_notice_create_failure_does_not_consume_one_shot_flag(
    hass: HomeAssistant, monkeypatch
) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    state = registration.FrontendRegistrationState(
        card_file_present=True,
        static_path_registered=True,
        resource_status="existing",
        loader="lovelace_resource",
        module_url=f"{FRONTEND_URL}?v={VERSION}",
    )
    hass.data.setdefault(DOMAIN, {})[
        registration.FRONTEND_REGISTRATION_KEY
    ] = state
    monkeypatch.setattr(
        registration, "async_get_translations", AsyncMock(return_value={})
    )

    def fail_create(*_args, **_kwargs):
        raise OSError("create failed")

    monkeypatch.setattr(
        registration.persistent_notification,
        "async_create",
        fail_create,
    )

    await registration._async_create_reload_notice(hass, entry, state)

    assert registration.FRONTEND_RELOAD_NOTICE_DATA_KEY not in entry.data
    assert state.first_reload_notice == "pending_frontend"


async def test_reload_notice_rolls_back_when_flag_persist_fails_then_retries(
    hass: HomeAssistant, monkeypatch
) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    state = registration.FrontendRegistrationState(
        card_file_present=True,
        static_path_registered=True,
        resource_status="existing",
        loader="lovelace_resource",
        module_url=f"{FRONTEND_URL}?v={VERSION}",
    )
    hass.data.setdefault(DOMAIN, {})[
        registration.FRONTEND_REGISTRATION_KEY
    ] = state
    monkeypatch.setattr(
        registration, "async_get_translations", AsyncMock(return_value={})
    )
    created: list[str] = []
    dismissed: list[str] = []
    monkeypatch.setattr(
        registration.persistent_notification,
        "async_create",
        lambda _hass, _message, *, title, notification_id: created.append(
            notification_id
        ),
    )
    monkeypatch.setattr(
        registration.persistent_notification,
        "async_dismiss",
        lambda _hass, notification_id: dismissed.append(notification_id),
    )
    real_update_entry = hass.config_entries.async_update_entry
    update_attempts = 0

    def flaky_update_entry(config_entry, **changes):
        nonlocal update_attempts
        update_attempts += 1
        if update_attempts == 1:
            raise OSError("storage write failed")
        return real_update_entry(config_entry, **changes)

    monkeypatch.setattr(
        hass.config_entries, "async_update_entry", flaky_update_entry
    )

    await registration._async_create_reload_notice(hass, entry, state)
    assert registration.FRONTEND_RELOAD_NOTICE_DATA_KEY not in entry.data
    assert state.first_reload_notice == "pending_frontend"
    assert dismissed == [registration.FRONTEND_RELOAD_NOTICE_ID]

    await registration._async_create_reload_notice(hass, entry, state)
    assert created == [
        registration.FRONTEND_RELOAD_NOTICE_ID,
        registration.FRONTEND_RELOAD_NOTICE_ID,
    ]
    assert entry.data[registration.FRONTEND_RELOAD_NOTICE_DATA_KEY] is True
    assert state.first_reload_notice == "created"


async def test_parallel_notice_completion_still_creates_once(
    hass: HomeAssistant, monkeypatch
) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    state = registration.FrontendRegistrationState(
        card_file_present=True,
        static_path_registered=True,
        resource_status="registry_pending",
        loader="extra_module_url",
        module_url=f"{FRONTEND_URL}?v={VERSION}",
    )
    hass.data.setdefault(DOMAIN, {})[
        registration.FRONTEND_REGISTRATION_KEY
    ] = state
    translation_started = asyncio.Event()
    release_translation = asyncio.Event()

    async def slow_translation(*args, **kwargs):
        translation_started.set()
        await release_translation.wait()
        return {}

    monkeypatch.setattr(registration, "async_get_translations", slow_translation)
    created = []
    monkeypatch.setattr(
        registration.persistent_notification,
        "async_create",
        lambda *args, **kwargs: created.append((args, kwargs)),
    )

    first = hass.async_create_task(
        registration._async_create_reload_notice(hass, entry, state),
        "first reload notice",
    )
    await translation_started.wait()
    second = hass.async_create_task(
        registration._async_create_reload_notice(hass, entry, state),
        "retry reload notice",
    )
    release_translation.set()
    await asyncio.gather(first, second)

    assert len(created) == 1
    assert entry.data[registration.FRONTEND_RELOAD_NOTICE_DATA_KEY] is True
    assert state.first_reload_notice == "created"


async def test_notice_waits_for_an_available_frontend(
    hass: HomeAssistant, monkeypatch
) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    state = registration.FrontendRegistrationState(card_file_present=False)
    hass.data.setdefault(DOMAIN, {})[
        registration.FRONTEND_REGISTRATION_KEY
    ] = state
    created = []
    monkeypatch.setattr(
        registration.persistent_notification,
        "async_create",
        lambda *args, **kwargs: created.append((args, kwargs)),
    )

    await registration._async_create_reload_notice(hass, entry, state)
    assert created == []
    assert registration.FRONTEND_RELOAD_NOTICE_DATA_KEY not in entry.data
    assert state.first_reload_notice == "pending_frontend"


async def test_uninstall_removes_all_base_url_entries_fallback_and_notice(
    hass: HomeAssistant, monkeypatch
) -> None:
    module_url = f"{FRONTEND_URL}?v={VERSION}"
    resources = _StorageResources(
        [
            {"id": "old", "url": f"{FRONTEND_URL}?v=old", "type": "module"},
            {"id": "current", "url": module_url, "type": "module"},
            {"id": "other", "url": "/local/other.js", "type": "module"},
        ]
    )
    hass.data["lovelace"] = SimpleNamespace(resources=resources)
    state = registration.FrontendRegistrationState(
        card_file_present=True,
        static_path_registered=True,
        resource_status="yaml_fallback",
        loader="extra_module_url",
        module_url=module_url,
        fallback_added=True,
    )
    hass.data.setdefault(DOMAIN, {})[
        registration.FRONTEND_REGISTRATION_KEY
    ] = state
    hass.data[DOMAIN][registration.FRONTEND_FALLBACK_URLS_KEY] = {module_url}
    removed = []
    dismissed = []
    monkeypatch.setattr(
        registration.frontend,
        "remove_extra_js_url",
        lambda _hass, url: removed.append(url),
        raising=False,
    )
    monkeypatch.setattr(
        registration.persistent_notification,
        "async_dismiss",
        lambda _hass, notification_id: dismissed.append(notification_id),
    )

    await registration.async_remove_frontend_registration(hass, _Entry())
    assert removed == [module_url]
    assert dismissed == [registration.FRONTEND_RELOAD_NOTICE_ID]
    assert resources.deleted == ["old", "current"]
    assert [item["id"] for item in resources.items] == ["other"]


async def test_uninstall_continues_after_one_resource_delete_fails(
    hass: HomeAssistant, monkeypatch
) -> None:
    """Best-effort cleanup attempts every owned registry entry independently."""
    module_url = f"{FRONTEND_URL}?v={VERSION}"
    resources = _StorageResources(
        [
            {"id": "fails", "url": f"{FRONTEND_URL}?v=old", "type": "module"},
            {"id": "removed", "url": module_url, "type": "module"},
            {"id": "other", "url": "/local/other.js", "type": "module"},
        ]
    )
    attempted: list[str] = []
    real_delete = resources.async_delete_item

    async def flaky_delete(item_id: str) -> None:
        attempted.append(item_id)
        if item_id == "fails":
            raise OSError("registry item is busy")
        await real_delete(item_id)

    resources.async_delete_item = flaky_delete
    hass.data["lovelace"] = SimpleNamespace(resources=resources)
    monkeypatch.setattr(
        registration.persistent_notification,
        "async_dismiss",
        lambda *_: None,
    )

    await registration.async_remove_frontend_registration(hass, _Entry())

    assert attempted == ["fails", "removed"]
    assert resources.deleted == ["removed"]
    assert [item["id"] for item in resources.items] == ["fails", "other"]


async def test_uninstall_removes_owned_fallback_from_an_older_setup_generation(
    hass: HomeAssistant, monkeypatch
) -> None:
    module_url = f"{FRONTEND_URL}?v={VERSION}"
    hass.data.setdefault(DOMAIN, {})[
        registration.FRONTEND_REGISTRATION_KEY
    ] = registration.FrontendRegistrationState(card_file_present=False)
    hass.data[DOMAIN][registration.FRONTEND_FALLBACK_URLS_KEY] = {module_url}
    removed: list[str] = []
    monkeypatch.setattr(
        registration.frontend,
        "remove_extra_js_url",
        lambda _hass, url: removed.append(url),
        raising=False,
    )
    monkeypatch.setattr(
        registration.persistent_notification,
        "async_dismiss",
        lambda *_: None,
    )

    await registration.async_remove_frontend_registration(hass, _Entry())

    assert removed == [module_url]
    assert registration._owned_fallback_urls(hass) == set()


@pytest.mark.parametrize(
    ("state_kwargs", "expected"),
    [
        pytest.param(
            None,
            {
                "card_file": "missing",
                "static_path": "not_registered",
                "resource_status": "not_attempted",
                "resource_loader": "none",
                "resource_url": "unavailable",
                "resource_retry": "not_needed",
                "resource_error": "none",
                "first_reload_notice": "pending_frontend",
            },
            id="no-frontend-state",
        ),
        pytest.param(
            {"card_file_present": False},
            {
                "card_file": "missing",
                "static_path": "not_registered",
                "resource_status": "not_attempted",
                "resource_loader": "none",
                "resource_url": "unavailable",
                "resource_retry": "not_needed",
                "resource_error": "none",
                "first_reload_notice": "pending_frontend",
            },
            id="bundle-missing",
        ),
        pytest.param(
            {
                "card_file_present": True,
                "static_path_registered": True,
                "resource_status": "existing",
                "loader": "lovelace_resource",
                "module_url": f"{FRONTEND_URL}?v={VERSION}",
                "first_reload_notice": "already_created",
            },
            {
                "card_file": "present",
                "static_path": "registered",
                "resource_status": "existing",
                "resource_loader": "lovelace_resource",
                "resource_url": f"{FRONTEND_URL}?v={VERSION}",
                "resource_retry": "not_needed",
                "resource_error": "none",
                "first_reload_notice": "already_created",
            },
            id="registry-success",
        ),
        pytest.param(
            {
                "card_file_present": True,
                "static_path_registered": True,
                "resource_status": "registry_pending",
                "loader": "extra_module_url",
                "module_url": f"{FRONTEND_URL}?v={VERSION}",
                "retry_pending": True,
            },
            {
                "card_file": "present",
                "static_path": "registered",
                "resource_status": "registry_pending",
                "resource_loader": "extra_module_url",
                "resource_url": f"{FRONTEND_URL}?v={VERSION}",
                "resource_retry": "pending",
                "resource_error": "none",
                "first_reload_notice": "pending_frontend",
            },
            id="registry-pending",
        ),
        pytest.param(
            {
                "card_file_present": True,
                "static_path_registered": True,
                "resource_status": "created",
                "loader": "lovelace_resource",
                "module_url": f"{FRONTEND_URL}?v={VERSION}",
                "retry_attempted": True,
                "first_reload_notice": "created",
            },
            {
                "card_file": "present",
                "static_path": "registered",
                "resource_status": "created",
                "resource_loader": "lovelace_resource",
                "resource_url": f"{FRONTEND_URL}?v={VERSION}",
                "resource_retry": "attempted",
                "resource_error": "none",
                "first_reload_notice": "created",
            },
            id="retry-success",
        ),
        pytest.param(
            {
                "card_file_present": True,
                "static_path_registered": True,
                "resource_status": "transient_error",
                "loader": "extra_module_url",
                "module_url": f"{FRONTEND_URL}?v={VERSION}",
                "retry_pending": True,
                "last_error": "registry:OSError",
            },
            {
                "card_file": "present",
                "static_path": "registered",
                "resource_status": "transient_error",
                "resource_loader": "extra_module_url",
                "resource_url": f"{FRONTEND_URL}?v={VERSION}",
                "resource_retry": "pending",
                "resource_error": "registry:OSError",
                "first_reload_notice": "pending_frontend",
            },
            id="transient-exception-before-retry",
        ),
        pytest.param(
            {
                "card_file_present": True,
                "static_path_registered": True,
                "resource_status": "yaml_fallback",
                "loader": "extra_module_url",
                "module_url": f"{FRONTEND_URL}?v={VERSION}",
            },
            {
                "card_file": "present",
                "static_path": "registered",
                "resource_status": "yaml_fallback",
                "resource_loader": "extra_module_url",
                "resource_url": f"{FRONTEND_URL}?v={VERSION}",
                "resource_retry": "not_needed",
                "resource_error": "none",
                "first_reload_notice": "pending_frontend",
            },
            id="yaml-fallback",
        ),
        pytest.param(
            {
                "card_file_present": True,
                "static_path_registered": True,
                "resource_status": "error_fallback",
                "loader": "extra_module_url",
                "module_url": f"{FRONTEND_URL}?v={VERSION}",
                "retry_attempted": True,
                "last_error": "registry:RuntimeError",
            },
            {
                "card_file": "present",
                "static_path": "registered",
                "resource_status": "error_fallback",
                "resource_loader": "extra_module_url",
                "resource_url": f"{FRONTEND_URL}?v={VERSION}",
                "resource_retry": "attempted",
                "resource_error": "registry:RuntimeError",
                "first_reload_notice": "pending_frontend",
            },
            id="exception-fallback",
        ),
    ],
)
async def test_system_health_reports_frontend_registration_matrix(
    hass: HomeAssistant, monkeypatch, state_kwargs, expected
) -> None:
    from custom_components.houseplan import system_health

    class _Store:
        def __init__(self, value):
            self.value = value

        async def async_load(self):
            return self.value

    data = SimpleNamespace(
        config_store=_Store(
            {
                "config": {
                    "spaces": [
                        {
                            "rooms": [{}],
                            "room_drafts": [{}, {}],
                            "partitions": [{}],
                            "wall_columns": [{}, {}],
                        }
                    ],
                    "markers": [{}, {}, {}],
                },
                "rev": 4,
            }
        ),
        store=_Store({"layout": {"a": {}, "b": {}}}),
    )
    monkeypatch.setattr(system_health, "get_data", lambda _hass: data)
    domain_data = hass.data.setdefault(DOMAIN, {})
    domain_data.pop(registration.FRONTEND_REGISTRATION_KEY, None)
    if state_kwargs is not None:
        domain_data[registration.FRONTEND_REGISTRATION_KEY] = (
            registration.FrontendRegistrationState(**state_kwargs)
        )

    result = await system_health.system_health_info(hass)
    frontend_fields = {
        key: result[key]
        for key in (
            "card_file",
            "static_path",
            "resource_status",
            "resource_loader",
            "resource_url",
            "resource_retry",
            "resource_error",
            "first_reload_notice",
        )
    }
    assert frontend_fields == expected
    assert {
        key: result[key]
        for key in (
            "config_rev",
            "spaces",
            "rooms",
            "room_drafts",
            "partitions",
            "wall_columns",
            "markers",
            "layout_entries",
        )
    } == {
        "config_rev": 4,
        "spaces": 1,
        "rooms": 1,
        "room_drafts": 2,
        "partitions": 1,
        "wall_columns": 2,
        "markers": 3,
        "layout_entries": 2,
    }
