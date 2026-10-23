"""One volatile own-radio LQI projection per House Plan entry."""
from __future__ import annotations

import asyncio
import json
from datetime import timedelta
from time import time
from uuid import uuid4

from homeassistant.core import callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_time_interval

from .zigbee_lqi_model import (
    MAX_DEVICES,
    MAX_SNAPSHOT_BYTES,
    registry_ieee,
    represented_devices,
)
from .zigbee_lqi_z2m import Z2mLqiReader
from .zigbee_lqi_zha import read_zha
from .zigbee_topology import ZigbeeScanError, normalize_base_topic


class ZigbeeLqiCoordinator:
    def __init__(self, hass, entry):
        self.hass = hass
        self.entry = entry
        self.closed = False
        self.session_id = uuid4().hex
        self.revision = 0
        self.config: dict = {}
        self.rows: dict = {}
        self.values: dict = {}
        self.bindings: dict = {}
        self.listeners: set = set()
        self.removers: list = []
        self._refresh_task = None
        self._refresh_again = False
        self._emit_timer = None
        self._zha_gateway = None
        self._zha_entry = None
        self._zha_devices: dict = {}
        self._zha_available = False
        self.z2m = Z2mLqiReader(hass, self.request_refresh, self._z2m_value, self._z2m_removed)

    async def async_setup(self, config):
        self.config = config
        self.z2m.retain_topics(self._topics())
        @callback
        def registry_changed(_event):
            self.request_refresh()

        for event in ("device_registry_updated", "entity_registry_updated"):
            self.removers.append(self.hass.bus.async_listen(event, registry_changed))
        self.removers.append(async_track_time_interval(self.hass, self._tick, timedelta(seconds=30)))
        self.request_refresh()

    async def _tick(self, _now=None):
        self.request_refresh()

    async def async_config_saved(self, config):
        self.config = config
        # Retire read authority now; the asynchronous transport refresh cannot
        # leave devices from a removed plan visible in a WS snapshot.
        devices = dr.async_get(self.hass).devices
        entities = er.async_get(self.hass).entities
        scope = represented_devices(config, devices, entities)
        topics = self._topics()
        self.z2m.retain_topics(topics)
        self.bindings = {source: key for source, key in self.bindings.items()
                         if key in scope and (source[0] != "z2m" or source[1] in topics)}
        self.values = {source: value for source, value in self.values.items() if source in self.bindings}
        self.rows = {key: row for key, row in self.rows.items() if key in set(self.bindings.values())}
        self._changed()
        self.request_refresh()

    @callback
    def request_refresh(self):
        if self.closed:
            return
        self._refresh_again = True
        if self._refresh_task is None:
            # Install the owner before retained MQTT can call back during
            # subscribe. A nested refresh must join this one, not start a twin.
            self._refresh_task = self.entry.async_create_background_task(
                self.hass, self._refresh_loop(), "houseplan-lqi", eager_start=False)

    async def _refresh_loop(self):
        try:
            while self._refresh_again and not self.closed:
                self._refresh_again = False
                await self.async_refresh()
        finally:
            self._refresh_task = None

    def _topics(self):
        settings = self.config.get("settings") or {}
        topology = settings.get("zigbee_topology") or {}
        values = topology.get("z2m_base_topics") or ["zigbee2mqtt"]
        topics = []
        for value in values[:8]:
            try:
                topic = normalize_base_topic(value)
            except ZigbeeScanError:
                continue
            if topic not in topics:
                topics.append(topic)
        return topics or ["zigbee2mqtt"]

    async def async_refresh(self):
        if self.closed:
            return
        devices = dr.async_get(self.hass).devices
        entities = er.async_get(self.hass).entities
        scope = represented_devices(self.config, devices, entities)
        topics = self._topics()
        gateway, zha_entry, zha_values = read_zha(self.hass)
        self._zha_available = gateway is not None
        if gateway is not None:
            if self._zha_gateway is not gateway:
                self.values = {key: value for key, value in self.values.items() if key[0] != "zha"}
            self._zha_gateway = gateway
            self._zha_entry = zha_entry
            self._zha_devices = zha_values
        candidates: dict = {}
        for device_id in scope:
            device = devices[device_id]
            entry_ids = set(device.config_entries)
            for domain, identifier in device.identifiers:
                ieee = registry_ieee(domain, identifier)
                if not ieee:
                    continue
                if domain == "zha" and self._zha_entry in entry_ids and ieee in self._zha_devices:
                    candidates.setdefault(device_id, set()).add(("zha", self._zha_entry, ieee))
                elif domain == "mqtt" and any(
                    (entry := self.hass.config_entries.async_get_entry(key)) is not None and entry.domain == "mqtt"
                    for key in entry_ids
                ):
                    for topic in topics:
                        if ieee in self.z2m.inventories.get(topic, {}):
                            candidates.setdefault(device_id, set()).add(("z2m", topic, ieee))
        # Both one-device/many-provider and one-provider/many-device conflicts
        # refuse direct data. A consumer can independently use its HA fallback.
        bindings = {}
        duplicated: set = set()
        for device_id, sources in candidates.items():
            if len(sources) != 1:
                continue
            source = next(iter(sources))
            if source in bindings:
                duplicated.add(source)
            bindings[source] = device_id
        for source in duplicated:
            bindings.pop(source, None)
        if len(bindings) > MAX_DEVICES:
            bindings = {}
        self.bindings = bindings
        self.values = {key: value for key, value in self.values.items() if key in bindings}
        for source in bindings:
            if source[0] == "zha" and gateway is not None:
                self._put(source, zha_values.get(source[2]))
        self._project(gateway is not None)
        addresses = {(source[1], source[2]): self.z2m.inventories[source[1]][source[2]]
                     for source in bindings if source[0] == "z2m"}
        await self.z2m.reconcile(topics, addresses)
        if not self.closed:
            self._project(gateway is not None)

    def _put(self, source, value):
        if value is None:
            self.values.pop(source, None)
        elif source not in self.values or self.values[source]["lqi"] != value:
            # observed_at means when this cache first saw this value, never
            # measurement time, last_seen or a periodic read timestamp.
            self.values[source] = {"lqi": value, "observed_at": time(), "measurement_at": None}

    def _z2m_value(self, source, value):
        key = ("z2m", *source)
        if key not in self.bindings or source[1] not in self.z2m.inventories.get(source[0], {}):
            return
        self._put(key, value)
        self._project(self._zha_available)

    def _z2m_removed(self, source):
        key = ("z2m", *source)
        self.values.pop(key, None)
        self.bindings.pop(key, None)
        self._project(self._zha_available)

    def _project(self, zha_available):
        rows = {}
        for source, device_id in self.bindings.items():
            device = dr.async_get(self.hass).devices.get(device_id)
            domain = "mqtt" if source[0] == "z2m" else "zha"
            if device is None or getattr(device, "disabled_by", None) is not None or not any(
                identifier_domain == domain and registry_ieee(domain, identifier) == source[2]
                for identifier_domain, identifier in device.identifiers
            ):
                continue
            value = self.values.get(source)
            if value is None:
                continue
            available = self.z2m.connected if source[0] == "z2m" else zha_available
            rows[device_id] = {**value, "provider": source[0], "available": available}
        if rows != self.rows:
            self.rows = rows
            self._changed()

    def _changed(self):
        if self.closed or self._emit_timer is not None:
            return
        self._emit_timer = self.hass.loop.call_later(1, self.flush)

    @callback
    def flush(self):
        if self._emit_timer:
            self._emit_timer.cancel()
            self._emit_timer = None
        if self.closed:
            return
        self.revision += 1
        event = self.snapshot()
        for listener in tuple(self.listeners):
            listener(event)

    def snapshot(self):
        rows = self.rows
        if len(json.dumps(rows, separators=(",", ":")).encode()) > MAX_SNAPSHOT_BYTES:
            rows = {}
        # Full bounded snapshots also make a revision gap recoverable without
        # an extra fetch racing the subscription's first event.
        return {"kind": "reset", "session_id": self.session_id, "revision": self.revision,
                "devices": {key: dict(row) for key, row in rows.items()}}

    def add_listener(self, listener):
        if self.closed or len(self.listeners) >= 32:
            raise ValueError("not_ready")
        self.listeners.add(listener)
        return lambda: self.listeners.discard(listener)

    async def async_close(self):
        if self.closed:
            return
        self.closed = True
        for remove in self.removers:
            remove()
        self.removers.clear()
        self.z2m.close()
        if self._emit_timer:
            self._emit_timer.cancel()
            self._emit_timer = None
        if self._refresh_task:
            self._refresh_task.cancel()
            await asyncio.gather(self._refresh_task, return_exceptions=True)
        for listener in tuple(self.listeners):
            listener({"kind": "closed", "session_id": self.session_id, "revision": self.revision + 1})
        self.listeners.clear()
        self.values.clear()
        self.bindings.clear()
        self.rows.clear()
