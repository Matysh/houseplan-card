"""TrailRecorder wiring: subscription callback, dialects, run end.

Loads trails.py with STUBBED Home Assistant modules — but only inside a
snapshot of sys.modules that is restored immediately afterwards. Injecting
fake `homeassistant` modules globally poisons the real HA harness running in
the same pytest session (it did, once).
"""
import sys, types, pathlib, importlib.util, json

ROOT = pathlib.Path(__file__).resolve().parent.parent


def _load_trails():
    saved = {k: v for k, v in sys.modules.items() if k == "homeassistant" or k.startswith(("homeassistant.", "houseplan"))}
    try:
        for name in list(sys.modules):
            if name == "homeassistant" or name.startswith(("homeassistant.", "houseplan")):
                del sys.modules[name]
        ha = types.ModuleType("homeassistant"); sys.modules["homeassistant"] = ha
        core = types.ModuleType("homeassistant.core")
        core.HomeAssistant = object
        core.callback = lambda f: f
        sys.modules["homeassistant.core"] = core
        sys.modules["homeassistant.helpers"] = types.ModuleType("homeassistant.helpers")
        er = types.ModuleType("homeassistant.helpers.entity_registry")
        er.async_get = lambda hass: None
        er.async_entries_for_device = lambda reg, dev: []
        sys.modules["homeassistant.helpers.entity_registry"] = er
        ev = types.ModuleType("homeassistant.helpers.event")
        ev.async_call_later = lambda hass, delay, cb: (lambda: None)
        ev.async_track_state_change_event = lambda hass, ents, cb: (lambda: None)
        sys.modules["homeassistant.helpers.event"] = ev
        stm = types.ModuleType("homeassistant.helpers.storage")

        class _Store:
            def __init__(self, *a, **k): pass
            async def async_load(self): return None
            async def async_save(self, d): pass

        stm.Store = _Store
        sys.modules["homeassistant.helpers.storage"] = stm
        pkg = types.ModuleType("houseplan"); pkg.__path__ = [str(ROOT / "custom_components" / "houseplan")]
        sys.modules["houseplan"] = pkg
        c = types.ModuleType("houseplan.const"); c.DOMAIN = "houseplan"
        sys.modules["houseplan.const"] = c
        spec = importlib.util.spec_from_file_location(
            "houseplan.trails", str(ROOT / "custom_components" / "houseplan" / "trails.py")
        )
        mod = importlib.util.module_from_spec(spec)
        sys.modules["houseplan.trails"] = mod
        spec.loader.exec_module(mod)
        return mod
    finally:
        for name in list(sys.modules):
            if name == "homeassistant" or name.startswith(("homeassistant.", "houseplan")):
                del sys.modules[name]
        sys.modules.update(saved)


trails = _load_trails()


class S:
    def __init__(self, state, attrs): self.state, self.attributes = state, attrs


class States:
    def __init__(self, d): self.d = d
    def get(self, k): return self.d.get(k)


class Bus:
    def __init__(self): self.fired = []
    def async_fire(self, *a): self.fired.append(a)


class Hass:
    def __init__(self, states): self.states, self.bus, self.data = States(states), Bus(), {}


def _rec():
    states = {
        "vacuum.x50": S("cleaning", {"selected_map": "Первый этаж"}),
        "camera.map": S("idle", {"vacuum_position": {"x": 1000, "y": -500, "a": 90}, "map_index": 1}),
    }
    hass = Hass(states)
    rec = trails.TrailRecorder(hass, None)
    rec.pairs = {"camera.map": [("m1", "vacuum.x50")]}
    return rec, hass, states


class E:
    def __init__(self, eid): self.data = {"entity_id": eid}


def test_state_events_record_points_and_map_id():
    rec, hass, states = _rec()
    rec._on_state(E("camera.map"))
    states["camera.map"] = S("idle", {"vacuum_position": {"x": 1100, "y": -500}, "map_index": 1})
    rec._on_state(E("camera.map"))
    run = rec.book.data["m1"]["current"]
    assert run["points"] == [[1000.0, -500.0], [1100.0, -500.0]]
    assert run["map_id"] == "1"
    assert hass.bus.fired, "live cards must be notified"


