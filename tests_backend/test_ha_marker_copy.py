"""#935: real authenticated copy command and recoverable config/layout pair."""
import asyncio
import copy
from pathlib import Path

import pytest
from homeassistant.auth.const import GROUP_ID_READ_ONLY
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan.const import DOMAIN, FILES_DIR, MAX_FILES_COUNT
from custom_components.houseplan.store import get_data


@pytest.fixture(autouse=True)
def _enable(enable_custom_integrations):
    yield


async def _pair(client):
    result = []
    for kind in ("config", "layout"):
        await client.send_json_auto_id({"type": "houseplan/" + kind + "/get"})
        answer = await client.receive_json()
        assert answer["success"], answer
        result.append(answer["result"])
    return result


async def _seed(hass, hass_ws_client, *, real=False, cycle=False):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.states.async_set("switch.source", "off")
    source = {"id": "source", "binding": "entity:switch.source" if real else "virtual",
              "name": "Original", "space": "f1", "is_light": not real,
              "controls": ["marker:controller"] if cycle else ["light.external"],
              "future": {"keep": [1, 2]}}
    config = {"spaces": [{"id": "f1", "title": "Floor", "rooms": [], "view_box": [0, 0, 1, 1],
                          "led_strips": [{"id": "led", "marker": "source", "points": [[.1, .1], [.3, .1]]}]}],
              "markers": [source, {"id": "controller", "binding": "entity:switch.driver", "space": "f1",
                                     "is_light": True, "controls": ["switch.source" if real else "marker:source"]}],
              "settings": {}}
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": config, "expected_rev": 0})
    saved = await client.receive_json()
    assert saved["success"], saved
    await client.send_json_auto_id({"type": "houseplan/layout/set", "expected_rev": 0,
                                  "layout": {"source": {"s": "f1", "x": .2, "y": .2},
                                             "foreign": {"s": "f2", "x": .8, "y": .9}}})
    assert (await client.receive_json())["success"]
    return client, await _pair(client)


def _request(before, **overrides):
    config, layout = before
    source = config["config"]["markers"][0]
    marker = {**copy.deepcopy(source), "id": "v_copy", "binding": "virtual", "name": "Original 2", "is_light": True}
    return {"type": "houseplan/marker/copy", "source_id": source["id"], "source_binding": source["binding"],
            "marker": marker, "position": {"s": "f1", "x": 1.1, "y": -.1},
            "expected_config_rev": config["rev"], "expected_layout_rev": layout["rev"], **overrides}


async def _send(client, request):
    await client.send_json_auto_id(request)
    return await client.receive_json()


@pytest.mark.parametrize("real", [False, True])
async def test_issue_1081_hidden_active_source_can_create_visible_virtual_copy(hass, hass_ws_client, real):
    client, before = await _seed(hass, hass_ws_client, real=real)
    config = copy.deepcopy(before[0]["config"])
    config["markers"][0]["hidden"] = True
    answer = await _send(client, {"type": "houseplan/config/set", "config": config, "expected_rev": before[0]["rev"]})
    assert answer["success"], answer
    before = await _pair(client)
    request = _request(before)
    request["marker"].pop("hidden", None)
    answer = await _send(client, request)
    assert answer["success"], answer
    after = await _pair(client)
    source = next(marker for marker in after[0]["config"]["markers"] if marker["id"] == "source")
    new = next(marker for marker in after[0]["config"]["markers"] if marker["id"] == "v_copy")
    assert source["hidden"] is True
    assert new["binding"] == "virtual" and not new.get("hidden")
    assert after[1]["layout"]["source"] == before[1]["layout"]["source"]


@pytest.mark.parametrize("real", [False, True])
async def test_issue_935_copy_appends_only_its_marker_position_and_incoming_edges(hass, hass_ws_client, real):
    client, before = await _seed(hass, hass_ws_client, real=real)
    events = []
    hass.bus.async_listen("call_service", lambda event: events.append(event.data))
    answer = await _send(client, _request(before))
    assert answer["success"], answer
    after = await _pair(await hass_ws_client(hass))
    expected = copy.deepcopy(before[0]["config"])
    expected["markers"][1]["controls"].append("marker:v_copy")
    expected["markers"].append(_request(before)["marker"])
    assert after[0]["config"] == expected
    assert after[1]["layout"] == {**before[1]["layout"], "v_copy": _request(before)["position"]}
    assert after[0]["rev"] == before[0]["rev"] + 1
    assert after[1]["rev"] == before[1]["rev"] + 1
    assert not events
    assert after[0]["config"]["spaces"] == before[0]["config"]["spaces"]
    # Replay with old revisions never creates a second marker or changes source files.
    replay = await _send(client, _request(before))
    assert replay["error"]["code"] == "conflict"
    assert await _pair(client) == after


