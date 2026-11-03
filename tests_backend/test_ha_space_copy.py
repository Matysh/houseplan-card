"""#1227: a real frontend copy crosses the real HA writer without new geometry rules."""
from __future__ import annotations

import copy
import json
import subprocess
from pathlib import Path

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.graph_write import normalize_graph_config
from custom_components.houseplan.store import get_data
from custom_components.houseplan.validation import CONFIG_SCHEMA

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(autouse=True)
def custom_integrations(enable_custom_integrations):
    yield


def source_fixture(kind="wall"):
    walls = [
        {"id": f"w{i}", "a": a, "b": b, "cm": 40, "owners": ["room"]}
        for i, (a, b) in enumerate((([0, 0], [1, 0]), ([1, 0], [1, 1]),
                                  ([1, 1], [0, 1]), ([0, 1], [0, 0])))
    ]
    space = {"id": "source", "title": "Source", "view_box": [0, 0, 3, 1], "cell_cm": 5,
             "rooms": [{"id": "room", "name": "Room", "poly": [[0, 0], [1, 0], [1, 1], [0, 1]],
                        "wall_ids": [wall["id"] for wall in walls]}],
             "wall_segments": walls,
             "walls": [{"key": str(i), "a": wall["a"], "b": wall["b"], "cm": 40} for i, wall in enumerate(walls)],
             "partitions": [{"id": "partition", "a": [2, 0], "b": [3, 0], "cm": 40}],
             "openings": [{"id": "door", "type": "door", "x": .11 if kind == "wall" else 2.11,
                           "y": 0, "angle": 0, "length": .2,
                           "host": {"kind": kind, "id": "w0" if kind == "wall" else "partition", "t": .11}}]}
    return CONFIG_SCHEMA({"model_version": 10, "spaces": [space], "markers": [], "settings": {}})