def test_docking_ends_the_run():
    rec, hass, states = _rec()
    rec._on_state(E("camera.map"))
    states["vacuum.x50"] = S("docked", {})
    rec._on_state(E("vacuum.x50"))
    assert rec.book.data["m1"]["current"]["ended"] is not None


def test_sample_seeds_a_run_already_in_progress():
    # HA restarted mid-cleanup: the first point must not wait for an event
    rec, _hass, _states = _rec()
    assert rec._sample("camera.map", 123.0)
    assert rec.book.data["m1"]["current"]["points"] == [[1000.0, -500.0]]


def test_junk_position_ignored():
    rec, _hass, states = _rec()
    states["camera.map"] = S("idle", {"vacuum_position": {"x": "nope", "y": 1}})
    assert not rec._sample("camera.map", 1.0)
    states["camera.map"] = S("idle", {})
    assert not rec._sample("camera.map", 1.0)


def test_unknown_source_is_noop():
    rec, _hass, _states = _rec()
    assert not rec._sample("camera.other", 1.0)


def test_trail_book_delete_forgets_current_and_previous_runs():
    book = trails.TrailBook({
        "m1": {"current": {"points": [[1, 2]]}, "previous": {"points": [[3, 4]]}},
        "m2": {"current": {"points": [[5, 6]]}},
    })
    assert book.delete("m1") is True
    assert "m1" not in book.data
    assert "m2" in book.data
    assert book.delete("m1") is False


def test_missing_trail_delete_does_not_mutate_live_tracking_pairs():
    rec, _hass, _states = _rec()
    before = {src: list(pairs) for src, pairs in rec.pairs.items()}
    unsubscribed = []
    rec._unsub_track = lambda: unsubscribed.append(True)
    assert _run_isolated(rec.async_delete("m1")) is False
    assert rec.pairs == before
    assert unsubscribed == []


def test_trail_delete_prunes_pair_and_replaces_subscription():
    tracked = []
    old_track = trails.async_track_state_change_event
    trails.async_track_state_change_event = lambda hass, ents, cb: (
        tracked.append(list(ents)) or (lambda: None)
    )
    try:
        rec, _hass, _states = _rec()
        rec.pairs["other.source"] = [("m2", "vacuum.other")]
        rec.book.data["m1"] = {"current": {"points": [[1, 2]]}}
        unsubscribed = []
        rec._unsub_track = lambda: unsubscribed.append(True)
        assert _run_isolated(rec.async_delete("m1")) is True
        assert rec.pairs == {"other.source": [("m2", "vacuum.other")]}
        assert unsubscribed == [True]
        assert tracked == [["other.source", "vacuum.other"]]
    finally:
        trails.async_track_state_change_event = old_track


def test_object_style_position_is_read():
    # Tasshack in-memory attributes hold a Point OBJECT, not a dict
    class Point:
        def __init__(self, x, y): self.x, self.y = x, y
    rec, _hass, states = _rec()
    states["camera.map"] = S("idle", {"vacuum_position": Point(2020, 3096), "map_index": 1})
    assert rec._sample("camera.map", 5.0)
    assert rec.book.data["m1"]["current"]["points"] == [[2020.0, 3096.0]]


def test_unavailable_vacuum_is_no_verdict():
    # HA boot: the vacuum reads unavailable — the open run must NOT be ended
    rec, _hass, states = _rec()
    rec._sample("camera.map", 1.0)
    states["vacuum.x50"] = S("unavailable", {})
    assert not rec._sample("camera.map", 2.0)
    assert rec.book.data["m1"]["current"]["ended"] is None
    del states["vacuum.x50"]
    assert not rec._sample("camera.map", 3.0)
    assert rec.book.data["m1"]["current"]["ended"] is None


