"""#845 fail-closed harness prerequisites; the executable matrix runs in geometry_parity."""
from pathlib import Path

import pytest
from wall_node_parity import frontend, partition_cases, room_cases


def test_issue_845_parity_missing_build_is_an_error(tmp_path: Path):
    with pytest.raises(FileNotFoundError, match="prerequisites are missing"):
        frontend({"action": "cases", "cases": []}, tmp_path / "missing")


def test_issue_845_parity_matrix_keeps_partitions_and_all_room_topologies():
    partitions = partition_cases()
    rooms = room_cases()
    assert len(partitions) == 39
    assert len(rooms) == 36
    for shape in ("pair", "T", "X", "L", "T-partition", "shared-opening"):
        assert any(c["name"].startswith("room-" + shape + "-") for c in rooms)
    assert all(c["input"]["spaces"][0]["rooms"] for c in rooms)
    assert any("offgrid" in c["name"] for c in rooms)
    assert any("grid" in c["name"] for c in rooms)
