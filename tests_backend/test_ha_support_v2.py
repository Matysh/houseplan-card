"""Real HA WS boundary for opt-in support diagnostics v2 (#942)."""

import asyncio
import json
import threading
from hashlib import sha256

import pytest
from homeassistant.auth.const import GROUP_ID_USER
from test_ha_websocket import (
    _access_token_for_group,
    _setup,
    _support_preview_request,
    _support_submit_request,
)

from custom_components.houseplan.const import CONF_ADMIN_ONLY
from custom_components.houseplan.store import get_data


@pytest.fixture(autouse=True)
def _custom(enable_custom_integrations):
    yield


def observations(config=0, layout=0):
    return {
        "schema": 1,
        "config_rev": config,
        "layout_rev": layout,
        "age_ms": 0,
        "devices": [],
        "vacuums": [],
        "limited": False,
        "environment": {
            "mode": "view",
            "projection": "flat",
            "space": None,
            "write_pending": False,
            "accepted": True,
        },
    }


def request(draft="draft-v2-main", client=None):
    return {
        **_support_preview_request(draft),
        "package_version": 2,
        **({"diagnostics": client} if client is not None else {}),
    }


async def test_v2_capability_preview_and_exact_submit_without_rebuild(
    hass, hass_ws_client, monkeypatch
):
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    capability = (await client.receive_json())["result"]
    assert capability["support_api"] == 1 and capability[
        "support_package_versions"
    ] == [1, 2]
    await client.send_json_auto_id(request(client=observations()))
    response = await client.receive_json()
    assert response["success"], response
    preview = response["result"]
    assert preview["version"] == 2
    package = json.loads(preview["text"])
    assert package["diagnostics"]["snapshot"]["client_status"] == "matched"
    assert preview["coverage"] == package["diagnostics"]["coverage"]
    assert sha256(preview["text"].encode()).hexdigest() == preview["sha256"]
    captured = []

    async def submit(_hass, **kwargs):
        captured.append(kwargs)
        return "hpr-v2-test"

    monkeypatch.setattr(
        "custom_components.houseplan.websocket_api.async_submit_report", submit
    )
    monkeypatch.setattr(
        "custom_components.houseplan.websocket_api.build_support_package",
        lambda *args, **kwargs: pytest.fail("submit rebuilt the preview"),
    )
    submitted = await _support_submit_request(
        client, preview["token"], "v2-exact-bytes"
    )
    assert submitted["success"]
    assert captured[0]["attachment"] == preview["text"].encode()
    assert captured[0]["attachment_sha256"] == preview["sha256"]


@pytest.mark.parametrize(
    "extra",
    [
        {"package_version": 3},
        {"diagnostics": observations()},
        {"package_version": 2, "diagnostics": {"schema": 1, "private": "text"}},
    ],
)
async def test_future_and_mixed_and_malformed_requests_fail_before_capture(
    hass, hass_ws_client, monkeypatch, extra
):
    await _setup(hass)
    monkeypatch.setattr(
        "custom_components.houseplan.support_preview.capture_snapshot",
        lambda *args: pytest.fail("invalid request reached snapshot capture"),
    )
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({**_support_preview_request(), **extra})
    response = await client.receive_json()
    assert (
        response["success"] is False and response["error"]["code"] == "support_rejected"
    )


async def test_nonadmin_writer_cannot_export_denied_facts_and_revocation_blocks_submit(
    hass, hass_ws_client, monkeypatch
):
    await _setup(hass, options={CONF_ADMIN_ONLY: False})
    token = await _access_token_for_group(hass, GROUP_ID_USER)
    writer = next(
        user
        for user in await hass.auth.async_get_users()
        if user.name == f"House Plan {GROUP_ID_USER}"
    )
    denied = {"active": True}
    original = type(writer.permissions).check_entity
    monkeypatch.setattr(
        type(writer.permissions),
        "check_entity",
        lambda self, eid, policy: (
            False
            if eid == "sensor.private_reading" and denied["active"]
            else original(self, eid, policy)
        ),
    )
    runtime = get_data(hass)
    await runtime.config_store.async_save(
        {
            "rev": 7,
            "config": {
                "spaces": [],
                "settings": {},
                "markers": [{"id": "m", "binding": "entity:sensor.private_reading"}],
            },
        }
    )
    await runtime.store.async_save({"rev": 9, "layout": {}})
    hass.states.async_set(
        "sensor.private_reading", "72.9123456789", {"secret": "never copy"}
    )
    client = await hass_ws_client(hass, access_token=token)
    await client.send_json_auto_id(request("draft-v2-denied", observations(7, 9)))
    response = await client.receive_json()
    assert response["success"], response
    package = json.loads(response["result"]["text"])
    assert package["diagnostics"]["devices"]["entities"] == []
    assert "access_denied" in str(package["diagnostics"]["coverage"])
    assert "72.9123456789" not in response["result"]["text"]
    denied["active"] = False
    await client.send_json_auto_id(request("draft-v2-readable", observations(7, 9)))
    readable = (await client.receive_json())["result"]
    facts = json.loads(readable["text"])["diagnostics"]["devices"]["entities"]
    assert facts[0]["shape"] == "numeric" and facts[0]["exists"] is True
    denied["active"] = True
    monkeypatch.setattr(
        "custom_components.houseplan.websocket_api.async_submit_report",
        lambda *args, **kwargs: pytest.fail("read ACL revocation reached transport"),
    )
    answer = await _support_submit_request(client, readable["token"], "v2-revoked-read")
    assert not answer["success"] and answer["error"]["code"] == "unauthorized"