def test_short_available_stops_resume_one_run_and_neutral_states_do_not_shift_window():
    rec, _hass, states = _rec()
    assert rec._sample("camera.map", 100.0)
    states["vacuum.x50"] = S("docked", {})
    assert rec._sample("camera.map", 200.0)
    ended = rec.book.data["m1"]["current"]["ended"]
    assert ended == 200.0
    assert not rec._sample("camera.map", 300.0)  # repeated stop is idempotent
    assert rec.book.data["m1"]["current"]["ended"] == ended
    states["vacuum.x50"] = S("unknown", {})
    assert not rec._sample("camera.map", 400.0)
    del states["vacuum.x50"]
    assert not rec._sample("camera.map", 500.0)
    assert rec.book.data["m1"]["current"]["ended"] == ended

    states["vacuum.x50"] = S("cleaning", {"selected_map": "Первый этаж"})
    states["camera.map"] = S(
        "idle", {"vacuum_position": {"x": 1100, "y": -450}, "map_index": 1}
    )
    assert rec._sample("camera.map", 800.0)
    run = rec.book.data["m1"]["current"]
    assert run["ended"] is None
    assert run["points"] == [[1000.0, -500.0], [1100.0, -450.0]]
    assert "previous" not in rec.book.data["m1"]


def test_any_available_nonmoving_state_uses_the_same_grace_contract():
    for stopped in ("paused", "idle", "error", "washing", "docked"):
        rec, _hass, states = _rec()
        assert rec._sample("camera.map", 1.0)
        states["vacuum.x50"] = S(stopped, {})
        assert rec._sample("camera.map", 2.0), stopped
        states["vacuum.x50"] = S("cleaning", {})
        states["camera.map"] = S(
            "idle", {"vacuum_position": {"x": 1200, "y": -400}, "map_index": 1}
        )
        assert rec._sample("camera.map", 3.0), stopped
        assert rec.book.data["m1"]["current"]["points"] == [
            [1000.0, -500.0], [1200.0, -400.0],
        ]
        assert "previous" not in rec.book.data["m1"]


# ---------------- v1.54.0 audit regressions ----------------

def _run_isolated(coro):
    """Run a coroutine on a private loop WITHOUT touching the ambient one.

    asyncio.run() clears the thread's current-loop slot when it finishes; in
    the CI HA harness (pytest-asyncio keeps a session event loop) that
    poisoned the setup of every test that followed — 'There is no current
    event loop in thread MainThread' across whole files.
    """
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()




def test_map_index_zero_matches_frontend_contract():
    # HP-1540-02: `map_index: 0` is a VALID first map. The old or-chain
    # dropped it and fell through to selected_map — the server stored the
    # run under a key the renderer never looked up.
    rec, _hass, states = _rec()
    states["camera.map"] = S("idle", {"vacuum_position": {"x": 10, "y": 20}, "map_index": 0})
    assert rec._sample("camera.map", 1.0)
    assert rec.book.data["m1"]["current"]["map_id"] == "0"


def test_vacuum_selected_map_zero_fallback_recorded_as_zero():
    # HP-1541-01: source names no map, vacuum reports selected_map: 0 — the
    # recorder must store the run under "0", the same id the fixed card-side
    # fallback (vacMapIdWithFallback) resolves. Before the fix the card asked
    # for calibration/trails under "default" and never found this run.
    rec, _hass, states = _rec()
    states["camera.map"] = S("idle", {"vacuum_position": {"x": 10, "y": 20}})
    states["vacuum.x50"] = S("cleaning", {"selected_map": 0})
    assert rec._sample("camera.map", 1.0)
    assert rec.book.data["m1"]["current"]["map_id"] == "0"


def test_map_id_contract_first_not_none_wins():
    # HP-1540-02: the shared contract — first NOT-None value, stringified
    cases = [
        ({"map_index": 0}, {"selected_map": "Floor"}, "0"),
        ({"map_index": "0"}, {}, "0"),
        ({"map_name": ""}, {"selected_map": "Floor"}, ""),
        ({"map_name": "A", "map_index": 0}, {}, "A"),
        ({"current_map": 2}, {}, "2"),
        ({"selected_map": "Src"}, {"selected_map": "Vac"}, "Src"),
        ({}, {"selected_map": "Vac"}, "Vac"),
        # HP-1541-01: the vacuum-entity fallback with a zero-ish id — must
        # match the card's vacMapIdWithFallback (test/vacuum.test.mjs)
        ({}, {"selected_map": 0}, "0"),
        ({}, {"selected_map": "0"}, "0"),
        ({}, {"selected_map": ""}, ""),
        ({}, {}, "default"),
    ]
    for src_attrs, vac_attrs, want in cases:
        assert trails.resolve_map_id(src_attrs, vac_attrs) == want, (src_attrs, vac_attrs)


