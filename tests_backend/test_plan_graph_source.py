"""Original graph-migration source is durable, immutable and off layout hotpath."""
import copy
from types import SimpleNamespace

import pytest

from custom_components.houseplan import plan_graph_source as module
from custom_components.houseplan.plan_graph_exact import GraphError


@pytest.fixture
def source_store(monkeypatch):
    documents = {}
    writes = []
    faults = {"after_write": False}

    class Store:
        def __init__(self, hass, version, key):
            self.key = key

        async def async_load(self):
            return copy.deepcopy(documents.get(self.key))

        async def async_save(self, value):
            documents[self.key] = copy.deepcopy(value)
            writes.append(self.key)
            if faults["after_write"]:
                raise OSError("lost acknowledgement")

    async def executor(function, *args):
        return function(*args)

    monkeypatch.setattr(module, "Store", Store)
    return SimpleNamespace(async_add_executor_job=executor), documents, writes, faults


async def test_original_pair_survives_lost_ack_and_is_never_rewritten(source_store):
    hass, documents, writes, faults = source_store
    config = {"rev": 9, "config": {"model_version": 10, "spaces": [{"id": "f", "raw": .100000000123}]}}
    layout = {"rev": 8, "layout": {"device": {"x": .123456789123, "y": .8}}, "config_migration": {"version": 1}}
    original = copy.deepcopy((config, layout))
    source = module.logical_source(config, layout)
    faults["after_write"] = True
    reference = await module.save_source(hass, source)
    assert await module.load_source(hass, reference) == source
    assert await module.save_source(hass, source) == reference
    assert len(writes) == 1
    assert (config, layout) == original
    assert set(reference) == {"version", "sha256", "store", "bytes"}
    assert "config" not in reference and "layout" not in reference
    documents[reference["store"]]["source"]["config"]["spaces"][0]["raw"] = .1
    with pytest.raises(GraphError, match="corrupt"):
        await module.load_source(hass, reference)
    with pytest.raises(GraphError, match="corrupt"):
        await module.save_source(hass, source)


async def test_resource_refusal_precedes_store_write(source_store, monkeypatch):
    hass, documents, writes, _ = source_store
    monkeypatch.setattr(module, "MAX_SOURCE_BYTES", 20)
    with pytest.raises(GraphError, match="source_limit"):
        await module.save_source(hass, {"config": {"name": "x" * 100}})
    assert not documents and not writes


async def test_reference_cannot_read_an_arbitrary_store(source_store):
    hass, _, _, _ = source_store
    with pytest.raises(GraphError, match="reference"):
        await module.load_source(hass, {"version": 1, "sha256": "a" * 64, "store": "auth", "bytes": 1})