async def test_global_build_cap_rejects_fifth_physical_job_and_preserves_heartbeat(
    hass, hass_ws_client, monkeypatch
):
    from custom_components.houseplan import websocket_api as api

    await _setup(hass)
    release = threading.Event()
    started = []
    real = api.build_support_package

    def blocked(*args, **kwargs):
        started.append(True)
        assert release.wait(20)
        return real(*args, **kwargs)

    monkeypatch.setattr(api, "build_support_package", blocked)
    clients = [await hass_ws_client(hass) for _ in range(5)]
    try:
        for index in range(4):
            await clients[index].send_json_auto_id(request(f"draft-v2-cap-{index}"))
        for _ in range(100):
            if len(started) == 4:
                break
            await asyncio.sleep(0.01)
        assert len(started) == 4, "executor work failed to yield to HA"
        await clients[4].send_json_auto_id(request("draft-v2-cap-fifth"))
        rejected = await clients[4].receive_json()
        assert rejected["error"]["code"] == "support_rate_limited"
        assert len(started) == 4
    finally:
        release.set()
    responses = await asyncio.gather(*(client.receive_json() for client in clients[:4]))
    assert (
        sum(response["success"] for response in responses) == 3
    )  # retained preview quota is unchanged
    await asyncio.sleep(0)
    assert not hass.data["houseplan_support_builds"].leases


async def test_read_revoked_during_executor_prevents_preview_publication(
    hass, hass_ws_client, monkeypatch
):
    from custom_components.houseplan import websocket_api as api

    await _setup(hass, options={CONF_ADMIN_ONLY: False})
    token = await _access_token_for_group(hass, GROUP_ID_USER)
    user = next(
        user
        for user in await hass.auth.async_get_users()
        if user.name == f"House Plan {GROUP_ID_USER}"
    )
    readable = {"yes": True}
    original_acl = type(user.permissions).check_entity
    monkeypatch.setattr(
        type(user.permissions),
        "check_entity",
        lambda self, eid, policy: (
            readable["yes"]
            if eid == "sensor.sample"
            else original_acl(self, eid, policy)
        ),
    )
    runtime = get_data(hass)
    await runtime.config_store.async_save(
        {
            "config": {
                "spaces": [],
                "settings": {},
                "markers": [{"id": "m", "binding": "entity:sensor.sample"}],
            }
        }
    )
    started, release = threading.Event(), threading.Event()
    real = api.build_support_package

    def blocked(*args, **kwargs):
        started.set()
        assert release.wait(20)
        return real(*args, **kwargs)

    monkeypatch.setattr(api, "build_support_package", blocked)
    client = await hass_ws_client(hass, access_token=token)
    await client.send_json_auto_id(request("draft-v2-before-publish"))
    try:
        for _ in range(200):
            if started.is_set():
                break
            await asyncio.sleep(0.01)
        assert started.is_set()
        readable["yes"] = False
    finally:
        release.set()
    answer = await client.receive_json()
    assert not answer["success"] and answer["error"]["code"] == "unauthorized"
    assert not runtime.support_previews