def test_map_id_shared_fixture_ignores_vacuum_json_nonce():
    fixture = json.loads((ROOT / "test" / "fixtures" / "vacuum-attrs" / "map-id.json").read_text(
        encoding="utf-8"
    ))
    for row in fixture:
        assert trails.resolve_map_id(row["source"], row["vacuum"]) == row["expected"]
    assert fixture[-2]["expected"] == fixture[-1]["expected"]
    book = trails.TrailBook()
    for index, row in enumerate(fixture[-2:]):
        map_id = trails.resolve_map_id(row["source"], row["vacuum"])
        book.on_point("m1", map_id, float(index), 0.0, float(index))
    assert book.data["m1"]["current"]["points"] == [[0.0, 0.0], [1.0, 0.0]]
    assert "previous" not in book.data["m1"]


def test_one_source_two_floor_markers_both_record():
    # HP-1540-03: the multi-floor case — the same robot placed on two floors.
    # Both markers must receive the server-side run, on every map.
    states = {
        "vacuum.x50": S("cleaning", {}),
        "camera.map": S("idle", {"vacuum_position": {"x": 100, "y": 200}, "map_index": 0}),
    }
    hass = Hass(states)
    rec = trails.TrailRecorder(hass, None)
    rec.pairs = {"camera.map": [("m_floor1", "vacuum.x50"), ("m_floor2", "vacuum.x50")]}
    rec._on_state(E("camera.map"))
    # the robot moves to the second map: BOTH books rotate to the new run
    states["camera.map"] = S("idle", {"vacuum_position": {"x": 300, "y": 400}, "map_index": 1})
    rec._on_state(E("camera.map"))
    for marker in ("m_floor1", "m_floor2"):
        book = rec.book.data[marker]
        assert book["previous"]["map_id"] == "0", marker
        assert book["previous"]["points"] == [[100.0, 200.0]], marker
        assert book["current"]["map_id"] == "1", marker
        assert book["current"]["points"] == [[300.0, 400.0]], marker


def test_refresh_builds_pair_lists_and_dedups_subscription():
    # HP-1540-03: two markers over one source/vacuum → one entity set, both pairs
    import asyncio

    tracked = []

    def track(hass, ents, cb):
        tracked.append(list(ents))
        return lambda: None

    old_track = trails.async_track_state_change_event
    trails.async_track_state_change_event = track
    try:
        cfgm = [
            {"id": "m_f1", "binding": "entity:vacuum.x50", "vacuum": {"source": "camera.map"}},
            {"id": "m_f2", "binding": "entity:vacuum.x50", "vacuum": {"source": "camera.map"}},
        ]

        class CS:
            async def async_load(self):
                return {"config": {"markers": cfgm}}

        class RT:
            config_store = CS()

        hass = Hass({
            "vacuum.x50": S("docked", {}),
            "camera.map": S("idle", {}),
        })
        rec = trails.TrailRecorder(hass, RT())
        _run_isolated(rec.async_refresh())
        assert rec.pairs == {"camera.map": [("m_f1", "vacuum.x50"), ("m_f2", "vacuum.x50")]}
        assert tracked == [["camera.map", "vacuum.x50"]]
    finally:
        trails.async_track_state_change_event = old_track


