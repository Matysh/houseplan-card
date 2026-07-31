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
    rec.pairs = {"camera.map": ("m1", "vacuum.x50")}
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
