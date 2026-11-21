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
import secrets
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from .constants import MIN_FREE_BYTES, PLAN_ORPHAN_TTL_S
from .file_usage import dir_usage as dir_usage
from .validation import MAX_FILENAME, PLAN_EXTENSIONS, sanitize_filename

_LOGGER = logging.getLogger(__name__)

# Streaming uploads land here first. The prefix is a dot so the name can never
# collide with an attachment (sanitize_filename strips leading dots) and is easy
# to sweep.
TMP_PREFIX = ".upload-"


def atomic_write(path: Path, data: bytes, *, prefix: str = ".upload-") -> None:
    """Durably replace ``path`` without exposing a partial destination file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=prefix, dir=str(path.parent))
    temp = Path(temp_name)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


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


@dataclass(frozen=True, slots=True)
class ContentRetirement:
    plans: frozenset[str]
    attachments: frozenset[str]
    protected_attachments: frozenset[str]
    sweep_staging: bool


def content_retirement(old_cfg, new_cfg, pinned=(), *, sweep_staging=False) -> ContentRetirement:
    """Pure accepted-transition intent; physical hosts do not infer deletion."""
    new_plans = plan_refs(new_cfg)
    old_by_space, new_by_space = plan_by_space(old_cfg), plan_by_space(new_cfg)
    replaced = frozenset(name for space, name in old_by_space.items()
                         if new_by_space.get(space) and new_by_space[space] != name
                         and name not in new_plans and is_plan_file(name)
                         and sanitize_filename(name) == name)
    protected = frozenset(attachment_refs(new_cfg) | set(pinned))
    departed = attachment_refs(old_cfg) - protected
    live_markers = {str(marker.get("id")) for marker in (new_cfg or {}).get("markers") or []}
    dropped = frozenset(key for key in departed if key.split("/", 1)[0] in live_markers)
    return ContentRetirement(replaced, dropped, protected, bool(departed) or sweep_staging)


def collect_attachments(
    files_dir: Path,
    old_cfg: dict[str, Any] | None,
    new_cfg: dict[str, Any],
    now: float | None = None,
    *, pinned: set[str] | None = None, sweep_staging: bool = False,
) -> int:
    intent = content_retirement(old_cfg, new_cfg, pinned or (), sweep_staging=sweep_staging)
    return retire_attachments(files_dir, intent.attachments, intent.protected_attachments,
                              now, sweep_staging=intent.sweep_staging)


def retire_attachments(files_dir: Path, dropped_keys, new_refs, now=None, *, sweep_staging=False) -> int:
    """The same commit-scoped rule as `collect_plans`, for marker attachments.

    A file the old revision referenced and the new one does not, whose marker
    still exists, was removed on purpose — the dialog has a trash button and
    promises nothing. It goes. Everything else is kept, except a staging folder
    (`up_*`), which by construction only ever holds an upload from a dialog that
    was never saved: those go after PLAN_ORPHAN_TTL_S. The existing startup/daily
    maintenance explicitly requests that sweep; a write with no dropped refs
    performs no directory reads. Never raises: it runs behind a durable write.
    """
    can_drop = bool(dropped_keys)
    if not can_drop and not sweep_staging:
        return 0
    # Removing an attachment from a device that still exists is the user saying
    # "drop this one" — a trash button, no promise that anything is kept. A
    # device that is GONE is a different transition, and its files follow the
    # same rule as a deleted space's plan: kept.
    # Same distinction as for plans. A staging folder (`up_*`) is different: it
    # only ever holds an upload from a dialog that was never saved, so the short
    # rule is exactly right there even on the timer.
    now_s = time.time() if now is None else now
    staging_cutoff = now_s - PLAN_ORPHAN_TTL_S
    # #1096: maintenance ages staging only; device folders require a dropped ref.
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
        if not staging and not can_drop:
            continue
        try:
            items = sorted(p for p in folder.iterdir() if p.is_file())
        except OSError:
            continue
        for item in items:
            rel = f"{folder.name}/{item.name}"
            if rel in new_refs:
                continue
            dropped = rel in dropped_keys
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




def check_quota(
    path: Path,
    incoming: int,
    max_bytes: int,
    max_files: int,
    *,
    exclude: Path | None = None,
    additional_disk_bytes: int | None = None,
) -> None:
    """Raise QuotaError unless `incoming` fits the store and disk.

    `exclude` is omitted from current store usage but still charged as
    `incoming`. `additional_disk_bytes` is the part not physically written yet;
    by default all incoming bytes still need disk space. A staged file already
    under `path` passes zero because promotion only renames it (#554).

    Deliberately not an age rule. Files are never removed for getting old — that
    cost real plans twice — so the limit sits where a decision is being made
    anyway: at the moment somebody asks to store something new.
    """
    import shutil

    used, count = dir_usage(path, exclude=exclude)
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
    disk_incoming = incoming if additional_disk_bytes is None else additional_disk_bytes
    if free - disk_incoming < MIN_FREE_BYTES:
        raise QuotaError("low_disk_space", f"only {free // 1024 // 1024} MB free on the disk")


class _ChunkReader(Protocol):
    async def read_chunk(self, size: int = ...) -> bytes: ...


async def read_bounded(part: _ChunkReader, limit: int, chunk: int) -> bytes | None:
    """Read one multipart part into memory, or None once it passes ``limit``.

    The bound is inclusive: exactly ``limit`` bytes is accepted, one more is
    refused. Reading stops at the first block that crosses it, so an oversized
    upload never costs more than ``limit + chunk`` bytes of memory and nothing
    touches the disk (#617). Pure — the part only has to offer ``read_chunk``.
    """
    blocks: list[bytes] = []
    size = 0
    while block := await part.read_chunk(chunk):
        size += len(block)
        if size > limit:
            return None
        blocks.append(block)
    return b"".join(blocks)


def store_plan_upload(
    plans_dir: Path,
    space_id: str,
    ext: str,
    raw: bytes,
    *,
    max_bytes: int,
    max_files: int,
) -> str:
    """Write one validated plan upload under a new name and return that name.

    The single writer behind both transports — the HTTP view and the legacy
    WebSocket ``houseplan/plan/set`` (#617) — so naming, quota and the atomic
    write cannot drift between them. The caller has already checked
    ``space_id``, ``ext`` and the size, holds ``runtime.upload_lock`` and runs
    this as ONE executor job: the quota measurement is only a bound if nothing
    else writes between it and our write (HP-1490-02). A failed write reserves
    nothing — the file either exists and is counted by the next scan, or does
    not and is not.

    Copy-on-write: a plan is written under a NEW unique name and nothing is
    deleted here (review R2-1). The old name stays readable, so a config write
    that is later rejected leaves the stored plan exactly as it was; the file a
    commit REPLACES is collected by ``config/set`` itself (review R3-1).

    ``.`` separates the id from the token because a space id cannot contain one
    (SPACE_ID_RE), so "<space>.<token>.<ext>" can never be confused with the
    files of a differently named space.
    """
    name = f"{space_id}.{secrets.token_hex(4)}.{ext}"
    check_quota(plans_dir, len(raw), max_bytes, max_files)
    atomic_write(plans_dir / name, raw, prefix=".plan-upload-")
    return name


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
    intent = content_retirement(old_cfg, new_cfg)
    return retire_plans(plans_dir, intent.plans)


def retire_plans(plans_dir: Path, names) -> int:
    """Delete only explicitly retired logical keys, never inferred or aged files."""
    removed = 0
    for name in sorted(names):
        if sanitize_filename(name) != name or not is_plan_file(name):
            continue
        try:
            item = plans_dir / name
            if item.is_file():
                item.unlink()
                removed += 1
        except OSError as err:
            _LOGGER.warning("House Plan: could not remove the old plan %s: %s", name, err)
    return removed
