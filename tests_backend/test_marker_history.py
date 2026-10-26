"""Ordinary data-only positive/negative witnesses for #1073."""
import copy
from dataclasses import replace

import pytest

from custom_components.houseplan.marker_history import HistoryError, MarkerHistory, delete_candidate, MAX_SESSION_BYTES
from custom_components.houseplan.plans import collect_attachments


def _before():
    return {"config": {"spaces": [{"id": "f1", "led_strips": [{"id": "led", "marker": "lamp", "active": None,
                                                                      "points": [[.1, .2], [.3, .4]]}]}],
                       "markers": [{"id": "lamp", "binding": "device:lamp", "space": "f1", "name": "Lamp", "size": None},
                                   {"id": "other", "binding": "virtual", "space": "f1", "controls": ["marker:lamp", "light.independent"]}],
                       "settings": {"marker_area_snapshot": {"lamp": {"binding": "device:lamp", "area": "room"}, "other": {"area": "other"}}}},
            "layout": {"lamp": {"s": "f1", "x": .1, "y": .2, "future": None}, "other": {"x": .4, "y": .5}}}


def _command(root, service=None):
    service = service or MarkerHistory()
    before = _before()
    config, layout = delete_candidate(before["config"], before["layout"], [{"id": "lamp", "binding": "device:lamp"}])
    after = {"config": config, "layout": layout}
    command = service.prepare(before, after, {"lamp"}, root)
    return service, command, before, after


def test_delete_undo_redo_restores_exact_presence_tombstone_snapshots_layout_led(tmp_path):
    service, command, before, after = _command(tmp_path)
    assert after["config"]["markers"][0] == {"id": "lamp", "binding": "device:lamp", "hidden": True, "removed": True}
    restored = service.candidate(command, after, False, tmp_path)
    assert restored["layout"] == before["layout"]
    assert sorted(restored["config"]["markers"], key=lambda item: item["id"]) == before["config"]["markers"]
    assert restored["config"]["settings"] == before["config"]["settings"]
    assert restored["config"]["spaces"] == before["config"]["spaces"]
    command.after = False
    assert service.candidate(command, restored, True, tmp_path) == after


def test_control_edges_and_unrelated_fields_merge_without_replacing_foreign_data(tmp_path):
    service, command, before, after = _command(tmp_path)
    controller = next(item for item in after["config"]["markers"] if item["id"] == "other")
    controller["controls"].append("light.added_elsewhere")
    controller["name"] = "New name"
    after["layout"]["other"]["x"] = .9
    restored = service.candidate(command, after, False, tmp_path)
    controller = next(item for item in restored["config"]["markers"] if item["id"] == "other")
    assert set(controller["controls"]) == {"marker:lamp", "light.independent", "light.added_elsewhere"}
    assert controller["name"] == "New name"
    assert restored["layout"]["other"]["x"] == .9


@pytest.mark.parametrize("fault", ["target", "edge", "space", "binding", "layout"])
def test_conflicting_changed_data_is_refused_without_mutating_current_pair(tmp_path, fault):
    service, command, _, after = _command(tmp_path)
    if fault == "target":
        after["config"]["markers"][0]["name"] = "Recreated"
    elif fault == "edge":
        after["config"]["markers"][1]["controls"].append("marker:lamp")
    elif fault == "space":
        after["config"]["spaces"] = []
    elif fault == "binding":
        after["config"]["markers"][0]["binding"] = "device:foreign"
    else:
        after["layout"]["lamp"] = {"x": .7, "y": .8}
    unchanged = copy.deepcopy(after)
    with pytest.raises(HistoryError):
        service.candidate(command, after, False, tmp_path)
    assert after == unchanged


def test_identity_aba_observer_invalidates_only_related_commands(tmp_path):
    service, command, before, after = _command(tmp_path)
    session = service.session("session", ("writer", 1), True)
    session.commands["delete"] = command
    changed = copy.deepcopy(after["config"])
    changed["markers"][0] = copy.deepcopy(before["config"]["markers"][0])
    service.observe_identity(after["config"], changed)
    service.observe_identity(changed, after["config"])
    with pytest.raises(HistoryError):
        service.candidate(command, after, False, tmp_path)


@pytest.mark.parametrize("fault", ["controller_binding", "controller_aba", "strip_aba", "space_aba"])
def test_related_identity_changes_and_aba_do_not_restore_edges_into_recreated_owners(tmp_path, fault):
    service, command, _, after = _command(tmp_path)
    session = service.session("session", ("writer", object()), True)
    session.commands["delete"] = command
    changed = copy.deepcopy(after["config"])
    if fault == "controller_binding":
        changed["markers"][1]["binding"] = "entity:light.new_owner"
    elif fault == "controller_aba":
        changed["markers"] = changed["markers"][:1]
    elif fault == "strip_aba":
        changed["spaces"][0]["led_strips"] = []
    else:
        changed["spaces"] = []
    service.observe_identity(after["config"], changed)
    service.observe_identity(changed, after["config"])
    with pytest.raises(HistoryError):
        service.candidate(command, after, False, tmp_path)


def test_server_never_retains_a_51st_command_and_drops_only_after_success(tmp_path):
    service, command, _, _ = _command(tmp_path)
    session = service.session("session", ("writer", object()), True)
    for index in range(50):
        session.commands[str(index)] = command
    with pytest.raises(HistoryError):
        service.check_create(session, None)
    service.check_create(session, [str(index) for index in range(1, 50)])
    assert len(session.commands) == 50, "preflight has no destructive resource effect"
    service.accept_create(session, [str(index) for index in range(1, 50)], "new", command)
    assert len(session.commands) == 50 and "0" not in session.commands and "new" in session.commands


