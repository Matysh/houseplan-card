"""Shared exact-wire and legacy migration corpus, independent Python reader."""
import json
import struct
from pathlib import Path

import pytest

from custom_components.houseplan.plan_graph_exact import decode_rational, encode_point, read_source_point
from custom_components.houseplan.plan_graph_migration import migrate_graph_space


CORPUS = json.loads((Path(__file__).parents[1] / "test/fixtures/plan-graph-corpus.json").read_text())


@pytest.mark.parametrize("case", CORPUS["exact"], ids=lambda c: c["id"])
def test_correct_binary64(case):
    assert struct.pack(">d", float(decode_rational(case["q"]))).hex() == case["hex"]


@pytest.mark.parametrize("case", CORPUS["points"])
def test_canonical_exact_point(case):
    assert encode_point(read_source_point(case["source"])) == case["wire"]


@pytest.mark.parametrize("case", CORPUS["migrations"], ids=lambda c: c["id"])
def test_shared_legacy_migration(case):
    original = json.dumps(case["space"], sort_keys=True)
    result = migrate_graph_space(case["space"])
    for key, expected in case["expected"].items():
        assert len(result["graph"][key]) == expected
    assert json.dumps(case["space"], sort_keys=True) == original
    assert result["migrationReport"]["maxDisplacementCm"] <= .001000001
