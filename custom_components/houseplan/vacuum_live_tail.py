"""Bounded provisional observations, never a second native history or job id."""
from __future__ import annotations

import math
import uuid
from typing import Any

LIVE_POINTS = 512
LIVE_FRAGMENTS = 32
JOIN_CM = 2.0


def finite(value: Any) -> bool:
    try:
        return type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        return False


def ensure_live(run: dict[str, Any]) -> dict[str, Any]:
    value = run.get("_live_tail")
    if project_live(value) is None:
        value = {"version": 1, "epoch": uuid.uuid4().hex, "paths": [],
                 "waiting": False, "limited": False, "gap": True}
        run["_live_tail"] = value
    for fragment in value["paths"]:
        for sample in fragment:
            if len(sample) != 5:
                sample[3:] = [None, None]
    return value


def append_live(run: dict[str, Any], x: float, y: float, stamp: float,
                physical: tuple[float, float] | None, gap: bool) -> bool:
    if not all(finite(v) for v in (x, y, stamp)):
        return False
    live = ensure_live(run)
    if finite(live.get("since")) and stamp < live["since"]:
        live["gap"] = True
        return False
    paths = live["paths"]
    gap |= bool(live.pop("gap", False))
    last = paths[-1][-1] if paths and paths[-1] else None
    if last and stamp < last[2]:
        # A source clock rollback cannot give a client's old cursor authority.
        live["epoch"] = uuid.uuid4().hex
        gap = True
    if last and [x, y] == last[:2] and not gap:
        if stamp <= last[2]:
            return False
        last[2] = stamp
        return True
    if not paths or gap and paths[-1]:
        paths.append([])
    paths[-1].append([x, y, stamp, *(physical or (None, None))])
    count = sum(len(p) for p in paths)
    while count > LIVE_POINTS or len(paths) > LIVE_FRAGMENTS:
        if len(paths[0]) == 1 or len(paths) > LIVE_FRAGMENTS:
            count -= len(paths.pop(0))
        else:
            paths[0].pop(0)
            count -= 1
        live["limited"] = True
    return True


def acknowledge_live(run: dict[str, Any], endpoint: list[float] | None,
                     endpoint_cm: tuple[float, float] | None,
                     read_started: float | None) -> None:
    """Only one witnessed old endpoint can consume an ordered prefix.

    The request-start watermark is ours, not provider revision/receive time.
    Newer samples and ambiguous revisits survive even a late complete read.
    """
    live = ensure_live(run)
    if endpoint is None or endpoint_cm is None or not finite(read_started):
        return
    candidates = []
    for i, fragment in enumerate(live["paths"]):
        for j, sample in enumerate(fragment):
            if sample[2] <= read_started and len(sample) == 5 and all(finite(v) for v in sample[3:5]) \
                    and math.hypot(sample[3] - endpoint_cm[0], sample[4] - endpoint_cm[1]) <= JOIN_CM:
                candidates.append((i, j))
    if len(candidates) != 1:
        return
    i, j = candidates[0]
    prefix = [*live["paths"][:i], live["paths"][i][:j + 1]]
    if any(sample[2] > read_started for fragment in prefix for sample in fragment):
        return  # A clock rollback must not erase a newer earlier fragment.
    suffix = [live["paths"][i][j:], *live["paths"][i + 1:]]
    # Anchor the retained suffix at the native endpoint, within the proven 2 cm.
    suffix[0][0] = [*endpoint, suffix[0][0][2], *endpoint_cm]
    live["paths"] = suffix


def project_live(value: Any) -> dict[str, Any] | None:
    """Closed projection: no physical calibration, activity proof or source id."""
    if not isinstance(value, dict) or type(value.get("version")) is not int or value["version"] != 1:
        return None
    epoch = value.get("epoch")
    raw = value.get("paths")
    if not isinstance(epoch, str) or not 1 <= len(epoch) <= 128 or not isinstance(raw, list) \
            or len(raw) > LIVE_FRAGMENTS:
        return None
    paths = []
    count = 0
    for fragment in raw:
        if not isinstance(fragment, list):
            return None
        path = []
        for sample in fragment:
            count += 1
            if count > LIVE_POINTS or not isinstance(sample, list) or not 3 <= len(sample) <= 5 \
                    or not all(finite(v) for v in sample[:3]):
                return None
            path.append(sample[:3])
        if path:
            paths.append(path)
    return {"version": 1, "epoch": epoch, "paths": paths,
            "waiting": value.get("waiting") is True, "limited": value.get("limited") is True,
            **({"since": value["since"]} if finite(value.get("since")) else {})}


def observe_task(record: dict[str, Any], owner: tuple[str, ...], state: str,
                 attrs: Any, now: float, *, verified: bool) -> tuple[bool, bool]:
    """Pinned public Dreame activity is a proof, never arbitrary entity attrs."""
    if not verified or not isinstance(attrs, dict) or not finite(now):
        return record.pop("_task_activity", None) is not None, False
    old = record.get("_task_activity")
    key = list(owner)
    proof = old if isinstance(old, dict) and old.get("owner") == key else {"owner": key, "armed": False}
    # Pause/wash must not arm a completed-task boundary, including falsey junk.
    terminal = state in ("docked", "idle") and attrs.get("started") is False \
        and all(attrs.get(k) is False for k in (
            "paused", "cleaning_paused", "washing", "washing_paused", "returning_to_wash",
            "returning_to_wash_paused"))
    consumed = bool(proof.get("armed") is True and attrs.get("started") is True
                    and state in ("cleaning", "returning", "on"))
    changed = proof is not old
    if terminal and not proof.get("armed"):
        proof["armed"] = True
        changed = True
    if consumed:
        proof["armed"] = False
        changed = True
    record["_task_activity"] = proof
    return changed, consumed