def test_batch_refusal_is_atomic_and_virtual_deletion_has_no_tombstone(tmp_path):
    before = _before()
    unchanged = copy.deepcopy(before)
    with pytest.raises(HistoryError):
        delete_candidate(before["config"], before["layout"], [{"id": "lamp", "binding": "device:lamp"}, {"id": "missing", "binding": "virtual"}])
    assert before == unchanged
    config, layout = delete_candidate(before["config"], before["layout"], [{"id": "lamp", "binding": "device:lamp"}, {"id": "other", "binding": "virtual"}])
    assert all(item["id"] != "other" for item in config["markers"])
    assert not layout


def test_nullable_control_fields_remain_null_and_absent_fields_remain_absent(tmp_path):
    before = _before()
    before["config"]["markers"].extend([{"id": "nullable", "binding": "virtual", "controls": None},
                                         {"id": "absent", "binding": "virtual"}])
    config, _ = delete_candidate(before["config"], before["layout"], [{"id": "lamp", "binding": "device:lamp"}])
    assert next(m for m in config["markers"] if m["id"] == "nullable")["controls"] is None
    assert "controls" not in next(m for m in config["markers"] if m["id"] == "absent")


def test_receipts_are_payload_bound_connection_owned_and_bounded(tmp_path):
    service = MarkerHistory()
    session = service.session("session", ("writer", 1), True)
    service.receipt(session, "action", {"action": "delete"}, {"history_token": "same"})
    assert service.replay(session, "action", {"action": "delete"}) == {"history_token": "same"}
    with pytest.raises(HistoryError):
        service.replay(session, "action", {"action": "redo"})
    for owner in [("writer", 2), ("reader", 1)]:
        with pytest.raises(HistoryError):
            service.session("session", owner)
    for index in range(300):
        service.receipt(session, str(index), {"index": index}, {"index": index})
    assert len(session.receipts) == 256
    service.receipt(session, "large", {"input": "same"}, {"history_token": "token", "config_rev": 2, "layout_rev": 3,
                                                        "config": {"large": "x" * 100000}, "layout": {"large": "x" * 100000}})
    assert service.replay(session, "large", {"input": "same"}) == {"history_token": "token", "config_rev": 2, "layout_rev": 3}


def test_history_memory_quota_refuses_candidate_without_releasing_existing_commands(tmp_path):
    service, command, _, _ = _command(tmp_path)
    session = service.session("session", ("writer", object()), True)
    session.commands["existing"] = command
    with pytest.raises(HistoryError):
        service.check_bytes(session, replace(command, bytes=MAX_SESSION_BYTES + 1), ["existing"])
    assert list(session.commands) == ["existing"]


def test_file_pins_preserve_exact_bytes_across_legacy_collection_and_other_commands(tmp_path):
    now = [0.]
    service = MarkerHistory(lambda: now[0])
    before = _before()
    folder = tmp_path / "lamp"
    folder.mkdir()
    file = folder / "manual.pdf"
    file.write_bytes(b"real attachment bytes")
    before["config"]["markers"][0]["pdfs"] = [{"url": "/api/houseplan/content/files/lamp/manual.pdf"}]
    config, layout = delete_candidate(before["config"], before["layout"], [{"id": "lamp", "binding": "device:lamp"}])
    after = {"config": config, "layout": layout}
    command = service.prepare(before, after, {"lamp"}, tmp_path)
    session = service.session("one", ("writer", 1), True)
    second = service.session("two", ("writer", 2), True)
    session.commands["delete"] = command
    second.commands["delete"] = command
    assert service.candidate(command, after, False, tmp_path)["config"]["markers"]
    assert collect_attachments(tmp_path, before["config"], after["config"], pinned=service.refs()) == 0
    service.release(session, [])
    service.collect(tmp_path, after["config"])
    assert file.read_bytes() == b"real attachment bytes"
    # A later explicit re-add owns the live reference even after the last pin.
    service.release(second, [])
    service.collect(tmp_path, before["config"])
    assert file.exists()
    service.collect(tmp_path, after["config"])
    assert not file.exists()


def test_changed_missing_file_expired_lease_and_new_bytes_fail_safe(tmp_path):
    now = [0.]
    service = MarkerHistory(lambda: now[0])
    before = _before()
    folder = tmp_path / "lamp"
    folder.mkdir()
    file = folder / "manual.pdf"
    file.write_bytes(b"old")
    before["config"]["markers"][0]["pdfs"] = [{"url": "/api/houseplan/content/files/lamp/manual.pdf"}]
    config, layout = delete_candidate(before["config"], before["layout"], [{"id": "lamp", "binding": "device:lamp"}])
    after = {"config": config, "layout": layout}
    command = service.prepare(before, after, {"lamp"}, tmp_path)
    session = service.session("one", ("writer", 1), True)
    session.commands["delete"] = command
    file.write_bytes(b"new unrelated upload")
    with pytest.raises(HistoryError):
        service.candidate(command, after, False, tmp_path)
    now[0] = 24 * 60 * 60
    with pytest.raises(HistoryError):
        service.session("one", ("writer", 1))
    service.collect(tmp_path, after["config"])
    assert file.read_bytes() == b"new unrelated upload"
