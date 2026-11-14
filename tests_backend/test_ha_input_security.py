"""#1395: actual HA worker/preview boundaries keep state and return safe text."""
from __future__ import annotations

import copy
import json

import pytest

from custom_components.houseplan import websocket_api
from custom_components.houseplan.http_api import HouseplanImportPreviewView
from custom_components.houseplan.import_export import ImportFailure, get_candidate
from custom_components.houseplan.store import get_data
from tests_backend.test_ha_import_export import (
    _Connection,
    _ImportPreviewRequest,
    _setup,
)
from tests_backend.test_input_policy import document


@pytest.fixture(autouse=True)
def _integrations(enable_custom_integrations):
    yield


class Content:
    def __init__(self, raw):
        self.raw = raw
    async def iter_chunked(self, size):
        for at in range(0, len(self.raw), size):
            yield self.raw[at:at + size]


def request(hass, raw):
    result = _ImportPreviewRequest(hass, is_admin=True)
    result.content_length = len(raw)
    result.content = Content(raw)
    return result


async def test_deep_import_returns_safe_domain_error_and_next_preview_works(hass, tmp_path):
    await _setup(hass)
    runtime = get_data(hass)
    config = copy.deepcopy(await runtime.config_store.async_load())
    layout = copy.deepcopy(await runtime.store.async_load())
    value = json.dumps(document(tmp_path)).encode()
    deep = value.replace(b'"extra": null', b'"extra":' + b'[' * 1500 + b'0' + b']' * 1500)
    response = await HouseplanImportPreviewView().post(request(hass, deep))
    assert response.status == 400
    assert json.loads(response.text) == {"error": "invalid_config", "message": "invalid_config"}
    assert await runtime.config_store.async_load() == config
    assert await runtime.store.async_load() == layout
    assert not runtime.import_previews and not runtime.write_lock.locked()
    positive = await HouseplanImportPreviewView().post(request(hass, value))
    assert positive.status == 200
    token = json.loads(positive.text)["token"]
    get_candidate(runtime, token, "http-review", consume=True)
    assert not runtime.import_previews
    assert await runtime.config_store.async_load() == config
    assert await runtime.store.async_load() == layout


async def test_export_failure_never_reflects_private_exception_text(hass, monkeypatch):
    await _setup(hass)
    sentinel = "/PRIVATE-FIXTURE/server-path TOKEN=PRIVATE-FIXTURE"
    def refused(*_args, **_kwargs):
        raise ImportFailure("invalid_config", sentinel)
    monkeypatch.setattr(websocket_api, "create_export", refused)
    connection = _Connection()
    await websocket_api.ws_export_create.__wrapped__(hass, connection, {
        "id": 1, "type": "houseplan/export/create", "kind": "full", "card_version": "test",
    })
    assert connection.result is None
    assert connection.error == ("invalid_config", "invalid_config")
    assert sentinel not in str(connection.error)