def test_source_health_deduplicates_reason_changes_and_warns_after_recovery(caplog):
    rec, hass, states = _rec()
    key = {("m1", "camera.map")}

    class Entry:
        def __init__(self, disabled_by=None): self.disabled_by = disabled_by

    class Registry:
        row = None
        def async_get(self, _eid): return self.row

    registry = Registry()
    old_get = trails.er.async_get
    trails.er.async_get = lambda _hass: registry
    try:
        caplog.set_level("WARNING", logger=trails.__name__)
        rec._refresh_source_health(key)  # available baseline
        del states["camera.map"]
        rec._refresh_source_health(key)  # missing: warning 1
        registry.row = Entry("user")
        rec._refresh_source_health(key)  # disabled: reason update, no warning
        registry.row = None
        rec._refresh_source_health(key)  # missing again, no warning
        states["camera.map"] = S("unavailable", {})
        rec._refresh_source_health(key)  # proven existence: recovery
        del states["camera.map"]
        rec._refresh_source_health(key)  # missing after recovery: warning 2
        warnings = [record for record in caplog.records if record.levelname == "WARNING"]
        assert len(warnings) == 2
        assert rec._source_health[("m1", "camera.map")] == "missing"
    finally:
        trails.er.async_get = old_get


def test_source_health_lifecycle_clears_removed_or_rebound_marker(caplog):
    rec, _hass, states = _rec()
    del states["camera.map"]
    caplog.set_level("WARNING", logger=trails.__name__)
    old_get = trails.er.async_get
    trails.er.async_get = lambda _hass: type("Registry", (), {"async_get": lambda self, eid: None})()
    try:
        rec._refresh_source_health({("m1", "camera.map")})
        assert rec._source_health
        rec._refresh_source_health(set())
        assert rec._source_health == {}
    finally:
        trails.er.async_get = old_get


def test_source_health_unavailable_and_unsupported_are_proven_recovery(caplog):
    rec, _hass, states = _rec()
    key = {("m1", "camera.map")}
    caplog.set_level("WARNING", logger=trails.__name__)
    old_get = trails.er.async_get
    trails.er.async_get = lambda _hass: type("Registry", (), {"async_get": lambda self, eid: None})()
    try:
        del states["camera.map"]
        rec._refresh_source_health(key)
        assert len([r for r in caplog.records if r.levelname == "WARNING"]) == 1
        states["camera.map"] = S("unavailable", {})
        rec._refresh_source_health(key)
        assert rec._source_health == {}
        del states["camera.map"]
        rec._refresh_source_health(key)
        states["camera.map"] = S("idle", {})  # exists, but no supported attrs
        rec._refresh_source_health(key)
        assert rec._source_health == {}
        assert len([r for r in caplog.records if r.levelname == "WARNING"]) == 2
    finally:
        trails.er.async_get = old_get


def test_source_health_startup_and_source_change_lifecycle(caplog):
    rec, _hass, states = _rec()
    caplog.set_level("WARNING", logger=trails.__name__)
    old_get = trails.er.async_get
    trails.er.async_get = lambda _hass: type("Registry", (), {"async_get": lambda self, eid: None})()
    try:
        del states["camera.map"]
        rec._refresh_source_health({("m1", "camera.map")})
        rec._refresh_source_health({("m1", "camera.other")})
        assert ("m1", "camera.map") not in rec._source_health
        assert rec._source_health[("m1", "camera.other")] == "missing"
        assert len([r for r in caplog.records if r.levelname == "WARNING"]) == 2
    finally:
        trails.er.async_get = old_get


def test_source_health_startup_existing_states_do_not_warn(caplog):
    rec, _hass, states = _rec()
    caplog.set_level("WARNING", logger=trails.__name__)
    states["camera.map"] = S("unavailable", {})
    rec._refresh_source_health({("m1", "camera.map")})
    states["camera.map"] = S("idle", {})
    rec._refresh_source_health({("m1", "camera.map")})
    assert not [r for r in caplog.records if r.levelname == "WARNING"]


