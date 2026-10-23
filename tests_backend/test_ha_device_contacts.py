"""#1003 real authenticated layout/basis CAS and durable config+layout commit."""
import copy
from types import SimpleNamespace

import pytest
from homeassistant.auth.const import GROUP_ID_READ_ONLY
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan.backup_archive import build_archive, read_archive
from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.import_export import build_space_merge, create_export
from custom_components.houseplan.store import get_data


@pytest.fixture(autouse=True)
def _enable(enable_custom_integrations):
    yield


async def _send(client, message):
    await client.send_json_auto_id(message)
    return await client.receive_json()


async def _pair(client):
    results = []
    for kind in ("config", "layout"):
        answer = await _send(client, {"type": "houseplan/" + kind + "/get"})
        assert answer["success"], answer
        results.append(answer["result"])
    return results


async def _seed(hass, hass_ws_client):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    config = {"spaces": [{"id": "floor", "title": "Floor", "rooms": [], "view_box": [0, 0, 1, 1]}],
              "markers": [{"id": "v_a", "binding": "virtual", "space": "floor", "name": "A"}], "settings": {}}
    assert (await _send(client, {"type": "houseplan/config/set", "config": config, "expected_rev": 0}))["success"]
    layout = {"v_a": {"x": 0.2, "y": 0.3, "s": "floor", "future": {"retained": True}},
              "foreign": {"x": 0.8, "y": 0.9, "s": "upstairs"}}
    assert (await _send(client, {"type": "houseplan/layout/set", "layout": layout, "expected_rev": 0}))["success"]
    return entry, client, await _pair(client)


def _request(pair):
    cfg, layout = pair
    config = copy.deepcopy(cfg["config"])
    config["markers"][0]["size"] = 1.5
    position = copy.deepcopy(layout["layout"]["v_a"])
    position["contact_basis"] = {"v": 1, "at": {"x": position["x"], "y": position["y"], "s": "floor"},
                                 "diameter": 0.04, "box": [-0.025375, -0.025375, 0.06, 0.025375]}
    return {"type": "houseplan/config/set", "config": config, "expected_rev": cfg["rev"],
            "contact_layout": {"v_a": position}, "expected_layout_rev": layout["rev"]}


async def test_contact_config_commit_is_a_pair_and_noop_is_exact(hass, hass_ws_client):
    _, client, before = await _seed(hass, hass_ws_client)
    assert before[0]["device_contact_api"] == 1
    request = _request(before)
    answer = await _send(client, request)
    assert answer["success"], answer
    after = await _pair(client)
    assert after[0]["config"]["markers"][0]["size"] == 1.5
    assert after[1]["layout"]["v_a"] == request["contact_layout"]["v_a"]
    assert after[1]["layout"]["foreign"] == before[1]["layout"]["foreign"]
    assert answer["result"]["contact_layout"]["v_a"] == after[1]["layout"]["v_a"]
    noop = _request(after)
    same = await _send(client, noop)
    assert same["success"], same
    assert same["result"]["rev"] == after[0]["rev"]
    assert same["result"]["layout_rev"] == after[1]["rev"]
    assert (await _pair(client))[1]["layout"] == after[1]["layout"]


@pytest.mark.parametrize("kind", ["config", "layout", "invalid-basis"])
async def test_contact_conflict_or_invalid_basis_changes_neither_half(hass, hass_ws_client, kind):
    _, client, before = await _seed(hass, hass_ws_client)
    request = _request(before)
    if kind == "config":
        request["expected_rev"] -= 1
    elif kind == "layout":
        request["expected_layout_rev"] -= 1
    else:
        request["contact_layout"]["v_a"]["contact_basis"]["diameter"] = -1
    answer = await _send(client, request)
    assert not answer["success"]
    assert answer["error"]["code"] == ("invalid_format" if kind == "invalid-basis" else "conflict")
    after = await _pair(client)
    assert after[0]["config"] == before[0]["config"]
    assert after[0]["rev"] == before[0]["rev"]
    assert after[1]["layout"] == before[1]["layout"]
    assert after[1]["rev"] == before[1]["rev"]


async def test_contact_layout_failure_rolls_back_config_and_layout(hass, hass_ws_client, monkeypatch):
    _, client, before = await _seed(hass, hass_ws_client)
    rt = get_data(hass)
    assert rt is not None
    save = rt.store.async_save

    async def fail_new_layout(data):
        if data.get("layout", {}).get("v_a", {}).get("contact_basis"):
            raise OSError("deliberate target layout failure")
        await save(data)

    monkeypatch.setattr(rt.store, "async_save", fail_new_layout)
    answer = await _send(client, _request(before))
    assert not answer["success"], answer
    assert answer["error"]["code"] == "commit_failed"
    after = await _pair(client)
    assert after[0]["config"] == before[0]["config"]
    assert after[1]["layout"] == before[1]["layout"]
    assert after[0]["rev"] == before[0]["rev"]
    assert after[1]["rev"] == before[1]["rev"]


async def test_contact_readonly_cannot_write_either_half(hass, hass_ws_client):
    _, client, before = await _seed(hass, hass_ws_client)
    user = await hass.auth.async_create_user("Reader", group_ids=[GROUP_ID_READ_ONLY])
    token = await hass.auth.async_create_refresh_token(user, client_id="http://houseplan.test")
    reader = await hass_ws_client(hass, access_token=hass.auth.async_create_access_token(token))
    denied = await _send(reader, _request(before))
    assert not denied["success"]
    assert denied["error"]["code"] == "unauthorized"
    after = await _pair(client)
    assert after[0]["config"] == before[0]["config"]
    assert after[1]["layout"] == before[1]["layout"]


async def test_contact_group_cas_also_checks_marker_configuration(hass, hass_ws_client):
    _, client, before = await _seed(hass, hass_ws_client)
    request = {"type": "houseplan/layout/set", "layout": before[1]["layout"],
               "expected_rev": before[1]["rev"], "expected_config_rev": before[0]["rev"] - 1}
    denied = await _send(client, request)
    assert not denied["success"]
    assert denied["error"]["code"] == "conflict"
    assert (await _pair(client))[1]["layout"] == before[1]["layout"]


@pytest.mark.parametrize("kind", ["full", "space"])
async def test_contact_basis_survives_real_transfer_and_space_remap(hass, hass_ws_client, tmp_path, kind):
    _, client, before = await _seed(hass, hass_ws_client)
    assert (await _send(client, _request(before)))["success"]
    config, layout = await _pair(client)
    original = copy.deepcopy(layout["layout"]["v_a"])
    document, _ = create_export(
        SimpleNamespace(instance_id="contact-test"), config, layout, kind=kind,
        space_id="floor" if kind == "space" else None,
        card_version="1.82.0", config_root=tmp_path,
    )
    assert document["payload"]["layout"]["v_a"] == original
    if kind == "full":
        archive, staging = tmp_path / "contacts.zip", tmp_path / "staging"
        staging.mkdir()
        build_archive(archive, document, tmp_path, {})
        restored = read_archive(archive, staging).document
        assert restored["payload"]["layout"]["v_a"] == original
    else:
        _, merged, details = build_space_merge(document, {"spaces": [], "markers": [], "settings": {}}, {}, "skip")
        copied = next(value for value in merged.values() if "contact_basis" in value)
        assert copied["s"] == copied["contact_basis"]["at"]["s"] == details["space_id"]
        assert copied["contact_basis"]["box"] == original["contact_basis"]["box"]
        assert copied["future"] == original["future"]
