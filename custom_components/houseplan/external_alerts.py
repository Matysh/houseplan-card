"""Durable signals raised by HA actions, separate from the plan document."""
from __future__ import annotations

from asyncio import Lock
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.storage import Store

from .const import DOMAIN
from .store import get_data

STORAGE_KEY = f"{DOMAIN}.external_alerts"
CHANGED = f"{DOMAIN}_external_alerts_changed"
MAX_PER_TARGET = 16
MAX_TOTAL = 512
LEVELS = ("attention", "alarm")


class AlertActionError(ServiceValidationError):
    def __init__(self, key):
        super().__init__(translation_domain=DOMAIN, translation_key=key)


@dataclass(frozen=True)
class Target:
    kind: str
    ref: str

    @classmethod
    def from_call(cls, hass, data):
        if "device_id" in data:
            return cls("device", data["device_id"])
        entity_id = data["entity_id"]
        entry = er.async_get(hass).async_get(entity_id)
        return cls("registry_entity", entry.id) if entry else cls("entity", entity_id)

    def resolve(self, hass) -> tuple[str | None, str | None]:
        """Return the current entity and device identifiers."""
        if self.kind == "device":
            return None, self.ref if dr.async_get(hass).async_get(self.ref) is not None else None
        if self.kind == "registry_entity":
            entry = er.async_get(hass).async_get(self.ref)
            if entry is not None:
                return entry.entity_id, entry.device_id
            return None, None
        if hass.states.get(self.ref) is not None:
            return self.ref, None
        return None, None


@dataclass(frozen=True)
class Signal:
    target: Target
    key: str | None
    level: str
    message: str | None
    changed_at: str
    source_entity: str | None = None

    def stored(self):
        return {"kind": self.target.kind, "ref": self.target.ref, "key": self.key,
                "level": self.level, "message": self.message, "changed_at": self.changed_at,
                "source_entity": self.source_entity}


@dataclass(frozen=True)
class MarkerTarget:
    marker_id: str
    binding: str
    visible: bool


class Placements:
    """Resolve saved bindings and the registry's automatic room placements."""

    def __init__(self, hass, config):
        self.devices = dr.async_get(hass)
        self.entities = er.async_get(hass)
        self.hass = hass
        self.by_device: dict[str, list[MarkerTarget]] = defaultdict(list)
        self.by_entity: dict[str, list[MarkerTarget]] = defaultdict(list)
        self.claimed: set[str] = set()
        self.group_lights = (config.get("settings") or {}).get("group_lights", True)
        spaces = config.get("spaces") or []
        self.areas = {r["area"] for s in spaces for r in s.get("rooms", []) if r.get("area")}
        markers = config.get("markers") or []
        for marker in markers if spaces else ():
            binding = marker.get("binding") or ""
            kind, _, ref = binding.partition(":")
            if kind not in ("device", "entity") or not ref:
                continue
            self.claimed.add(binding)
            if marker.get("removed"):
                continue
            row = MarkerTarget(marker["id"], binding, not bool(marker.get("hidden")))
            if kind == "device":
                self.by_device[ref].append(row)
            else:
                self.by_entity[ref].append(row)
                entry = self.entities.async_get(ref)
                if entry and entry.device_id and not entry.disabled_by:
                    self.by_device[entry.device_id].append(row)

    def _automatic_device(self, device_id):
        binding = f"device:{device_id}"
        device = self.devices.async_get(device_id)
        if (binding in self.claimed or not device or device.disabled_by
                or device.entry_type == "service" or device.area_id not in self.areas):
            return []
        return [MarkerTarget(device_id, binding, True)]

    def _automatic_entity(self, entity_id):
        binding = f"entity:{entity_id}"
        entry = self.entities.async_get(entity_id)
        if not self.group_lights or binding in self.claimed or not entry or entry.disabled_by or entry.hidden_by:
            return []
        marker_id = f"lg_{entity_id}"
        device = self.devices.async_get(entry.device_id) if entry.device_id else None
        group_area = entry.area_id if entry.platform == "group" else (
            (device.area_id or entry.area_id) if device and not device.disabled_by and device.model == "Group" else None
        )
        if entity_id.startswith("light.") and group_area in self.areas:
            return [MarkerTarget(marker_id, binding, True)]
        return []

    def matching(self, entity_id, device_id):
        if entity_id:
            exact = self.by_entity[entity_id] or self._automatic_entity(entity_id)
            if exact or not device_id:
                return exact
            return [row for row in self.by_device[device_id] if row.binding == f"device:{device_id}"] + (
                self._automatic_device(device_id)
            )
        if device_id:
            return self.by_device[device_id] + self._automatic_device(device_id)
        return []

    def may_read(self, user, marker, entity_id, device_id):
        if user.is_admin:
            return True
        check = user.permissions.check_entity
        if entity_id and not check(entity_id, "read"):
            return False
        if marker.binding.startswith("entity:"):
            return check(marker.binding[7:], "read")
        return bool(entity_id) or any(
            not entry.disabled_by and check(entry.entity_id, "read")
            for entry in er.async_entries_for_device(self.entities, device_id)
        )


