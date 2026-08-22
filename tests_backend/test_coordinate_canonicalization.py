"""Shared coordinate canonicalisation contract (#224)."""
from __future__ import annotations

import copy
import json
import math
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from custom_components.houseplan import virtual_lights
from custom_components.houseplan.coordinate_canonicalization import (
    COORDINATE_DECIMALS,
    canonicalize_config_geometry,
    canonicalize_layout_geometry,
    canonicalize_number,
)
from custom_components.houseplan.store import (
    async_save_config_state,
    async_save_layout_state,
)
from custom_components.houseplan.validation import (
    CONFIG_SCHEMA,
    LAYOUT_SCHEMA,
    POS_SCHEMA,
)


FIXTURE = (
    Path(__file__).parents[1]
    / "test"
    / "fixtures"
    / "coordinate-canonicalization.json"
)
OPTIMIZE_ROUNDTRIP_FIXTURE = (
    Path(__file__).parents[1]
    / "test"
    / "fixtures"
    / "optimize-storage-roundtrip.json"
)


def _fixture() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_python_and_frontend_share_the_nine_decimal_fixture_contract() -> None:
    fixture = _fixture()
    config_input = fixture["configInput"]
    layout_input = fixture["layoutInput"]
    config_before = copy.deepcopy(config_input)
    layout_before = copy.deepcopy(layout_input)

    assert COORDINATE_DECIMALS == fixture["decimals"]
    config = canonicalize_config_geometry(config_input)
    layout = canonicalize_layout_geometry(layout_input)

    assert config == fixture["configExpected"]
    assert layout == fixture["layoutExpected"]
    assert config_input == config_before
    assert layout_input == layout_before
    assert canonicalize_config_geometry(config) == config
    assert canonicalize_layout_geometry(layout) == layout
    assert math.copysign(1.0, layout["rl:poly"]["x"]) == 1.0


def test_scalar_contract_is_symmetric_and_keeps_off_grid_geometry() -> None:
    assert canonicalize_number(1.2345678905) == 1.234567891
    assert canonicalize_number(-1.2345678905) == -1.234567891
    value = 0.20833333333333334
    assert canonicalize_number(value) == 0.208333333
    assert abs(canonicalize_number(value) - value) <= 5e-10
    assert math.isnan(canonicalize_number(float("nan")))
    assert canonicalize_number(float("inf")) == float("inf")


def test_backend_schemas_apply_the_same_allowlist() -> None:
    fixture = _fixture()
    assert CONFIG_SCHEMA(fixture["configInput"]) == fixture["configExpected"]
    assert LAYOUT_SCHEMA(fixture["layoutInput"]) == fixture["layoutExpected"]
    assert POS_SCHEMA(fixture["layoutInput"]["virtual"]) == fixture["layoutExpected"]["virtual"]


def test_optimize_roundtrip_fixture_has_one_backend_canonical_target() -> None:
    """#248: Python consumes the same cross-runtime target as the Node test."""
    fixture = json.loads(OPTIMIZE_ROUNDTRIP_FIXTURE.read_text(encoding="utf-8"))
    source = fixture["input"]
    expected = fixture["expected"]
    assert canonicalize_config_geometry(source["config"]) == expected["config"]
    assert canonicalize_layout_geometry(source["layout"]) == expected["layout"]
    assert CONFIG_SCHEMA(source["config"]) == expected["config"]
    assert LAYOUT_SCHEMA(source["layout"]) == expected["layout"]


@pytest.mark.asyncio
async def test_storage_helpers_are_the_final_canonical_barrier(monkeypatch) -> None:
    fixture = _fixture()
    reconcile = AsyncMock()
    monkeypatch.setattr(virtual_lights, "async_reconcile_virtual_lights", reconcile)

    config_store = AsyncMock()
    config_store.async_load.return_value = {"rev": 0}
    config_runtime = SimpleNamespace(
        config_store=config_store,
        virtual_light_store=object(),
    )
    payload = await async_save_config_state(
        config_runtime, fixture["configInput"], 1, previous_rev=0
    )
    assert payload["config"] == fixture["configExpected"]
    assert config_store.async_save.await_args.args[0] == payload
    assert reconcile.await_args.args[1] == fixture["configExpected"]

    layout_store = AsyncMock()
    layout_runtime = SimpleNamespace(store=layout_store)
    layout_payload = await async_save_layout_state(
        layout_runtime, {}, fixture["layoutInput"], 1
    )
    assert layout_payload["layout"] == fixture["layoutExpected"]
    assert layout_store.async_save.await_args.args[0] == layout_payload