def frontend_copy(config, seed="proof", source_id="source", **options):
    # Run the shipped TypeScript builder, not a Python facsimile of its result.
    code = """import {createSpaceCopyCandidate} from './test-build/space-copy.js';
    let text='';for await(const chunk of process.stdin)text+=chunk;
    const {config,seed,source_id,options}=JSON.parse(text);
    console.log(JSON.stringify(createSpaceCopyCandidate(config,source_id,'Copy',seed,options).config));"""
    result = subprocess.run(["node", "--input-type=module", "-e", code], cwd=ROOT,
                            input=json.dumps({"config": config, "seed": seed, "source_id": source_id, "options": options}),
                            capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


async def setup_source(hass, kind, model, *, many=False):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    source = source_fixture(kind)
    if many:
        source["spaces"][0]["partitions"].extend(
            {"id": f"extra{i}", "a": [0, 2 + i / 50], "b": [1, 2 + i / 50], "cm": 40} for i in range(20)
        )
    if model == 11:
        source = CONFIG_SCHEMA(normalize_graph_config(source))
    # Emulate an already saved/readable legacy near-end record, exactly the
    # compatibility case: new placement is deliberately stricter.
    runtime = get_data(hass)
    await runtime.config_store.async_save({"rev": 7, "config": source})
    return source


async def write(client, config, rev):
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": config, "expected_rev": rev})
    answer = await client.receive_json()
    return answer


async def read(client):
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    result = await client.receive_json()
    assert result["success"], result
    return result["result"]


@pytest.mark.parametrize("kind", ["wall", "partition"])
@pytest.mark.parametrize("model", [10, 11])
async def test_copy_preserves_near_end_geometry_then_regular_writes_remain_strict(hass, hass_ws_client, kind, model):
    source = await setup_source(hass, kind, model)
    client = await hass_ws_client(hass)
    candidate = frontend_copy(source)
    reply = await write(client, candidate, 7)
    assert reply["success"], reply
    saved = await read(client)
    copied = saved["config"]["spaces"][1]
    opening = copied["openings"][0]
    assert opening["length"] == .2
    assert opening["host"]["t"] == .11
    assert copied["rooms"] == []
    assert saved["config"]["spaces"][0]["openings"][0]["host"]["t"] == .11
    # An unrelated subsequent save inherits the accepted copy after reload.
    renamed = copy.deepcopy(saved["config"])
    renamed["spaces"][1]["title"] = "Renamed"
    reply = await write(client, renamed, saved["rev"])
    assert reply["success"], reply
    saved = await read(client)
    edited = copy.deepcopy(saved["config"])
    edited["spaces"][1]["openings"][0]["length"] += .001
    rejected = await write(client, edited, saved["rev"])
    assert not rejected["success"]
    assert rejected["error"]["code"] == "invalid_partition_opening_jamb_margin"
    assert (await read(client)) == saved


@pytest.mark.parametrize("mutation", ["copied_length", "source", "settings", "extra_space"])
async def test_forged_copy_cannot_inherit_saved_geometry(hass, hass_ws_client, mutation):
    source = await setup_source(hass, "wall", 11)
    client = await hass_ws_client(hass)
    candidate = frontend_copy(source)
    if mutation == "copied_length":
        candidate["spaces"][1]["openings"][0]["length"] += .001
    elif mutation == "source":
        candidate["spaces"][0]["title"] = "Changed source"
    elif mutation == "settings":
        candidate["settings"]["show_lqi"] = False
    else:
        candidate["spaces"].append({"id": "extra", "title": "Extra", "view_box": [0, 0, 1, 1],
                                    "rooms": [], "wall_segments": [], "partitions": [],
                                    "plan_graph": {"version": 1, "nodes": [], "edges": [], "rooms": [], "dependencies": []}})
    before = await read(client)
    rejected = await write(client, candidate, before["rev"])
    assert not rejected["success"], rejected
    assert (await read(client)) == before


async def test_stale_copy_revision_is_rejected(hass, hass_ws_client):
    source = await setup_source(hass, "wall", 11)
    client = await hass_ws_client(hass)
    rejected = await write(client, frontend_copy(source), 6)
    assert not rejected["success"]
    assert rejected["error"]["code"] == "conflict"
    assert (await read(client))["rev"] == 7

async def test_copy_large_graph_and_copy_again(hass, hass_ws_client):
    source = await setup_source(hass, 'wall', 11, many=True)
    client = await hass_ws_client(hass)
    reply = await write(client, frontend_copy(source), 7)
    assert reply['success'], reply
    saved = await read(client)
    # Canonical ID ordering must hold after the serial crosses base36 9/z.
    graph = saved['config']['spaces'][1]['plan_graph']
    assert [n['id'] for n in graph['nodes']] == sorted(n['id'] for n in graph['nodes'])
    assert len(graph['nodes']) > 36
    reply = await write(client, frontend_copy(saved['config'], seed='again', source_id='sproof'), saved['rev'])
    assert reply['success'], reply
    assert len((await read(client))['config']['spaces']) == 3

@pytest.mark.parametrize('furniture,decor', [(False,False), (True,False), (False,True), (True,True)])
async def test_copy_category_selection_is_proved_without_losing_geometry(hass,hass_ws_client,furniture,decor):
    source = await setup_source(hass,'wall',11)
    source['spaces'][0]['decor'] = [
        {'id':'sofa','kind':'furniture','symbol':'sofa','x':.2,'y':.3,'w':.18,'h':.075},
        {'id':'text','kind':'text','x':.5,'y':.5,'text':'Label'},
    ]
    source=CONFIG_SCHEMA(source)
    await get_data(hass).config_store.async_save({'rev':7,'config':source})
    client=await hass_ws_client(hass)
    reply=await write(client,frontend_copy(source,furniture=furniture,decor=decor),7)
    assert reply['success'],reply
    saved=await read(client)
    assert [item['kind'] for item in saved['config']['spaces'][1].get('decor',[])] == (
        (['furniture'] if furniture else []) + (['text'] if decor else []))
    assert saved['config']['spaces'][1]['openings'][0]['length']==.2
