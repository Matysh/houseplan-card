"""Blob lifecycle — pure, so it is unit-testable without Home Assistant.

The file system is not part of the configuration store's transaction, so who
may write or delete a plan or an attachment, and when, is a correctness
question rather than housekeeping. It lives here, apart from the WebSocket and
HTTP plumbing, precisely because it is the part that has to be reasoned about
and tested.
"""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Any

from .const import MIN_FREE_BYTES, PLAN_ORPHAN_TTL_S
from .validation import MAX_FILENAME, PLAN_EXTENSIONS, sanitize_filename

_LOGGER = logging.getLogger(__name__)

# Streaming uploads land here first. The prefix is a dot so the name can never
# collide with an attachment (sanitize_filename strips leading dots) and is easy
# to sweep.
TMP_PREFIX = ".upload-"


def reserve_filename(directory: Path, name: str) -> str:
    """Atomically claim a free name inside `directory` and return it.

    Creates the file, empty, with `O_CREAT | O_EXCL`, so the name is *taken* the
    moment it is chosen. The previous version asked `exists()` and returned a
    string; two uploads racing between the check and the write agreed on the
    same name and one silently overwrote the other, both reporting success
    (HP-1460-01). The caller writes the real bytes over the placeholder — it
    owns the name by then — and must remove it if it never gets that far.

    The result is guaranteed to satisfy `sanitize_filename(result) == result`:
    the content view sanitises the name in the request too, so a name it would
    shorten or rewrite is a file that is written and then never served.
    """
    directory.mkdir(parents=True, exist_ok=True)
    # Split the extension off the RAW name: sanitize_filename() truncates to
    # MAX_FILENAME, so sanitising first would cut ".pdf" off a long name and the
    # attachment would be stored — and served — without its type.
    base = name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    stem, dot, suffix = base.rpartition(".")
    if not dot:
        stem, suffix = base, ""
    stem = sanitize_filename(stem)
    ext = f".{sanitize_filename(suffix)[:16]}" if suffix else ""
    i = 1
    while True:
        tag = "" if i == 1 else f"-{i}"
        # budget the stem so the WHOLE name fits, including the collision tag —
        # appending "-2" to an already maximal name produced a url the view
        # truncated back to something else, i.e. a permanent 404
        room = MAX_FILENAME - len(ext) - len(tag)
        candidate = (stem[:room] if room > 0 else "f") + tag + ext
        candidate = sanitize_filename(candidate)
        if candidate.startswith("."):  # a name that is only an extension
            candidate = "file" + candidate
        try:
            fd = os.open(directory / candidate, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
        except FileExistsError:
            i += 1
            if i > 10000:  # pathological directory; do not spin forever
                raise
            continue
        os.close(fd)
        return candidate


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


def sweep_upload_temps(files_dir: Path, now: float | None = None) -> int:
    """Remove abandoned streaming temporaries (HP-1460-02).

    The request itself deletes its own, but a hard kill — a restart mid-upload,
    an OOM — leaves one behind, and the attachment collector only walks marker
    folders, so it would never be seen. Age-gated for the same reason as the
    rest: a fresh one belongs to a request still in flight.
    """
    cutoff = (time.time() if now is None else now) - PLAN_ORPHAN_TTL_S
    removed = 0
    try:
        items = [p for p in files_dir.iterdir() if p.is_file()] if files_dir.is_dir() else []
    except OSError as err:
        _LOGGER.warning("House Plan: could not list %s: %s", files_dir, err)
        return 0
    for item in items:
        if not item.name.startswith(TMP_PREFIX):
            continue
        try:
            if item.stat().st_mtime >= cutoff:
                continue
            item.unlink()
            removed += 1
        except OSError:
            continue
    return removed


def collect_attachments(
    files_dir: Path,
    old_cfg: dict[str, Any] | None,
    new_cfg: dict[str, Any],
    now: float | None = None,
) -> int:
    """The same commit-scoped rule as `collect_plans`, for marker attachments.

    A file the old revision referenced and the new one does not, whose marker
    still exists, was removed on purpose — the dialog has a trash button and
    promises nothing. It goes. Everything else is kept, except a staging folder
    (`up_*`), which by construction only ever holds an upload from a dialog that
    was never saved: those go after PLAN_ORPHAN_TTL_S. Never raises: it runs
    behind a durable write.
    """
    new_refs = attachment_refs(new_cfg)
    old_refs = attachment_refs(old_cfg)
    # Removing an attachment from a device that still exists is the user saying
    # "drop this one" — a trash button, no promise that anything is kept. A
    # device that is GONE is a different transition, and its files follow the
    # same rule as a deleted space's plan: kept.
    live_markers = {str(m.get("id")) for m in (new_cfg or {}).get("markers") or []}
    # Same distinction as for plans. A staging folder (`up_*`) is different: it
    # only ever holds an upload from a dialog that was never saved, so the short
    # rule is exactly right there even on the timer.
    now_s = time.time() if now is None else now
    staging_cutoff = now_s - PLAN_ORPHAN_TTL_S
    removed = 0
    try:
        folders = sorted(p for p in files_dir.iterdir() if p.is_dir()) if files_dir.is_dir() else []
    except OSError as err:
        _LOGGER.warning("House Plan: could not list %s: %s", files_dir, err)
        return 0
    removed += sweep_upload_temps(files_dir, now)
    for folder in folders:
        # A staging folder only ever holds an upload from a dialog that was never
        # saved — unambiguous, so an hour is right, and no device owns it.
        staging = folder.name.startswith("up_")
        try:
            items = sorted(p for p in folder.iterdir() if p.is_file())
        except OSError:
            continue
        for item in items:
            rel = f"{folder.name}/{item.name}"
            if rel in new_refs:
                continue
            dropped = rel in old_refs and folder.name in live_markers
            if not dropped:
                if not staging:
                    # Same rule as for plans: not asked for, so kept. A file in
                    # a device's folder that the device does not list is an
                    # upload whose save was rejected — and ageing those out
                    # raced the retry that was about to reference them.
                    continue
                try:
                    if item.stat().st_mtime >= staging_cutoff:
                        continue
                except OSError:
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


class QuotaError(Exception):
    """A store limit would be exceeded. Carries what to tell the user."""

    def __init__(self, reason: str, detail: str) -> None:
        super().__init__(detail)
        self.reason = reason
        self.detail = detail


def dir_usage(path: Path) -> tuple[int, int]:
    """(bytes, files) below `path`, ignoring what we cannot read."""
    total = count = 0
    if not path.is_dir():
        return 0, 0
    for item in path.rglob("*"):
        try:
            if item.is_file():
                total += item.stat().st_size
                count += 1
        except OSError:
            continue
    return total, count


def check_quota(path: Path, incoming: int, max_bytes: int, max_files: int) -> None:
    """Raise QuotaError unless `incoming` more bytes fit.

    Deliberately not an age rule. Files are never removed for getting old — that
    cost real plans twice — so the limit sits where a decision is being made
    anyway: at the moment somebody asks to store something new.
    """
    import shutil

    used, count = dir_usage(path)
    if count + 1 > max_files:
        raise QuotaError("too_many_files", f"{count} files already stored, the limit is {max_files}")
    if used + incoming > max_bytes:
        raise QuotaError(
            "quota_exceeded",
            f"{(used + incoming) // 1024 // 1024} MB would be stored, the limit is "
            f"{max_bytes // 1024 // 1024} MB",
        )
    try:
        free = shutil.disk_usage(str(path if path.is_dir() else path.parent)).free
    except OSError:
        return
    if free - incoming < MIN_FREE_BYTES:
        raise QuotaError("low_disk_space", f"only {free // 1024 // 1024} MB free on the disk")


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


def plan_by_space(cfg: dict[str, Any] | None) -> dict[str, str]:
    """space id -> the plan file it references ('' when it has none)."""
    return {
        str(sp.get("id")): plan_basename(sp.get("plan_url"))
        for sp in (cfg or {}).get("spaces") or []
    }


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
        is KEPT — see the rule above; only a staging folder ages out: a fresh one may
        belong to a transaction that has not committed yet.

    Never raises: the configuration is already stored by the time this runs, so
    a file-system problem must not turn a durable commit into a failed call.
    """
    new_refs = plan_refs(new_cfg)
    # A commit knows what it superseded. The timer only knows what nothing
    # points at *right now*, and for a plan that is a reversible state: the
    # editor detaches the image when a space switches to "draw" and says the
    # file stays on disk. So the scheduled pass keeps anything belonging to a
    # space that still exists, and waits a month for the rest.
    # A space with NO plan_url has had its image detached — reversible, and the
    # editor promises the file stays. A space that HAS one is different: any
    # other file of its own is a superseded or rejected upload, so the short
    # rule is right for those. Getting this distinction wrong (protecting
    # nothing) destroyed two detached plans on 2026-07-28.
    # The short rule fits exactly one case: a space that HAS a plan, where any
    # other file of its own can only be a superseded or rejected upload.
    old_by_space = plan_by_space(old_cfg)
    new_by_space = plan_by_space(new_cfg)
    # A file that left the configuration tells us nothing on its own: replacing a
    # plan, detaching one and deleting a space all look identical from
    # `old_refs - new_refs`. Only the first is a deletion the user asked for
    # (HP-1465-01 — the guards below were written and then never reached,
    # because the code decided "superseded" before asking why).
    replaced = {
        name for space, name in old_by_space.items()
        if new_by_space.get(space) and new_by_space[space] != name
    }
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
        if item.name not in replaced:
            # PRODUCT RULE (owner's decision, 2026-07-28): a plan file we were
            # not told to delete is kept, however long it sits there. Detaching
            # is one click to undo and the editor says the image stays; deleting
            # a space is deliberate but the image was imported and may be
            # nowhere else. The errors are not symmetrical — unnecessary
            # megabytes can be removed by hand, a deleted file cannot be
            # brought back.
            #
            # There is deliberately no age rule here. An earlier version aged
            # out "rejected uploads" — a file of a space that has a plan, which
            # was never the plan — and that raced a save: the sweep deleted the
            # upload from the failed attempt while a retry was committing a
            # reference to it. A rule that can delete a file somebody is about
            # to point at is not worth the disk it reclaims.
            continue
        try:
            item.unlink()
            removed += 1
        except OSError as err:
            _LOGGER.warning("House Plan: could not remove the old plan %s: %s", item, err)
    return removed
