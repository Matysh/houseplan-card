"""Session-local reversible marker deltas, independent of the HA transport.

Only explicitly changed fields belong to a command. Keyed collections retain
their current order, and control edges are merged individually. No old complete
configuration is ever restored over another writer's document.
"""
from __future__ import annotations

import copy
import hashlib
import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .plans import attachment_refs

LEASE_SECONDS = 24 * 60 * 60
MAX_COMMANDS = 50
MAX_SESSIONS = 128
MAX_SESSION_BYTES = 8 * 1024 * 1024
MAX_HISTORY_BYTES = 16 * 1024 * 1024


class HistoryError(ValueError):
    """An expired or conflicting command cannot write either store."""

    def __init__(self, code: str = "device_history_conflict") -> None:
        super().__init__(code)
        self.code = code


def _fingerprint(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _file_digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


@dataclass
class Change:
    path: tuple[str | tuple[str, str], ...]
    before: tuple[bool, Any]
    after: tuple[bool, Any]
    edges: bool = False
    before_order: tuple[str, ...] = ()
    after_order: tuple[str, ...] = ()


def _insert_order(values: list, value: Any, desired: list | tuple, identity=lambda item: item) -> None:
    key = identity(value)
    index = desired.index(key)
    current = [identity(item) for item in values]
    for successor in desired[index + 1:]:
        if successor in current:
            values.insert(current.index(successor), value)
            return
    for predecessor in reversed(desired[:index]):
        if predecessor in current:
            values.insert(current.index(predecessor) + 1, value)
            return
    values.insert(min(index, len(values)), value)


def _changes(before: Any, after: Any, path=()) -> list[Change]:
    if before == after:
        return []
    if isinstance(before, dict) and isinstance(after, dict):
        out = []
        for key in before.keys() | after.keys():
            if key in before and key in after:
                out.extend(_changes(before[key], after[key], (*path, key)))
            else:
                out.append(Change((*path, key), (key in before, copy.deepcopy(before.get(key))),
                                  (key in after, copy.deepcopy(after.get(key)))))
        return out
    if isinstance(before, list) and isinstance(after, list) and path and path[-1] in {"markers", "spaces", "led_strips"}:
        left, right = ({item["id"]: item for item in values} for values in (before, after))
        out = []
        for key in left.keys() | right.keys():
            at = (*path, ("id", key))
            if key in left and key in right:
                out.extend(_changes(left[key], right[key], at))
            else:
                out.append(Change(at, (key in left, copy.deepcopy(left.get(key))),
                                  (key in right, copy.deepcopy(right.get(key))),
                                  before_order=tuple(left), after_order=tuple(right)))
        return out
    return [Change(path, (True, copy.deepcopy(before)), (True, copy.deepcopy(after)),
                   bool(path and path[-1] == "controls" and isinstance(before, list) and isinstance(after, list)))]


def _slot(root: Any, path: tuple) -> tuple[Any, Any]:
    value = root
    for part in path[:-1]:
        if isinstance(part, tuple):
            value = next((item for item in value if item.get(part[0]) == part[1]), None) if isinstance(value, list) else None
        else:
            value = value.get(part) if isinstance(value, dict) else None
        if value is None:
            raise HistoryError()
    part = path[-1]
    if isinstance(part, tuple):
        if not isinstance(value, list):
            raise HistoryError()
        return value, next((i for i, item in enumerate(value) if item.get(part[0]) == part[1]), None)
    if not isinstance(value, dict):
        raise HistoryError()
    return value, part


def apply_changes(document: dict, changes: list[Change], forward: bool) -> dict:
    """Validate all touched values before changing the isolated candidate."""
    result = copy.deepcopy(document)
    for change in changes:
        owner, key = _slot(result, change.path)
        exists = key is not None if isinstance(owner, list) else key in owner
        actual = owner[key] if exists else None
        expected, target = (change.before, change.after) if forward else (change.after, change.before)
        if change.edges:
            if not exists or not isinstance(actual, list):
                raise HistoryError()
            removed = [edge for edge in expected[1] if edge not in target[1]]
            added = [edge for edge in target[1] if edge not in expected[1]]
            if any(edge not in actual for edge in removed) or any(edge in actual for edge in added):
                raise HistoryError()
            merged = [edge for edge in actual if edge not in removed]
            for edge in added:
                _insert_order(merged, edge, target[1])
            owner[key] = merged
            continue
        if (exists, actual) != expected:
            raise HistoryError()
        if isinstance(owner, list):
            if exists:
                if target[0]:
                    owner[key] = copy.deepcopy(target[1])
                else:
                    owner.pop(key)
            elif target[0]:
                _insert_order(owner, copy.deepcopy(target[1]), change.after_order if forward else change.before_order,
                              lambda item: item["id"])
        elif target[0]:
            owner[key] = copy.deepcopy(target[1])
        else:
            owner.pop(key, None)
    return result


def delete_candidate(config: dict, layout: dict, targets: list[dict]) -> tuple[dict, dict]:
    """The common Delete command; bindings are checked before any effect."""
    result, positions = copy.deepcopy(config), copy.deepcopy(layout)
    ids = {target["id"] for target in targets}
    if len(ids) != len(targets) or not ids:
        raise HistoryError()
    markers = result.get("markers") or []
    for target in targets:
        marker = next((item for item in markers if item.get("id") == target["id"]), None)
        if marker is None:
            binding = target["binding"]
            implicit = binding[7:] if binding.startswith("device:") else "lg_" + binding[7:]
            if binding == "virtual" or target["id"] != implicit:
                raise HistoryError()
            marker = {"id": target["id"], "binding": binding}
            markers.append(marker)
        if marker.get("removed") or marker.get("binding") != target["binding"]:
            raise HistoryError()
        removed = [item for item in markers if item.get("id") == target["id"]
                   or target["binding"] != "virtual" and item.get("binding") == target["binding"]]
        ids.update(item["id"] for item in removed)
        tombstone = {"id": target["id"], "binding": target["binding"], "removed": True, "hidden": True}
        markers = [tombstone if item.get("id") == target["id"] and target["binding"] != "virtual" else item
                   for item in markers if item not in removed or item.get("id") == target["id"] and target["binding"] != "virtual"]
    for marker_id in ids:
        positions.pop(marker_id, None)
    for marker in markers:
        if isinstance(marker.get("controls"), list):
            marker["controls"] = [edge for edge in marker["controls"] if edge not in {"marker:" + mid for mid in ids}]
    result["markers"] = markers
    for space in result.get("spaces") or []:
        for strip in space.get("led_strips") or []:
            if strip.get("marker") in ids:
                strip.update(marker=None, active=True)
    snapshots = result.get("settings", {}).get("marker_area_snapshot")
    if isinstance(snapshots, dict):
        result["settings"]["marker_area_snapshot"] = {key: value for key, value in snapshots.items() if key not in ids}
    return result, positions


@dataclass
class Command:
    changes: list[Change]
    spaces: set[str]
    targets: set[str]
    files: dict[str, str]
    identities_before: dict[str, Any]
    identities_after: dict[str, Any]
    strips: set[tuple[str, str]]
    bytes: int
    after: bool = True
    invalid: bool = False


@dataclass
class Session:
    owner: tuple[str, object]
    touched: float
    commands: dict[str, Command] = field(default_factory=dict)
    receipts: dict[str, tuple[str, dict]] = field(default_factory=dict)


class MarkerHistory:
    """Bounded leases; callers serialize every method with the paired writer."""

    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.sessions: dict[str, Session] = {}
        self.retired_files: dict[str, str] = {}
        self.identities = None

    def session(self, name: str, owner: tuple[str, object], create=False) -> Session:
        self.expire()
        session = self.sessions.get(name)
        if session is None and create:
            if len(self.sessions) >= MAX_SESSIONS:
                raise HistoryError("device_history_unavailable")
            session = self.sessions[name] = Session(owner, self.clock())
        if session is None or session.owner != owner:
            raise HistoryError("device_history_unavailable")
        session.touched = self.clock()
        return session

    def expire(self) -> None:
        for key, session in list(self.sessions.items()):
            if self.clock() - session.touched >= LEASE_SECONDS:
                self.release(session, [])
                del self.sessions[key]

    def replay(self, session: Session, action: str, request: dict) -> dict | None:
        old = session.receipts.get(action)
        if old and old[0] != _fingerprint(request):
            raise HistoryError()
        return copy.deepcopy(old[1]) if old else None

    def receipt(self, session: Session, action: str, request: dict, result: dict) -> None:
        # Outcomes are tiny; replay reads a fresh coherent pair. Retaining a
        # complete 2MiB plan for each Undo would multiply it by 256 x sessions.
        metadata = {key: result[key] for key in ("history_token", "config_rev", "layout_rev") if key in result}
        session.receipts[action] = (_fingerprint(request), metadata)
        while len(session.receipts) > 256:
            del session.receipts[next(iter(session.receipts))]

    def prepare(self, before: dict, after: dict, targets: set[str], root: Path) -> Command:
        if self.identities is None:
            self.identities = self._identities(before["config"])
        changes = _changes(before, after)
        # Related control owners have identity too: a new controller with an
        # old ID must never inherit a restored edge. Unrelated fields stay free.
        identity_targets = targets | {change.path[2][1] for change in changes
            if len(change.path) > 2 and change.path[:2] == ("config", "markers") and isinstance(change.path[2], tuple)}
        strips = {(change.path[2][1], change.path[4][1]) for change in changes
            if len(change.path) > 4 and change.path[:2] == ("config", "spaces") and isinstance(change.path[2], tuple)
            and change.path[3] == "led_strips" and isinstance(change.path[4], tuple)}
        spaces = {marker.get("space") for cfg in (before["config"], after["config"])
                  for marker in cfg.get("markers") or [] if marker.get("id") in targets and marker.get("space")}
        spaces |= {position["s"] for document in (before, after) for key, position in document["layout"].items()
                   if key in targets and position.get("s")}
        refs = attachment_refs({"markers": [marker for cfg in (before["config"], after["config"])
                                            for marker in cfg.get("markers") or [] if marker.get("id") in targets]})
        files = {}
        for ref in refs:
            path = (root / ref).resolve()
            if not path.is_relative_to(root.resolve()) or not path.is_file():
                raise HistoryError("device_history_unavailable")
            files[ref] = _file_digest(path)
        def identities(document):
            markers = {m["id"]: m for m in document["config"].get("markers") or []}
            return {key: [(field in markers[key], markers[key].get(field)) for field in ("binding", "space", "removed")]
                    if key in markers else None for key in identity_targets}
        size = len(json.dumps([change.__dict__ for change in changes], separators=(",", ":")).encode())
        size += len(json.dumps(files, separators=(",", ":")).encode())
        return Command(changes, spaces, identity_targets, files, identities(before), identities(after), strips, size)

    def candidate(self, command: Command, current: dict, forward: bool, root: Path) -> dict:
        if command.invalid or command.after == forward or not command.spaces.issubset({space["id"] for space in current["config"]["spaces"]}):
            raise HistoryError()
        markers = {m["id"]: m for m in current["config"].get("markers") or []}
        expected = command.identities_before if forward else command.identities_after
        for key, identity in expected.items():
            actual = [(field in markers[key], markers[key].get(field)) for field in ("binding", "space", "removed")] if key in markers else None
            if actual != identity:
                raise HistoryError()
        for ref, digest in command.files.items():
            path = (root / ref).resolve()
            if not path.is_relative_to(root.resolve()) or not path.is_file() or _file_digest(path) != digest:
                raise HistoryError("device_history_unavailable")
        return apply_changes(current, command.changes, forward)

    def release(self, session: Session, retained: list[str]) -> None:
        for key in list(session.commands):
            if key not in retained:
                self.retired_files.update(session.commands.pop(key).files)

    def refs(self) -> set[str]:
        self.expire()
        return {ref for session in self.sessions.values() for command in session.commands.values() for ref in command.files}

    @staticmethod
    def _identities(cfg):
        return ({m["id"]: (m.get("binding"), m.get("space"), bool(m.get("removed"))) for m in cfg.get("markers") or []},
                {space["id"] for space in cfg.get("spaces") or []},
                {(space["id"], strip["id"]) for space in cfg.get("spaces") or [] for strip in space.get("led_strips") or []})

    def observe_identity(self, before: dict, after: dict, exclude_session: Session | None = None) -> None:
        """Every completed canonical config commit observes related-record ABA."""
        old = self.identities if self.identities is not None else self._identities(before)
        new = self._identities(after)
        self.identities = new
        left, right = old[0], new[0]
        changed = {key for key in left.keys() | right.keys() if left.get(key) != right.get(key)}
        changed_spaces = old[1] ^ new[1]
        changed_strips = old[2] ^ new[2]
        for session in self.sessions.values():
            if session is exclude_session:
                continue
            for command in session.commands.values():
                if command.targets & changed or command.spaces & changed_spaces or command.strips & changed_strips:
                    command.invalid = True

    def check_create(self, session: Session, retained: list[str] | None) -> None:
        if retained is None:
            # Compatibility for a capability-aware client without retention
            # metadata: keep its existing commands, fail before the 51st write.
            if len(session.commands) >= MAX_COMMANDS:
                raise HistoryError("device_history_unavailable")
        elif len(set(retained)) >= MAX_COMMANDS or any(key not in session.commands for key in retained):
            raise HistoryError("device_history_unavailable")

    def accept_create(self, session: Session, retained: list[str] | None, token: str, command: Command) -> None:
        if retained is not None:
            self.release(session, retained)
        session.commands[token] = command

    def check_bytes(self, session: Session, command: Command, retained: list[str] | None) -> None:
        kept = retained if retained is not None else session.commands.keys()
        session_bytes = sum(session.commands[key].bytes for key in kept) + command.bytes
        total = sum(cmd.bytes for item in self.sessions.values() if item is not session for cmd in item.commands.values()) + session_bytes
        if session_bytes > MAX_SESSION_BYTES or total > MAX_HISTORY_BYTES:
            raise HistoryError("device_history_unavailable")

    def collect(self, root: Path, config: dict) -> None:
        """Only previously authorized files, unchanged bytes, no other live pin."""
        refs = attachment_refs(config) | self.refs()
        for ref, digest in list(self.retired_files.items()):
            if ref in refs:
                continue
            path = (root / ref).resolve()
            try:
                if path.is_relative_to(root.resolve()) and path.is_file() and _file_digest(path) == digest:
                    path.unlink()
                del self.retired_files[ref]
            except OSError:
                pass