class ExternalAlerts:
    def __init__(self, hass):
        self.hass = hass
        self.store = Store(hass, 1, STORAGE_KEY, private=True)
        self.lock = Lock()
        self.records: dict[tuple[Target, str | None], Signal] | None = None

    async def _load(self):
        if self.records is None:
            data = await self.store.async_load() or {}
            records = {}
            for row in data.get("signals", []):
                target = Target(row["kind"], row["ref"])
                signal = Signal(target, row["key"], row["level"], row["message"],
                                row["changed_at"], row.get("source_entity"))
                records[(target, signal.key)] = signal
            self.records = records
        return self.records

    async def _save(self, records):
        await self.store.async_save({"signals": [row.stored() for row in records.values()]})
        self.records = records
        # The bus carries only invalidation. Text and target IDs stay on the scoped socket.
        self.hass.bus.async_fire(CHANGED)

    async def _placements(self, runtime):
        async with runtime.write_lock:
            cfg = await runtime.config_store.async_load() or {}
            return Placements(self.hass, cfg.get("config", {}))

    async def change(self, runtime, target, key, level=None, message=None, source_entity=None):
        async with self.lock:
            if get_data(self.hass) is not runtime:
                raise AlertActionError("alerts_unavailable")
            entity_id, device_id = target.resolve(self.hass)
            current = await self._load()
            if not entity_id and not device_id and (
                level is not None or not any(row.target == target for row in current.values())
            ):
                raise AlertActionError("unknown_alert_target")
            if level is None:
                next_records = {
                    ident: row for ident, row in current.items()
                    if row.target != target or (key is not None and row.key != key)
                }
                if next_records != current:
                    if get_data(self.hass) is not runtime:
                        raise AlertActionError("alerts_unavailable")
                    await self._save(next_records)
                return
            placements = await self._placements(runtime)
            if not placements.matching(entity_id, device_id):
                raise AlertActionError("alert_target_not_on_plan")
            ident = (target, key)
            existing = current.get(ident)
            if existing and (existing.level, existing.message, existing.source_entity) == (
                level, message, source_entity
            ):
                return
            if not existing and (
                len(current) >= MAX_TOTAL
                or sum(row.target == target for row in current.values()) >= MAX_PER_TARGET
            ):
                raise AlertActionError("alert_limit")
            next_records = dict(current)
            next_records[ident] = Signal(target, key, level, message, datetime.now(UTC).isoformat(), source_entity)
            if get_data(self.hass) is not runtime:
                raise AlertActionError("alerts_unavailable")
            await self._save(next_records)

    async def snapshot(self, user):
        async with self.lock:
            runtime = get_data(self.hass)
            if runtime is None:
                return []
            records = await self._load()
            if not records:
                return []
            placements = await self._placements(runtime)
            rows: list[dict[str, Any]] = []
            for signal in records.values():
                entity_id, device_id = signal.target.resolve(self.hass)
                markers = placements.matching(entity_id, device_id)
                owners = [{"id": marker.marker_id, "binding": marker.binding} for marker in markers
                          if marker.visible and placements.may_read(user, marker, entity_id, device_id)]
                if owners:
                    name = None
                    if signal.source_entity and (
                        user.is_admin or user.permissions.check_entity(signal.source_entity, "read")
                    ):
                        state = self.hass.states.get(signal.source_entity)
                        if state:
                            name = state.name[:255]
                    rows.append({"id": f"{signal.target.kind}/{signal.target.ref}/{signal.key or ''}",
                                 "owners": owners, "level": signal.level, "message": signal.message,
                                 "changed_at": signal.changed_at, "source_name": name})
            return rows

    async def remove_deleted_targets(self, event):
        """A registry removal is explicit; missing HA states alone are temporary."""
        if event.data.get("action") != "remove":
            return
        async with self.lock:
            records = await self._load()
            remaining = {ident: signal for ident, signal in records.items()
                         if signal.target.kind == "entity" or any(signal.target.resolve(self.hass))}
            if remaining != records:
                await self._save(remaining)

    async def counts(self):
        async with self.lock:
            records = await self._load()
            return {level: sum(row.level == level for row in records.values()) for level in LEVELS}
