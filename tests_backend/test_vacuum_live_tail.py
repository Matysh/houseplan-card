"""#1049: plain bounded geometry, cursor and typed task-proof tests."""
from __future__ import annotations

import json

import pytest

from custom_components.houseplan.vacuum_live_tail import (
    LIVE_POINTS,
    acknowledge_live,
    append_live,
    ensure_live,
    observe_task,
    project_live,
)


def test_only_unique_covered_prefix_is_replaced_newer_samples_survive():
    run = {}
    for i in range(4):
        append_live(run, i * 10, 0, i * 1000, (i * 10, 0), False)
    acknowledge_live(run, [10, 0], (10, 0), 1500)
    live = project_live(run["_live_tail"])
    assert [p[0] for p in live["paths"][0]] == [10, 20, 30]
    acknowledge_live(run, [30, 0], (30, 0), 1500)
    assert project_live(run["_live_tail"]) == live, "read cannot consume later observations"


def test_ambiguous_revisit_or_missing_metric_never_guesses_a_join():
    run = {}
    for i, x in enumerate([0, 10, 20, 10, 30]):
        append_live(run, x, 0, i * 1000, (x, 0), False)
    before = project_live(run["_live_tail"])
    acknowledge_live(run, [10, 0], (10, 0), 10000)
    acknowledge_live(run, [20, 0], None, 10000)
    acknowledge_live(run, [20, 0], (20, 0), None)
    assert project_live(run["_live_tail"]) == before


def test_clock_rollback_does_not_let_a_join_consume_future_fragments():
    run = {}
    append_live(run, 1, 0, 10000, (1, 0), False)
    append_live(run, 2, 0, 20000, (2, 0), False)
    append_live(run, 30, 0, 1000, (30, 0), False)
    before = project_live(run["_live_tail"])
    acknowledge_live(run, [30, 0], (30, 0), 1500)
    assert project_live(run["_live_tail"]) == before


def test_new_epoch_does_not_relabel_cached_prestart_position_as_live():
    run = {}
    ensure_live(run)["since"] = 3000
    assert not append_live(run, 900, 900, 2999, (900, 900), False)
    assert project_live(run["_live_tail"])["paths"] == []
    assert append_live(run, 10, 10, 3001, (10, 10), False)


def test_gaps_clock_rollback_and_limits_never_join_removed_ranges():
    run = {}
    for i in range(LIVE_POINTS + 20):
        append_live(run, i, 0, i * 1000, (i, 0), False)
    tail = project_live(run["_live_tail"])
    assert len(tail["paths"][0]) == LIVE_POINTS and tail["limited"]
    assert tail["paths"][0][0][0] == 20
    epoch = tail["epoch"]
    append_live(run, -1, -1, 0, (-1, -1), False)
    tail = project_live(run["_live_tail"])
    assert tail["epoch"] != epoch and tail["paths"][-1] == [[-1, -1, 0]]
    for i in range(45):
        append_live(run, i, 1, i + 1, (i, 1), True)
    assert len(project_live(run["_live_tail"])["paths"]) <= 32


@pytest.mark.parametrize("sample", [[True, 1, 2], [0, "1", 2], [0, 1, float("inf")],
                                  [10**1000, 1, 2], [0, 1, 2, 3, 4, 5]])
def test_public_tail_rejects_malformed_samples_without_coercion(sample):
    assert project_live({"version": 1, "epoch": "test", "paths": [[sample]]}) is None


def test_public_projection_is_closed_and_store_shape_survives():
    run = {}
    append_live(run, 1, 2, 3, (4, 5), False)
    run["_live_tail"]["token"] = "must-not-escape"
    live = project_live(json.loads(json.dumps(run))["_live_tail"])
    assert live["paths"] == [[[1, 2, 3]]]
    assert set(live) == {"version", "epoch", "paths", "waiting", "limited"}
    assert ensure_live(run)["epoch"] == live["epoch"]


def terminal(**override):
    return {"started": False, **dict.fromkeys(("paused", "cleaning_paused", "washing",
            "washing_paused", "returning_to_wash", "returning_to_wash_paused"), False), **override}


def test_task_boundary_is_consumed_once_and_survives_store():
    record, owner = {}, ("source", "map", "route", "calibration")
    assert observe_task(record, owner, "docked", terminal(), 1, verified=True) == (True, False)
    record = json.loads(json.dumps(record))
    assert observe_task(record, owner, "cleaning", terminal(started=True), 2, verified=True) == (True, True)
    assert observe_task(record, owner, "cleaning", terminal(started=True), 3, verified=True) == (False, False)


@pytest.mark.parametrize("attrs", [terminal(started=True), terminal(washing=True),
    terminal(paused=True), terminal(started="false"), terminal(washing="false"), {"started": False}])
def test_service_docking_malformed_and_unknown_activity_never_arm(attrs):
    record, owner = {}, ("source", "map", "route")
    observe_task(record, owner, "docked", attrs, 1, verified=True)
    assert not observe_task(record, owner, "cleaning", terminal(started=True), 2, verified=True)[1]
    observe_task(record, owner, "docked", terminal(), 3, verified=False)
    assert not observe_task(record, owner, "cleaning", terminal(started=True), 4, verified=True)[1]


def test_changed_owner_does_not_inherit_task_proof():
    record = {}
    observe_task(record, ("A",), "docked", terminal(), 1, verified=True)
    assert not observe_task(record, ("B",), "cleaning", terminal(started=True), 2, verified=True)[1]


def test_malformed_store_is_reset_only_inside_the_known_private_window():
    run = {"paths": [[[0, 0], [1, 1]]], "_live_tail": {"version": 1, "epoch": "bad", "paths": [[True]]}}
    assert ensure_live(run)["paths"] == []
    assert run["paths"] == [[[0, 0], [1, 1]]]
    record = {"_task_activity": {"owner": ["A"], "armed": "false"}}
    assert not observe_task(record, ("A",), "cleaning", terminal(started=True), 1, verified=True)[1]