@pytest.mark.parametrize("bad", ["config_rev", "layout_rev", "source", "binding", "space", "role", "id", "self", "cycle", "missing_target"])
async def test_issue_935_refused_copy_preserves_both_stores(hass, hass_ws_client, bad):
    client, before = await _seed(hass, hass_ws_client)
    request = _request(before)
    if bad.endswith("_rev"):
        request["expected_" + bad] -= 1
    elif bad == "source":
        request["source_id"] = "gone"
    elif bad == "binding":
        request["marker"]["binding"] = "entity:light.source"
    elif bad == "space":
        request["position"]["s"] = "missing"
    elif bad == "role":
        request["marker"]["is_light"] = False
    elif bad == "id":
        request["marker"]["id"] = "source"
    elif bad == "self":
        request["marker"]["controls"] = ["marker:v_copy"]
    elif bad == "cycle":
        request["marker"]["controls"] = ["marker:controller"]
    elif bad == "missing_target":
        request["marker"]["controls"] = ["marker:missing"]
    answer = await _send(client, request)
    assert not answer["success"], (bad, answer)
    assert await _pair(client) == before


async def test_issue_935_copy_acl_is_server_enforced(hass, hass_ws_client):
    owner, before = await _seed(hass, hass_ws_client)
    user = await hass.auth.async_create_user("Reader", group_ids=[GROUP_ID_READ_ONLY])
    token = await hass.auth.async_create_refresh_token(user, client_id="http://houseplan.test")
    reader = await hass_ws_client(hass, access_token=hass.auth.async_create_access_token(token))
    answer = await _send(reader, _request(before))
    assert answer["error"]["code"] == "unauthorized"
    assert await _pair(owner) == before


@pytest.mark.parametrize("phase", ["before_config", "after_config", "after_layout", "persistent", "recovery"])
async def test_issue_935_copy_pair_write_failure_is_whole_or_restored(hass, hass_ws_client, monkeypatch, phase):
    client, before = await _seed(hass, hass_ws_client)
    runtime = get_data(hass)
    config_save, layout_save = runtime.config_store.async_save, runtime.store.async_save
    failed = False

    async def save_config(value):
        nonlocal failed
        target = value.get("rev") == before[0]["rev"] + 1
        if target and (phase in {"persistent", "recovery"} or (phase == "before_config" and not failed)):
            failed = True
            raise OSError("copy target unavailable")
        await config_save(value)
        if target and phase == "after_config" and not failed:
            failed = True
            raise OSError("reported failure after durable config")

    async def save_layout(value):
        nonlocal failed
        if phase == "recovery" and value.get("optimize_pending", {}).get("kind") == "marker_copy_rollback":
            # Persist the recovery policy but interrupt convergence, as a restart would.
            await layout_save(value)
            raise OSError("rollback pending restart")
        await layout_save(value)
        if phase == "after_layout" and value.get("rev") == before[1]["rev"] + 1 and not failed:
            failed = True
            raise OSError("reported failure after durable layout")

    monkeypatch.setattr(runtime.config_store, "async_save", save_config)
    monkeypatch.setattr(runtime.store, "async_save", save_layout)
    answer = await _send(client, _request(before))
    monkeypatch.setattr(runtime.config_store, "async_save", config_save)
    monkeypatch.setattr(runtime.store, "async_save", layout_save)
    assert failed
    if phase in {"persistent", "recovery"}:
        assert answer["error"]["code"] == "commit_failed"
        if phase == "recovery":
            # Reads expose the coherent previous pair; the next writer/startup
            # completes the retained rollback before judging its CAS.
            assert (await runtime.store.async_load())["optimize_pending"]["kind"] == "marker_copy_rollback"
            no_op = await _send(client, {"type": "houseplan/config/set", "config": before[0]["config"],
                                        "expected_rev": before[0]["rev"]})
            assert no_op["success"], no_op
        after = await _pair(client)
        assert after == before
    else:
        assert answer["success"], answer
        after = await _pair(client)
        assert after[0]["rev"] == before[0]["rev"] + 1
        assert after[1]["rev"] == before[1]["rev"] + 1
        assert after[0]["config"]["markers"][-1]["id"] == "v_copy"
        assert "v_copy" in after[1]["layout"]
    assert "optimize_pending" not in await runtime.store.async_load()


