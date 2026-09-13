"""Fail-closed TypeScript/Python parity harness for wall-junction limits (#548).

This module deliberately has no pytest or Home Assistant dependency.  The
dedicated Validate job compiles the real TypeScript module, loads the real pure
Python validator and compares both against one checked-in fixture.  Missing
runtime/build prerequisites are setup errors, never a skipped test.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
from pathlib import Path
from typing import Any

from pure_imports import HOUSEPLAN_ROOT, REPO, load_pure

DEFAULT_FIXTURE = REPO / "test" / "fixtures" / "junction-limits-parity.json"
DEFAULT_BUILD_DIR = REPO / "test-build" / "junction-parity"

_NODE_SCRIPT = r"""
const junction = await import(process.env.HP_JUNCTION_MODULE);
const geometry = await import(process.env.HP_GEOMETRY_MODULE);
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  const spaces = JSON.parse(raw);
  const out = {};
  for (const [name, space] of Object.entries(spaces)) {
    const segments = space.wall_segments;
    const violations = [
      ...junction.checkNodes(segments),
      ...junction.checkSegmentLengths(segments, space.cell_cm, geometry.GRID_STEP_N),
      ...junction.checkNodeDistances(segments, space.cell_cm, geometry.GRID_STEP_N),
    ];
    out[name] = [...new Set(violations.map((item) => item.rule))].sort();
  }
  process.stdout.write(JSON.stringify(out));
});
"""


def load_backend_validator():
    """Load the production Python mirror without importing Home Assistant."""
    return load_pure(
        "custom_components.houseplan.junction_limits",
        HOUSEPLAN_ROOT / "junction_limits.py",
    )


def _point(value: dict[str, Any], *, cell_cm: float, validator: Any) -> list[float]:
    if "cm" in value and set(value).issubset({"cm", "units_offset"}):
        point = value["cm"]
        offset = value.get("units_offset", [0, 0])
        return [validator.cm_to_units(float(point[0]), cell_cm) + float(offset[0]),
                validator.cm_to_units(float(point[1]), cell_cm) + float(offset[1])]
    if set(value) == {"units"}:
        point = value["units"]
        return [float(point[0]), float(point[1])]
    raise ValueError(f"point must contain cm (optionally units_offset) or exactly units, got: {value!r}")


def load_spaces(fixture_path: Path = DEFAULT_FIXTURE, *, validator: Any | None = None) -> dict[str, Any]:
    """Expand the human-sized shared fixture into the production space shape."""
    backend = validator or load_backend_validator()
    data = json.loads(fixture_path.read_text(encoding="utf-8"))
    if data.get("schema_version") != 1:
        raise ValueError(f"unsupported parity fixture schema: {data.get('schema_version')!r}")
    cell_cm = float(data["cell_cm"])
    spaces: dict[str, Any] = {}
    for case in data["cases"]:
        name = str(case["name"])
        if name in spaces:
            raise ValueError(f"duplicate parity case: {name}")
        segments = []
        for index, source in enumerate(case["segments"]):
            thickness = float(source["thickness_cm"])
            if "ray_degrees" in source:
                radians = math.radians(float(source["ray_degrees"]))
                length = backend.cm_to_units(float(source.get("length_cm", 100)), cell_cm)
                a = [0.0, 0.0]
                b = [math.cos(radians) * length, math.sin(radians) * length]
            else:
                a = _point(source["a"], cell_cm=cell_cm, validator=backend)
                b = _point(source["b"], cell_cm=cell_cm, validator=backend)
            segments.append({"id": f"w{index}", "a": a, "b": b, "cm": thickness})
        spaces[name] = {
            "id": name,
            "cell_cm": cell_cm,
            "rooms": [],
            "wall_segments": segments,
            "partitions": [],
            "room_drafts": [],
            "openings": [],
        }
    if not spaces:
        raise ValueError("parity fixture contains no cases")
    return spaces


def backend_rules(spaces: dict[str, Any], *, validator: Any) -> dict[str, list[str]]:
    return {
        name: sorted({violation[0] for violation in validator.space_violations(space)})
        for name, space in spaces.items()
    }


def frontend_rules(spaces: dict[str, Any], *, build_dir: Path) -> dict[str, list[str]]:
    junction_module = build_dir / "junction-limits.js"
    geometry_module = build_dir / "space-geometry.js"
    missing = [str(path) for path in (junction_module, geometry_module) if not path.is_file()]
    if missing:
        raise FileNotFoundError(
            "geometry parity prerequisites are missing: " + ", ".join(missing)
            + "; run `npx tsc -p tsconfig.junction-parity.json && node scripts/fix-test-build.mjs`"
        )
    env = os.environ.copy()
    env["HP_JUNCTION_MODULE"] = junction_module.resolve().as_uri()
    env["HP_GEOMETRY_MODULE"] = geometry_module.resolve().as_uri()
    try:
        result = subprocess.run(
            ["node", "--input-type=module", "--eval", _NODE_SCRIPT],
            cwd=REPO,
            input=json.dumps(spaces),
            capture_output=True,
            text=True,
            check=False,
            env=env,
        )
    except FileNotFoundError as error:
        raise RuntimeError("geometry parity requires Node.js, but `node` was not found") from error
    if result.returncode != 0:
        raise RuntimeError(
            f"TypeScript geometry parity runner failed with exit {result.returncode}:\n{result.stderr}"
        )
    return json.loads(result.stdout)


def run_parity(
    *,
    build_dir: Path = DEFAULT_BUILD_DIR,
    fixture_path: Path = DEFAULT_FIXTURE,
) -> int:
    """Compare all shared scenarios and return their count on success."""
    validator = load_backend_validator()
    spaces = load_spaces(fixture_path, validator=validator)
    python_result = backend_rules(spaces, validator=validator)
    typescript_result = frontend_rules(spaces, build_dir=build_dir)
    if typescript_result != python_result:
        differences = {
            name: {"typescript": typescript_result.get(name), "python": python_result.get(name)}
            for name in spaces
            if typescript_result.get(name) != python_result.get(name)
        }
        raise AssertionError(
            "TypeScript/Python geometry parity diverged:\n"
            + json.dumps(differences, indent=2, ensure_ascii=False)
        )
    return len(spaces)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build-dir", type=Path, default=DEFAULT_BUILD_DIR)
    parser.add_argument("--fixture", type=Path, default=DEFAULT_FIXTURE)
    args = parser.parse_args(argv)
    count = run_parity(build_dir=args.build_dir, fixture_path=args.fixture)
    print(f"geometry parity: {count} scenarios executed; TS/Python verdicts identical")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