async def test_client_action_panel_claims_and_foreign_runs_cannot_bypass_read_acl(
    hass, hass_ws_client, monkeypatch
):
    from custom_components.houseplan.support_snapshot import capture_snapshot

    await _setup(hass, options={CONF_ADMIN_ONLY: False})
    await hass_ws_client(hass)
    await _access_token_for_group(hass, GROUP_ID_USER)
    user = next(
        user
        for user in await hass.auth.async_get_users()
        if user.name == f"House Plan {GROUP_ID_USER}"
    )
    original_acl = type(user.permissions).check_entity
    monkeypatch.setattr(
        type(user.permissions),
        "check_entity",
        lambda self, eid, policy: (
            False
            if eid in ("sensor.secret", "camera.foreign")
            else original_acl(self, eid, policy)
        ),
    )
    cfg = {
        "spaces": [],
        "markers": [
            {
                "id": "m",
                "binding": "entity:vacuum.robot",
                "controls": ["sensor.secret"],
                "vacuum": {"source": "camera.allowed"},
            }
        ],
        "settings": {
            "summary_panel": {
                "version": 1,
                "blocks": [
                    {
                        "id": "block",
                        "values": [
                            {
                                "id": "value",
                                "source": {
                                    "type": "entity",
                                    "entity_id": "sensor.secret",
                                },
                            }
                        ],
                    }
                ],
            }
        },
    }
    cfg["markers"].append({"id": "v", "binding": "virtual"})
    obs = observations()
    obs["devices"] = [
        {
            "id": "m",
            "binding": "entity:vacuum.robot",
            "action": {"targets": ["sensor.secret"]},
        }
    ]
    obs["devices"].append(
        {
            "id": "v",
            "binding": "virtual",
            "sources": ["marker:m"],
            "face": {
                "source": {"kind": "derived_marker_state", "ref": "marker:m"},
                "shape": "known_enum",
                "outcome": "value",
            },
        }
    )
    obs["environment"]["panel"] = {
        "status": "loaded",
        "values": [
            {
                "block": "block",
                "value": "value",
                "shape": "numeric",
                "reason": "visible",
            }
        ],
    }

    class Recorder:
        class book:
            data = {
                "m": {"current": {"source": "camera.foreign", "points": [[10, 20]]}}
            }

    hass.data["houseplan"]["trail_recorder"] = Recorder()
    snapshot, scope = capture_snapshot(hass, user, cfg, obs)
    assert snapshot["client"]["devices"] == []
    assert snapshot["client"]["environment"]["panel"]["values"] == []
    assert "current" not in snapshot["vacuums"][0]
    assert "sensor.secret" not in scope and "camera.foreign" not in scope
    assert "access_denied" in snapshot["reasons"]
    monkeypatch.setattr(type(user.permissions), "check_entity", lambda *args: True)
    readable, _ = capture_snapshot(hass, user, cfg, obs)
    assert {row["id"] for row in readable["client"]["devices"]} == {"m", "v"}


async def test_capture_never_writes_stores_services_or_registry(
    hass, hass_ws_client, monkeypatch
):
    from homeassistant.helpers import entity_registry as er

    from custom_components.houseplan.support_snapshot import capture_snapshot

    await _setup(hass)
    await hass_ws_client(hass)
    user = next(user for user in await hass.auth.async_get_users() if user.is_admin)
    runtime = get_data(hass)
    for store in (runtime.config_store, runtime.store):
        monkeypatch.setattr(
            store, "async_save", lambda *args: pytest.fail("collector wrote Store")
        )
    monkeypatch.setattr(
        type(hass.services),
        "async_call",
        lambda *args, **kwargs: pytest.fail("collector called a service"),
    )
    monkeypatch.setattr(
        type(er.async_get(hass)),
        "async_update_entity",
        lambda *args, **kwargs: pytest.fail("collector wrote registry"),
    )
    snapshot, _ = capture_snapshot(
        hass, user, {"settings": {}, "spaces": [], "markers": []}, observations()
    )
    assert snapshot["client"]["devices"] == []


