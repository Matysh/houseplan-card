"""#1306: actual authenticated WS/Store, stamps and unchanged-space work."""
import asyncio
import copy
import json

import pytest

from test_ha_wall_node_delete import setup
from test_wall_node_merge import CASES, config, intent
from test_node_save_validation import ordinary
from custom_components.houseplan import plan_graph as graph
from custom_components.houseplan import websocket_api as endpoint
from custom_components.houseplan.graph_validation_scope import current_graph_validation_scope
from custom_components.houseplan.import_export import ImportFailure
from custom_components.houseplan.store import get_data


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


def message(snapshot, operation, **extra):
    return {"type":"houseplan/wall/node_move","space_id":"f","expected_rev":snapshot["rev"],"intent":operation,**extra}


@pytest.mark.parametrize("stamp", ["exact","cold","stale"])
async def test_node_writer_trusts_only_exact_stamp_and_restamps_after_durable_ack(hass,hass_ws_client,monkeypatch,stamp):
    source = config(CASES[0]); hidden = config(CASES[0])["spaces"][0]
    hidden["id"] = "hidden"; hidden["plan_graph"]["edges"][0]["props"] = {"witness":"hidden"}
    from custom_components.houseplan.plan_graph import project_graph_space
    source["spaces"].append(project_graph_space(hidden,hidden["plan_graph"])["space"])
    _,client,before = await setup(hass,hass_ws_client,source=source)
    rt=get_data(hass); rt.schema_clean_rev = before["rev"] if stamp=="exact" else (None if stamp=="cold" else before["rev"]-1)
    operation=ordinary(before["config"]["spaces"][0]); original=copy.deepcopy(before["config"]["spaces"][0])
    compute,calls=graph._validate_graph,[]
    def record(value,context=None):
        calls.append(json.dumps(value,sort_keys=True))
        assert current_graph_validation_scope() is not None, "no replay at the durable Store barrier"
        return compute(value,context)
    monkeypatch.setattr(graph,"_validate_graph",record)
    for direction in ["apply","undo","apply"]:
        calls.clear()
        await client.send_json_auto_id(message(before,operation,**({"direction":"undo","before_space":original} if direction=="undo" else {})))
        answer=await client.receive_json(); assert answer["success"],answer
        accepted=answer["result"]
        assert rt.schema_clean_rev == accepted["rev"]
        assert (await rt.config_store.async_load())["config"] == accepted["config"]
        assert accepted["config"]["spaces"][1] == source_hidden(before)
        assert len(calls)==len(set(calls)), "same exact graph was fully checked twice"
        hidden_calls=sum('hidden' in value for value in calls)
        assert hidden_calls == (0 if stamp=="exact" else 1)
        stamp="exact"; before=accepted


def source_hidden(snapshot):
    return snapshot["config"]["spaces"][1]


async def test_pending_store_has_no_ack_or_new_stamp_and_failure_invalidates_trust(hass,hass_ws_client,monkeypatch):
    _,client,before=await setup(hass,hass_ws_client,source=config(CASES[0]))
    rt=get_data(hass); operation=ordinary(before["config"]["spaces"][0])
    original=rt.config_store.async_save; entered=asyncio.Event();release=asyncio.Event();events=[]
    unsub=hass.bus.async_listen("houseplan_config_updated",lambda event:events.append(event.data))
    async def delayed(payload):
        entered.set(); await release.wait(); return await original(payload)
    monkeypatch.setattr(rt.config_store,"async_save",delayed)
    await client.send_json_auto_id(message(before,operation)); response=asyncio.create_task(client.receive_json())
    await entered.wait()
    assert not response.done() and not events and rt.schema_clean_rev is None
    assert (await rt.config_store.async_load())["rev"]==before["rev"]
    release.set();answer=await response;assert answer["success"],answer
    accepted=answer["result"];assert rt.schema_clean_rev==accepted["rev"]
    async def failed(payload):
        raise ImportFailure("commit_failed")
    monkeypatch.setattr(rt.config_store,"async_save",failed)
    await client.send_json_auto_id(message(accepted,operation,direction="undo",before_space=before["config"]["spaces"][0]))
    refusal=await client.receive_json();assert not refusal["success"]
    assert rt.schema_clean_rev is None
    assert (await rt.config_store.async_load())["rev"]==accepted["rev"]
    unsub()


@pytest.mark.parametrize("cold", [False,True])
async def test_invisible_foreign_crossing_is_rejected_with_or_without_stamp(hass,hass_ws_client,cold):
    source=config(CASES[5]);source["spaces"][0]["view_box"]=[0,0,.1,.1]
    _,client,before=await setup(hass,hass_ws_client,source=source)
    rt=get_data(hass)
    if cold:rt.schema_clean_rev=None
    await client.send_json_auto_id(message(before,intent(before["config"]["spaces"][0],CASES[5])))
    answer=await client.receive_json()
    assert not answer["success"] and answer["error"]["code"]=="node_move_merge_topology",answer
    saved=await rt.config_store.async_load()
    assert saved["rev"]==before["rev"] and saved["config"]==before["config"]


async def test_warm_undo_cannot_borrow_graph_proof_for_forged_metadata(hass,hass_ws_client):
    _,client,before=await setup(hass,hass_ws_client,source=config(CASES[0]))
    operation=ordinary(before["config"]["spaces"][0])
    await client.send_json_auto_id(message(before,operation))
    result=await client.receive_json();assert result["success"],result
    after=result["result"]; forged=copy.deepcopy(before["config"]["spaces"][0]);forged["future"]["keep"]=False
    assert get_data(hass).schema_clean_rev==after["rev"]
    await client.send_json_auto_id(message(after,operation,direction="undo",before_space=forged))
    refused=await client.receive_json();assert not refused["success"]
    saved=await get_data(hass).config_store.async_load()
    assert saved["rev"]==after["rev"] and saved["config"]==after["config"]
