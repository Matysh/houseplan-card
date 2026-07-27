"""Plan-file collection — pure, so it is unit-testable without Home Assistant.

The file system is not part of the configuration store's transaction, so who
may delete a plan file, and when, is a correctness question rather than a
housekeeping one. It lives here, apart from the WebSocket plumbing, precisely
because it is the part that has to be reasoned about and tested.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

from .const import PLAN_ORPHAN_TTL_S
from .validation import PLAN_EXTENSIONS

_LOGGER = logging.getLogger(__name__)


def plan_basename(url: Any) -> str:
    """File name a stored plan_url points at ('' when there is none)."""
    if not isinstance(url, str) or not url:
        return ""
    return url.split("?", 1)[0].rsplit("/", 1)[-1]


def plan_refs(cfg: dict[str, Any] | None) -> set[str]:
    """Plan file names a configuration references."""
    out: set[str] = set()
    for sp in (cfg or {}).get("spaces") or []:
        name = plan_basename(sp.get("plan_url"))
        if name:
            out.add(name)
    return out


def is_plan_file(name: str) -> bool:
    """Does this look like a plan we wrote: <space>.<ext> or <space>.<token>.<ext>?"""
    parts = name.split(".")
    return len(parts) in (2, 3) and parts[-1].lower() in PLAN_EXTENSIONS


def collect_plans(
    plans_dir: Path,
    old_cfg: dict[str, Any] | None,
    new_cfg: dict[str, Any],
    now: float | None = None,
) -> int:
    """Drop plan files the accepted configuration made obsolete (review R3-1).

    Called inside the config write lock, right after the new revision is
    stored, so it decides from the two configurations that actually bracket the
    commit instead of trusting a client to say what may be deleted. The earlier
    design — a `plan/cleanup` command carrying `keep` — could not be ordered
    against another client's commit: a delayed call removed the file that
    client had just saved, leaving the accepted configuration pointing at
    nothing, which is the damage copy-on-write was introduced to prevent.

    Two rules, both conservative:
      * a file the OLD configuration referenced and the new one does not was
        authoritative and has been superseded — remove it;
      * any other unreferenced plan file is a rejected or abandoned upload, and
        is removed only once PLAN_ORPHAN_TTL_S has passed: a fresh one may
        belong to a transaction that has not committed yet.
    """
    if not plans_dir.is_dir():
        return 0
    new_refs = plan_refs(new_cfg)
    old_refs = plan_refs(old_cfg)
    cutoff = (time.time() if now is None else now) - PLAN_ORPHAN_TTL_S
    removed = 0
    for item in sorted(plans_dir.iterdir()):
        if not item.is_file() or item.name in new_refs or not is_plan_file(item.name):
            continue
        superseded = item.name in old_refs
        try:
            stale = item.stat().st_mtime < cutoff
        except OSError:
            stale = False
        if not superseded and not stale:
            continue
        try:
            item.unlink()
            removed += 1
        except OSError as err:
            _LOGGER.warning("House Plan: could not remove the old plan %s: %s", item, err)
    return removed