def test_source_health_disabled_unsupported_disabled_warns_twice(caplog):
    rec, _hass, states = _rec()
    key = {("m1", "camera.map")}

    class Entry:
        def __init__(self, disabled_by=None): self.disabled_by = disabled_by

    class Registry:
        row = Entry()
        def async_get(self, _eid): return self.row

    registry = Registry()
    old_get = trails.er.async_get
    trails.er.async_get = lambda _hass: registry
    try:
        caplog.set_level("WARNING", logger=trails.__name__)
        states["camera.map"] = S("idle", {})  # unsupported, but existing
        rec._refresh_source_health(key)
        registry.row = Entry("user")
        rec._refresh_source_health(key)
        registry.row = Entry()
        rec._refresh_source_health(key)  # proven unsupported recovery
        registry.row = Entry("user")
        rec._refresh_source_health(key)
        assert len([r for r in caplog.records if r.levelname == "WARNING"]) == 2
        assert rec._source_health[("m1", "camera.map")] == "disabled"
    finally:
        trails.er.async_get = old_get


def test_source_health_unverified_is_neutral(caplog):
    rec, _hass, states = _rec()
    key = {("m1", "camera.map")}

    class Registry:
        def async_get(self, _eid): return None

    registry = Registry()
    old_get = trails.er.async_get
    try:
        caplog.set_level("WARNING", logger=trails.__name__)
        del states["camera.map"]
        trails.er.async_get = lambda _hass: registry
        rec._refresh_source_health(key)  # missing: warning 1
        trails.er.async_get = lambda _hass: None
        rec._refresh_source_health(key)  # unverified: neutral
        trails.er.async_get = lambda _hass: registry
        rec._refresh_source_health(key)  # same incident, no warning
        assert len([r for r in caplog.records if r.levelname == "WARNING"]) == 1
        assert rec._source_health[("m1", "camera.map")] == "missing"
    finally:
        trails.er.async_get = old_get


def test_refresh_never_tracks_a_removed_marker_even_with_stale_vacuum_fields():
    class CS:
        async def async_load(self):
            return {"config": {"markers": [{
                "id": "m1",
                "binding": "entity:vacuum.x50",
                "removed": True,
                "vacuum": {"source": "camera.map"},
            }]}}

    class RT:
        config_store = CS()

    hass = Hass({
        "vacuum.x50": S("cleaning", {}),
        "camera.map": S("idle", {"vacuum_position": {"x": 1, "y": 2}}),
    })
    rec = trails.TrailRecorder(hass, RT())
    _run_isolated(rec.async_refresh())
    assert rec.pairs == {}
    assert rec.book.data == {}


def test_overlapping_refreshes_leave_one_subscription_teardown_zero():
    # HP-1540-05: two config/set refreshes racing across the awaited load used
    # to BOTH subscribe; teardown removed only the last handle and the other
    # callback leaked until HA restart.
    import asyncio

    active = []
    seq = {"n": 0}

    def track(hass, ents, cb):
        seq["n"] += 1
        hid = seq["n"]
        active.append(hid)
        return lambda: active.remove(hid)

    old_track = trails.async_track_state_change_event
    trails.async_track_state_change_event = track
    try:
        gate = asyncio.Event()

        class CS:
            async def async_load(self):
                await gate.wait()
                return {"config": {"markers": [
                    {"id": "m1", "binding": "entity:vacuum.x50", "vacuum": {"source": "camera.map"}},
                ]}}

        class RT:
            config_store = CS()

        hass = Hass({
            "vacuum.x50": S("docked", {}),
            "camera.map": S("idle", {}),
        })

        async def scenario():
            rec = trails.TrailRecorder(hass, RT())
            t1 = asyncio.ensure_future(rec.async_refresh())
            t2 = asyncio.ensure_future(rec.async_refresh())
            for _ in range(3):  # both tasks are launched; one parks on the gate
                await asyncio.sleep(0)
            gate.set()
            await t1
            await t2
            assert len(active) == 1, f"exactly one live subscription, got {active}"
            # teardown during an in-flight refresh must also end with zero
            gate.clear()
            t3 = asyncio.ensure_future(rec.async_refresh())
            for _ in range(3):
                await asyncio.sleep(0)
            rec.teardown()
            gate.set()
            await t3
            assert active == [], f"teardown must leave zero subscriptions, got {active}"

        _run_isolated(scenario())
    finally:
        trails.async_track_state_change_event = old_track
