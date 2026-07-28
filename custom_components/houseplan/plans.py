"""Blob lifecycle — pure, so it is unit-testable without Home Assistant.

The file system is not part of the configuration store's transaction, so who
may write or delete a plan or an attachment, and when, is a correctness
question rather than housekeeping. It lives here, apart from the WebSocket and
HTTP plumbing, precisely because it is the part that has to be reasoned about
and tested.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

from .const import PLAN_ORPHAN_TTL_S
from .validation import PLAN_EXTENSIONS, sanitize_filename

_LOGGER = logging.getLogger(__name__)


def unique_filename(directory: Path, name: str) -> str:
    """A name inside `directory` that is not taken, deriving from `name`.

    Uploads never overwrite. The bytes already under a name may be referenced by
    the stored configuration, and an upload is not part of that transaction: a
    cancelled dialog or a rejected save would otherwise leave a live url serving
    someone else's file (HP-1454-02).
    """
    safe = sanitize_filename(name)
    if not (directory / safe).exists():
        return safe
    stem, dot, suffix = safe.rpartition(".")
    if not dot:
        stem, suffix = safe, ""
    i = 2
    while True:
        # "-2", not " (2)": the content view sanitizes the name in the REQUEST
        # too, and a space or a bracket there turns into "_", so a file called
        # "manual (2).pdf" was written and then never served. Only characters
        # that survive sanitize_filename may be used to build a name.
        candidate = f"{stem}-{i}{'.' + suffix if suffix else ''}"
        if not (directory / candidate).exists():
            return candidate
        i += 1


def attachment_refs(cfg: dict[str, Any] | None) -> set[str]:
    """"<marker>/<file>" for every attachment a configuration references."""
    out: set[str] = set()
    for m in (cfg or {}).get("markers") or []:
        for pdf in m.get("pdfs") or []:
            url = pdf.get("url") if isinstance(pdf, dict) else None
            if not isinstance(url, str) or "/files/" not in url:
                continue
            rel = url.split("?", 1)[0].split("/files/", 1)[1]
            if rel.count("/") == 1:
                out.add(rel)
    return out


def collect_attachments(
    files_dir: Path,
    old_cfg: dict[str, Any] | None,
    new_cfg: dict[str, Any],
    now: float | None = None,
) -> int:
    """The same commit-scoped rule as `collect_plans`, for marker attachments.

    A file the old revision referenced and the new one does not was superseded
    by this commit and goes. Anything else unreferenced is an upload that was
    never saved — a cancelled dialog, a rejected write — and waits out
    PLAN_ORPHAN_TTL_S first, because a fresh one may belong to a dialog the user
    still has open. Never raises: it runs behind a durable write.
    """
    new_refs = attachment_refs(new_cfg)
    old_refs = attachment_refs(old_cfg)
    cutoff = (time.time() if now is None else now) - PLAN_ORPHAN_TTL_S
    removed = 0
    try:
        folders = sorted(p for p in files_dir.iterdir() if p.is_dir()) if files_dir.is_dir() else []
    except OSError as err:
        _LOGGER.warning("House Plan: could not list %s: %s", files_dir, err)
        return 0
    for folder in folders:
        try:
            items = sorted(p for p in folder.iterdir() if p.is_file())
        except OSError:
            continue
        for item in items:
            rel = f"{folder.name}/{item.name}"
            if rel in new_refs:
                continue
            try:
                stale = item.stat().st_mtime < cutoff
            except OSError:
                stale = False
            if rel not in old_refs and not stale:
                continue
            try:
                item.unlink()
                removed += 1
            except OSError as err:
                _LOGGER.warning("House Plan: could not remove the attachment %s: %s", item, err)
        try:
            next(folder.iterdir())
        except StopIteration:
            try:
                folder.rmdir()
            except OSError:
                pass
        except OSError:
            pass
    return removed


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

    Never raises: the configuration is already stored by the time this runs, so
    a file-system problem must not turn a durable commit into a failed call.
    """
    new_refs = plan_refs(new_cfg)
    old_refs = plan_refs(old_cfg)
    cutoff = (time.time() if now is None else now) - PLAN_ORPHAN_TTL_S
    removed = 0
    try:
        items = sorted(plans_dir.iterdir()) if plans_dir.is_dir() else []
    except OSError as err:
        # The directory can vanish or turn unreadable between the check and the
        # walk. This is housekeeping running behind a commit that is already
        # durable, so it reports "nothing collected" instead of failing (R4-1).
        _LOGGER.warning("House Plan: could not list %s: %s", plans_dir, err)
        return 0
    for item in items:
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
