"""TrailRecorder wiring: subscription callback, dialects, run end.

Loads trails.py with STUBBED Home Assistant modules — but only inside a
snapshot of sys.modules that is restored immediately afterwards. Injecting
fake `homeassistant` modules globally poisons the real HA harness running in
the same pytest session (it did, once).
"""
import sys, types, pathlib, importlib.util

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


# ---------------- v1.54.0 audit regressions ----------------


def test_map_index_zero_matches_frontend_contract():
    # HP-1540-02: `map_index: 0` is a VALID first map. The old or-chain
    # dropped it and fell through to selected_map — the server stored the
    # run under a key the renderer never looked up.
    rec, _hass, states = _rec()
    states["camera.map"] = S("idle", {"vacuum_position": {"x": 10, "y": 20}, "map_index": 0})
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
        ({}, {}, "default"),
    ]
    for src_attrs, vac_attrs, want in cases:
        assert trails.resolve_map_id(src_attrs, vac_attrs) == want, (src_attrs, vac_attrs)


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
        asyncio.run(rec.async_refresh())
        assert rec.pairs == {"camera.map": [("m_f1", "vacuum.x50"), ("m_f2", "vacuum.x50")]}
        assert tracked == [["camera.map", "vacuum.x50"]]
    finally:
        trails.async_track_state_change_event = old_track


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

        asyncio.run(scenario())
    finally:
        trails.async_track_state_change_event = old_track
