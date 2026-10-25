"""Generate TWO synthetic records with unchanged pinned public producer ASTs.

Pass --source <pinned checkout>/custom_components/dreame_vacuum. No download,
cloud, vendor decoder or installed-device compatibility is claimed. Public
catalog labels are normalized and their synthetic token is redacted. Private
vendor collaborators below belong only to this offline upstream fixture.
"""
from __future__ import annotations

import argparse
import ast
import asyncio
import base64
import hashlib
import json
import runpy
import time
from datetime import datetime
from functools import partial
from pathlib import Path
from types import SimpleNamespace

import numpy as np

PIN = "f5b8472b8e2e4bb3dff7bc2a81a5fd594eca9585"


async def produce(source: Path) -> dict:
    expected = json.loads(Path(__file__).with_name("dreame-tasshack-2.0.2.json").read_text())["sourceSha256"]
    names = {"camera": "camera.py", "const": "const.py", "map": "dreame/map.py",
             "types": "dreame/types.py", "device": "dreame/device.py"}
    hashes = {path: hashlib.sha256((source / path).read_bytes()).hexdigest() for path in names.values()}
    for name, path in names.items():
        if hashes[path] != expected[f"999-upstream-{name}.py"]:
            raise ValueError(f"Source is not the pinned {PIN}: {path}")
    ns = runpy.run_path(str(source / names["types"]))
    ns.update(json=json, base64=base64, time=time, datetime=datetime, partial=partial)
    for path in (names["const"], names["camera"]):
        for node in ast.parse((source / path).read_text()).body:
            if not isinstance(node, (ast.Assign, ast.AnnAssign)):
                continue
            try:
                value = ast.literal_eval(node.value)
            except (ValueError, TypeError):
                continue
            for target in node.targets if isinstance(node, ast.Assign) else [node.target]:
                if isinstance(target, ast.Name):
                    ns[target.id] = value
    constant = next(node for node in ast.parse((source / names["const"]).read_text()).body
                    if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name)
                    and node.target.id == "STATUS_CODE_TO_NAME")
    ns["STATUS_CODE_TO_NAME"] = eval(compile(ast.Expression(constant.value), "pinned status constant", "eval"), ns)
    methods = []

    def method(path: str, cls: str, name: str):
        owner = next(node for node in ast.parse((source / path).read_text()).body
                     if isinstance(node, ast.ClassDef) and node.name == cls)
        value = next(node for node in owner.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name)
        methods.append(value)
        return value

    def load(cls: str, members: list):
        tree = ast.Module(body=[ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0),
                               ast.ClassDef(name=cls, bases=[], keywords=[], body=members, decorator_list=[])], type_ignores=[])
        exec(compile(ast.fix_missing_locations(tree), "unchanged pinned upstream methods", "exec"), ns)
        return ns[cls]

    load("DreameVacuumMapRenderer", [method(names["map"], "DreameVacuumMapRenderer", "get_data")])
    device_type = load("DreameVacuumDevice", [method(names["device"], "DreameVacuumDevice", "history_map")])
    camera_type = load("DreameVacuumCameraEntity", [method(names["camera"], "DreameVacuumCameraEntity", name)
                      for name in ("history_map_image", "extra_state_attributes", "_try_call")])
    maps, records, epochs = {}, [], [1792800000, 1792796400]
    for i, stamp in enumerate(epochs):
        value = ns["MapData"]()
        value.version = 2
        value.map_id, value.saved_map_id, value.map_index, value.frame_id = 77 + i, 36, 1, 4 + i
        value.history_map, value.saved_map, value.wifi_map, value.completed = True, False, False, i == 0
        value.dimensions = ns["MapImageDimensions"](0, 0, 2, 2, 50)
        value.pixel_type = np.zeros((2, 2), dtype=np.uint8)
        points = [(0, 0, "S"), (1000, 0, "L"), (1000, 1000, "L")] if i == 0 else [
            (2000, 0, "S"), (3000, 0, "L"), (3000, 1000, "L")]
        value.path = [ns["Path"](x, y, ns["PathType"](kind)) for x, y, kind in points]
        row = ns["CleaningHistory"]([], {})
        row.date, row.second_cleaning, row.status, row.completed = datetime.fromtimestamp(stamp), False, 0, i == 0
        row.object_name, row.key = f"synthetic-record-{i}", f"synthetic-key-{i}"
        records.append(row)
        maps[(row.object_name, row.key)] = value
    device = device_type()
    device.cloud_connected = False
    device.status = SimpleNamespace(_cleaning_history=records, _cruising_history=None, _history_map_data={})
    device.capability = SimpleNamespace(map=True)
    device._map_manager = SimpleNamespace(get_history_map=lambda name, key: maps[(name, key)])
    device.get_map_for_render = lambda value: value

    class Executor:
        async def async_add_executor_job(self, function, *args):
            return function(*args)

    camera = camera_type()
    camera.hass, camera.device = Executor(), device
    camera.map_index, camera.map_data_json, camera.wifi_map = 0, False, False
    camera._map_data, camera._color_scheme, camera._icon_set = None, "fixture", 0
    camera.access_tokens, camera.entity_id = ["synthetic"], "camera.synthetic_history"
    metadata = camera.extra_state_attributes["cleaning_history_picture"]
    metadata = {f"record-{i}": url for i, url in enumerate(metadata.values(), 1)}
    output = []
    for i, stamp in enumerate(epochs, 1):
        payload = json.loads(await camera.history_map_image(i, False, False, True, False, False, False))
        assert payload["history_map"] is True and payload["completed"] is (i == 1)
        assert payload["path"] == [[1, *( [0, 0, 1000, 0, 1000, 1000] if i == 1 else [2000, 0, 3000, 0, 3000, 1000])]]
        output.append({"index": i, "timestamp": stamp, "payload": payload})
    return {"pin": PIN, "sourceSha256": hashes,
            "methodAstSha256": {node.name: hashlib.sha256(ast.dump(node, include_attributes=False).encode()).hexdigest() for node in methods},
            "metadata": metadata, "records": output,
            "scope": "Original public metadata/selector/serializer; synthetic collaborators, normalized labels, synthetic token. No cloud/decoder/render preprocessing/installed-device proof."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("dreame-tasshack-2.0.2-two-records.json"))
    args = parser.parse_args()
    args.output.write_text(json.dumps(asyncio.run(produce(args.source)), indent=2) + "\n")
    print(json.dumps({"output": args.output.name, "sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(), "bytes": args.output.stat().st_size}))