async def test_populated_ha_capture_projects_real_cached_paths_sources_and_attribute_shapes(
    hass, hass_ws_client
):
    from homeassistant.helpers import entity_registry as er
    from test_support_package import _facts

    from custom_components.houseplan.support_package import build_support_package
    from custom_components.houseplan.support_snapshot import capture_snapshot

    await _setup(hass)
    await hass_ws_client(hass)
    user = next(user for user in await hass.auth.async_get_users() if user.is_admin)
    for domain, key in (
        ("vacuum", "robot"),
        ("camera", "synthetic"),
        ("sensor", "reading"),
    ):
        er.async_get(hass).async_get_or_create(
            domain, "mqtt", key, suggested_object_id=key
        )
    hass.states.async_set("vacuum.robot", "cleaning")
    hass.states.async_set(
        "sensor.reading", "private text", {"signal": "27.34567890123"}
    )
    hass.states.async_set(
        "camera.synthetic",
        "idle",
        {
            "map_name": "",
            "vacuum_position": {"x": 10, "y": 20},
            "path": [[0, 0], [1, 1], [True, 2], [3, 3]],
        },
    )
    cfg = {
        "settings": {},
        "spaces": [
            {
                "id": "floor",
                "rooms": [
                    {
                        "id": "room",
                        "name": "private room",
                        "points": [[0, 0], [10, 0], [10, 10]],
                        "settings": {"temp_source": "entity:sensor.reading"},
                    }
                ],
                "wall_segments": [],
            }
        ],
        "markers": [
            {
                "id": "m",
                "space": "floor",
                "binding": "entity:vacuum.robot",
                "vacuum": {
                    "source": "camera.synthetic",
                    "map_routes": [
                        {
                            "id": "route",
                            "source": "camera.synthetic",
                            "map_id": "",
                            "space": "floor",
                            "calibration": [1, 0, 0, 1, 10, 20],
                        }
                    ],
                },
            }
        ],
    }
    obs = observations(7, 9)
    obs["devices"] = [
        {
            "id": "m",
            "binding": "entity:vacuum.robot",
            "sources": ["camera.synthetic"],
            "face": {
                "source": {
                    "kind": "entity_attribute",
                    "entity_id": "sensor.reading",
                    "attribute": "signal",
                },
                "shape": "numeric",
                "attribute_present": True,
                "outcome": "value",
            },
        }
    ]
    obs["vacuums"] = [
        {
            "marker": "m",
            "source": "camera.synthetic",
            "source_status": "ok",
            "moving": True,
            "route": "route",
            "map_id": "",
            "rooms": [{"id": "segment", "anchor": [10, 20], "plan_room": "room"}],
        }
    ]

    class Recorder:
        class book:
            data = {
                "m": {
                    "current": {
                        "path_format": 2,
                        "source": "camera.synthetic",
                        "map_id": "",
                        "route_id": "route",
                        "paths": [[[0, 0], [1, 1]]],
                        "started": 100.25,
                        "ended": None,
                        "received_at": 110,
                        "quality": {
                            "source": "native",
                            "reason": "ok",
                            "raw_points": 8,
                            "stored_points": 2,
                        },
                        "provenance": {
                            "provider": "dreame",
                            "schema": "tasshack-2.0.2",
                        },
                        "final_status": "unconfirmed",
                    },
                    "previous": {
                        "path_format": 2,
                        "source": "camera.synthetic",
                        "map_id": "",
                        "route_id": "route",
                        "paths": [[[90, 90]]],
                        "ended": 90,
                        "final_status": "confirmed",
                    },
                }
            }

    hass.data["houseplan"]["trail_recorder"] = Recorder()
    snapshot, scope = capture_snapshot(hass, user, cfg, obs)
    assert {"vacuum.robot", "camera.synthetic", "sensor.reading"} <= set(scope)
    raw, _ = build_support_package(
        cfg,
        {},
        config_rev=7,
        layout_rev=9,
        card_version="1.82.0-beta.1",
        integration_version="1.82.0-beta.1",
        home_assistant_version="2026.10.2",
        runtime=_facts(),
        package_version=2,
        diagnostics=obs,
        server_snapshot=snapshot,
        namespace="populated",
    )
    package = json.loads(raw)
    vacuum = package["diagnostics"]["vacuums"][0]
    config = package["plan_backup"]["config"]["markers"][0]["vacuum"]
    assert (
        vacuum["current"]["source"]
        == vacuum["sources"][0]["source"]
        == config["source"]
    )
    assert vacuum["current"]["map_id"] == config["map_routes"][0]["map_id"]
    assert vacuum["current"]["route_id"] == config["map_routes"][0]["id"]
    assert vacuum["current"]["quality"]["raw_points"] == 8
    assert vacuum["current"]["sample"]["fragments"][0]["points"] == [[0, 0], [1, 1]]
    assert vacuum["previous"]["sample"]["fragments"][0]["points"] == [[90, 90]]
    assert vacuum["sources"][0]["input"]["invalid_points"] == 1
    assert len(vacuum["sources"][0]["input"]["fragments"]) == 2
    assert vacuum["sources"][0]["position"] == [10, 20]
    assert vacuum["current"]["provenance"]["schema"] == "tasshack-2.0.2"
    face = package["diagnostics"]["devices"]["client"][0]["face"]
    fact = next(
        row
        for row in package["diagnostics"]["devices"]["entities"]
        if row["id"] == face["source"]["entity_id"]
    )
    assert fact["attributes"] == [
        {"id": face["source"]["attribute"], "present": True, "shape": "numeric"}
    ]
    assert all(
        value not in raw.decode()
        for value in (
            "private text",
            "private room",
            "27.34567890123",
            "camera.synthetic",
        )
    )