async def test_issue_935_attachment_copy_keeps_original_bytes_and_has_independent_url(hass, hass_ws_client):
    client, before = await _seed(hass, hass_ws_client)
    directory = Path(hass.config.path(FILES_DIR)) / "source"
    directory.mkdir(parents=True, exist_ok=True)
    original = directory / "manual.pdf"
    await hass.async_add_executor_job(original.write_bytes, b"original attachment bytes")
    migrated = await _send(client, {"type": "houseplan/files/migrate", "from_id": "source", "to_id": "v_copy"})
    assert migrated["success"], migrated
    filename = migrated["result"]["mapping"]["manual.pdf"]
    request = _request(before)
    request["marker"]["pdfs"] = [{"name": "Manual", "url": "/api/houseplan/content/files/v_copy/" + filename}]
    assert (await _send(client, request))["success"]
    destination = directory.parent / "v_copy" / filename
    assert await hass.async_add_executor_job(destination.read_bytes) == b"original attachment bytes"
    await hass.async_add_executor_job(destination.unlink)
    assert await hass.async_add_executor_job(original.read_bytes) == b"original attachment bytes"


async def test_issue_935_automatic_entity_without_saved_marker_is_copyable(hass, hass_ws_client):
    client, before = await _seed(hass, hass_ws_client, real=True)
    config = copy.deepcopy(before[0]["config"])
    config["markers"] = config["markers"][1:]
    config["spaces"][0]["led_strips"] = []
    assert (await _send(client, {"type": "houseplan/config/set", "config": config,
                                "expected_rev": before[0]["rev"]}))["success"]
    before = await _pair(client)
    request = _request(before, source_id="lg_switch.source", source_binding="entity:switch.source")
    request["marker"] = {"id": "v_copy", "binding": "virtual", "space": "f1", "name": "Auto 2", "is_light": True}
    answer = await _send(client, request)
    assert answer["success"], answer
    after = await _pair(client)
    assert after[0]["config"]["markers"][0]["controls"] == ["switch.source", "marker:v_copy"]
    assert after[0]["config"]["markers"][-1] == request["marker"]


async def test_issue_935_concurrent_copies_have_one_winner_without_lost_updates(hass, hass_ws_client):
    one, before = await _seed(hass, hass_ws_client)
    two = await hass_ws_client(hass)
    a, b = _request(before), _request(before)
    b["marker"]["id"] = "v_copy_two"
    answers = await asyncio.gather(_send(one, a), _send(two, b))
    assert sorted(answer["success"] for answer in answers) == [False, True]
    rejected = next(answer for answer in answers if not answer["success"])
    assert rejected["error"]["code"] == "conflict"
    after = await _pair(one)
    new = [marker for marker in after[0]["config"]["markers"] if marker["id"].startswith("v_copy")]
    assert len(new) == 1
    assert new[0]["id"] in after[1]["layout"]
    assert after[1]["layout"]["foreign"] == before[1]["layout"]["foreign"]


async def test_issue_935_source_removed_during_cpu_validation_is_refused(hass, hass_ws_client, monkeypatch):
    client, before = await _seed(hass, hass_ws_client, real=True)
    executor = hass.async_add_executor_job

    async def execute(function, *args):
        result = await executor(function, *args)
        if function.__name__ == "validate":
            hass.states.async_remove("switch.source")
        return result

    monkeypatch.setattr(hass, "async_add_executor_job", execute)
    answer = await _send(client, _request(before))
    assert answer["error"]["code"] == "invalid_data"
    assert await _pair(client) == before


async def test_issue_935_concurrent_attachment_copies_respect_existing_store_quota(hass, hass_ws_client):
    one, before = await _seed(hass, hass_ws_client)
    two = await hass_ws_client(hass)
    root = Path(hass.config.path(FILES_DIR))

    def seed():
        (root / "source").mkdir(parents=True)
        (root / "source" / "manual.pdf").write_bytes(b"original")
        (root / "used").mkdir()
        for index in range(MAX_FILES_COUNT - 2):
            (root / "used" / str(index)).write_bytes(b"")

    await hass.async_add_executor_job(seed)
    answers = await asyncio.gather(*[
        _send(client, {"type": "houseplan/files/migrate", "from_id": "source", "to_id": target})
        for client, target in ((one, "v_one"), (two, "v_two"))
    ])
    assert sorted(answer["success"] for answer in answers) == [False, True]
    assert next(answer for answer in answers if not answer["success"])["error"]["code"] == "too_large"
    assert await hass.async_add_executor_job(lambda: sum(path.is_file() for path in root.rglob("*"))) == MAX_FILES_COUNT
    assert await hass.async_add_executor_job((root / "source" / "manual.pdf").read_bytes) == b"original"
    assert await _pair(one) == before
