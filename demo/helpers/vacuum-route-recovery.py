"""#918: real recorder/public transport material for the browser smoke.

Only Home Assistant's storage/event shell is synthetic. The recorder and its
public serializer are imported from production; no product function is replaced.
The browser harness has no dependency on the pytest suite. Running prints JSON.
"""
import copy
import json
import pathlib
import sys
import time
import types


def _load_recorder():
    """Load real integration modules with a scoped HA shell, restoring imports."""
    repo = pathlib.Path(__file__).resolve().parents[2]

    def scoped(name):
        return name in ("homeassistant", "custom_components") or name.startswith(
            ("homeassistant.", "custom_components."))

    saved = {name: module for name, module in sys.modules.items() if scoped(name)}
    try:
        for name in list(sys.modules):
            if scoped(name):
                del sys.modules[name]
        sys.modules["homeassistant"] = types.ModuleType("homeassistant")
        core = types.ModuleType("homeassistant.core")
        core.HomeAssistant = object
        core.callback = lambda callback: callback
        sys.modules["homeassistant.core"] = core
        sys.modules["homeassistant.helpers"] = types.ModuleType("homeassistant.helpers")
        registry = types.ModuleType("homeassistant.helpers.entity_registry")
        registry.async_get = lambda hass: None
        registry.async_entries_for_device = lambda registry, device: []
        sys.modules["homeassistant.helpers.entity_registry"] = registry
        event = types.ModuleType("homeassistant.helpers.event")
        event.async_call_later = lambda hass, delay, callback: (lambda: None)
        event.async_track_state_change_event = lambda hass, entities, callback: (lambda: None)
        sys.modules["homeassistant.helpers.event"] = event
        storage = types.ModuleType("homeassistant.helpers.storage")

        class Store:
            def __init__(self, *args, **kwargs):
                pass

            async def async_load(self):
                return None

            async def async_save(self, data):
                pass

        storage.Store = Store
        sys.modules["homeassistant.helpers.storage"] = storage
        package = types.ModuleType("custom_components")
        package.__path__ = [str(repo / "custom_components")]
        houseplan = types.ModuleType("custom_components.houseplan")
        houseplan.__path__ = [str(pathlib.Path(package.__path__[0]) / "houseplan")]
        package.houseplan = houseplan
        sys.modules["custom_components"] = package
        sys.modules["custom_components.houseplan"] = houseplan
        # Ordinary module imports keep the smoke's transitive product inputs
        # visible to check-inputs; the package shells avoid HA setup/__init__.
        import custom_components.houseplan.trails as trails
        import custom_components.houseplan.vacuum_paths as paths

        return trails, paths
    finally:
        for name in list(sys.modules):
            if scoped(name):
                del sys.modules[name]
        sys.modules.update(saved)


class S:
    def __init__(self, state, attributes):
        self.state, self.attributes = state, attributes


class States:
    def __init__(self, values):
        self.values = values

    def get(self, entity):
        return self.values.get(entity)


class Bus:
    def __init__(self):
        self.fired = []

    def async_fire(self, *args):
        self.fired.append(args)


class Hass:
    def __init__(self, states):
        self.states, self.bus, self.data = States(states), Bus(), {}


class E:
    def __init__(self, entity):
        self.data = {"entity_id": entity}


trails, paths = _load_recorder()
MARKER = "e_vacuum_route918"
ROOT = "camera.root918"
SOURCE = "camera.route918"
VACUUM = "vacuum.route918"


def fixture():
    route = {"id": "r918", "source": SOURCE, "map_id": "Map 1",
             "space": "f1", "calibration": [1, 0, 0, 0, 1, 0]}
    marker = {"id": MARKER, "binding": "entity:" + VACUUM, "space": "f1",
              "vacuum": {"source": ROOT, "trail_mode": "cleaning",
                         "map_routes": [route],
                         "calibration": {"1": [2, 0, 0, 0, 2, 0]}}}
    states = {
        VACUUM: S("cleaning", {}),
        ROOT: S("idle", {"robot_position": {"x": 900, "y": 900}, "map_name": "1"}),
        SOURCE: S("idle", {"robot_position": {"x": 100, "y": 100}, "map_name": "Map 1"}),
    }
    hass = Hass(states)

    def recorder(book=None):
        rec = trails.TrailRecorder(hass, None)
        rec.pairs = {ROOT: [(MARKER, VACUUM)], SOURCE: [(MARKER, VACUUM)]}
        rec.routes_by_marker = {MARKER: [route]}
        rec.explicit_route_markers = {MARKER}
        rec._spaces = {"f1": {"id": "f1", "cell_cm": 5}}
        if book is not None:
            rec.book = trails.TrailBook(copy.deepcopy(book))
        return rec

    rec = recorder()
    for index in range(12):
        rec.book.on_point(MARKER, "1", 700 + index * 10, 800, float(index + 1))

    def public():
        return {"trail_format": 2, "trails": paths.public_trails(rec.book.data)}

    before = public()
    start = time.time() - 30
    for index, (x, y) in enumerate([[100, 100], [300, 100], [300, 400]]):
        states[SOURCE] = S("idle", {"robot_position": {"x": x, "y": y}, "map_name": "Map 1"})
        rec._sample(SOURCE, start + index * 10)
    before_root = copy.deepcopy(rec.book.data)
    rec._on_state(E(ROOT))
    after = public()
    unchanged_by_root = rec.book.data == before_root
    # A restart is an ordinary book reload; real HA Store/restart has its own
    # test suite and is not claimed by this browser fixture.
    rec = recorder(rec.book.data)
    reloaded = public()
    current = rec.book.data.get(MARKER, {}).get("current", {})
    states[SOURCE] = S("idle", {"robot_position": {"x": 320, "y": 420}, "map_name": "Map 1"})
    return {
        "marker": marker,
        "states": {key: {"entity_id": key, "state": value.state, "attributes": value.attributes}
                   for key, value in states.items()},
        "before": before, "after": after, "reloaded": reloaded,
        "evidence": {"identified": current.get("route_id") == "r918",
                     "exactSource": current.get("source") == SOURCE,
                     "unrelatedRootUnchanged": unchanged_by_root},
    }


if __name__ == "__main__":
    print(json.dumps(fixture(), ensure_ascii=True))
