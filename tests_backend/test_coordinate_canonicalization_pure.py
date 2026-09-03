"""HA-independent coordinate canonicalisation contracts (#224/#431/#440)."""
from __future__ import annotations

import copy
import json
import math
from pathlib import Path

from custom_components.houseplan.coordinate_canonicalization import (
    COORDINATE_DECIMALS,
    DECOR_BOX_KINDS,
    LATTICE_GRID_N,
    LATTICE_NOISE_STEPS,
    canonicalize_config_geometry,
    canonicalize_lattice_coordinate,
    canonicalize_layout_geometry,
    canonicalize_number,
)

FIXTURE = (
    Path(__file__).parents[1]
    / "test"
    / "fixtures"
    / "coordinate-canonicalization.json"
)


def _fixture() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_python_and_frontend_share_the_scalar_lattice_fixture_contract() -> None:
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


def test_decor_box_catalog_matches_shared_contract() -> None:
    fixture = _fixture()
    assert list(DECOR_BOX_KINDS) == fixture["boxKinds"]

    input_decor = fixture["configInput"]["spaces"][0]["decor"]
    input_boxes = [item for item in input_decor if item["kind"] in DECOR_BOX_KINDS]
    assert sorted(item["kind"] for item in input_boxes) == sorted(fixture["boxKinds"])

    result = canonicalize_config_geometry(fixture["configInput"])
    output_by_id = {item["id"]: item for item in result["spaces"][0]["decor"]}
    expected_by_id = {
        item["id"]: item for item in fixture["configExpected"]["spaces"][0]["decor"]
    }
    for source in input_boxes:
        actual = output_by_id[source["id"]]
        expected = expected_by_id[source["id"]]
        for field in ("x", "y", "w", "h", "angle"):
            assert actual[field] == expected[field]
            assert actual[field] != source[field]

    source_image = next(item for item in input_boxes if item["kind"] == "image")
    image = output_by_id["image"]
    for field in ("asset_id", "opacity", "flip_h", "flip_v", "future"):
        assert image[field] == source_image[field]


def test_scalar_contract_is_symmetric_and_keeps_off_grid_geometry() -> None:
    assert canonicalize_number(1.2345678905) == 1.234567891
    assert canonicalize_number(-1.2345678905) == -1.234567891
    value = 0.20833333333333334
    assert canonicalize_number(value) == 0.208333333
    assert abs(canonicalize_number(value) - value) <= 5e-10
    assert math.isnan(canonicalize_number(float("nan")))
    assert canonicalize_number(float("inf")) == float("inf")


def test_all_4801_lattice_nodes_and_nine_decimal_forms_share_exact_bits() -> None:
    assert LATTICE_GRID_N == 240
    assert LATTICE_NOISE_STEPS == 1e-4
    for index in range(-2400, 2401):
        node = index / LATTICE_GRID_N
        nine_decimal = float(f"{node:.9f}")
        assert canonicalize_lattice_coordinate(node) == node
        assert canonicalize_lattice_coordinate(nine_decimal) == node
        assert canonicalize_lattice_coordinate(
            canonicalize_lattice_coordinate(nine_decimal)
        ) == node
    assert math.copysign(1.0, canonicalize_lattice_coordinate(-0.0)) == 1.0
    assert canonicalize_lattice_coordinate(0.06) == 0.06
    assert canonicalize_lattice_coordinate(0.2875) == 0.2875
    assert canonicalize_lattice_coordinate((1 + 0.999e-4) / 240) == 1 / 240
    assert canonicalize_lattice_coordinate((1 + 1.001e-4) / 240) == 0.004167084
