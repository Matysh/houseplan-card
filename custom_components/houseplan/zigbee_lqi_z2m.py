"""Passive exact-topic Z2M reader; no publish, wildcard subscription or scan."""
from __future__ import annotations

import asyncio

from homeassistant.components import mqtt
from homeassistant.core import callback

from .zigbee_lqi_model import MAX_STATE_BYTES, inventory_of, lqi_number, payload_json


class Z2mLqiReader:
    def __init__(self, hass, changed, value, removed):
        self.hass = hass
        self.changed = changed
        self.value = value
        self.removed = removed
        self.inventories: dict[str, dict[str, str]] = {}
        self.bridges: dict[str, tuple[object, object]] = {}
        self.routes: dict[tuple[str, str], tuple[str, object, list]] = {}
        self.closed = False
        self.connected = False
        self.remove_status = None
        self.operations: set = set()
        self.allowed_topics: set = set()
        self.generation = 0

    @callback
    def _connection(self, connected):
        if self.closed:
            return
        self.connected = connected is True
        self.changed()

    async def _subscribe(self, topic, handler, current):
        if len(self.operations) >= 16:
            raise TimeoutError

        async def perform():
            remove = await mqtt.async_subscribe(self.hass, topic, handler, qos=0, encoding=None)
            if self.closed or not current():
                remove()
                return lambda: None
            return remove

        task = self.hass.async_create_background_task(perform(), "houseplan-lqi-subscribe")
        self.operations.add(task)

        @callback
        def settled(done):
            self.operations.discard(done)
            if not done.cancelled():
                done.exception()

        task.add_done_callback(settled)
        try:
            done, _ = await asyncio.wait({task}, timeout=10)
            if not done:
                raise TimeoutError
            return task.result()
        finally:
            if not task.done():
                task.cancel()

    def retain_topics(self, topics):
        """Retire callbacks synchronously when an accepted config drops a topic."""
        if set(topics) != self.allowed_topics:
            self.generation += 1
            self.allowed_topics = set(topics)
        for topic in list(self.bridges):
            if topic not in topics:
                _, remove = self.bridges.pop(topic)
                remove()
                self.inventories.pop(topic, None)
        for key in list(self.routes):
            if key[0] not in topics:
                self._remove_route(key)

    async def reconcile(self, topics, bindings):
        generation = self.generation
        if self.closed or set(topics) != self.allowed_topics:
            return
        try:
            enabled = mqtt.mqtt_config_entry_enabled(self.hass)
            self.connected = enabled and mqtt.is_connected(self.hass)
            if enabled and self.remove_status is None:
                self.remove_status = mqtt.async_subscribe_connection_status(self.hass, self._connection)
        except Exception:  # noqa: BLE001 - an optional provider cannot fail config reads
            enabled = False
            self.connected = False
        wanted = set(topics) if enabled else set()
        for topic in list(self.bridges):
            if topic not in wanted:
                _, remove = self.bridges.pop(topic)
                remove()
                self.inventories.pop(topic, None)
        for topic in wanted - self.bridges.keys():
            if generation != self.generation:
                return
            token = object()
            self.bridges[topic] = (token, lambda: None)

            @callback
            def receive(message, base=topic, expected=token):
                if self.closed or self.bridges.get(base, (None,))[0] is not expected:
                    return
                inventory = inventory_of(message.payload)
                if inventory is None:
                    return
                if inventory == self.inventories.get(base):
                    return
                for ieee in self.inventories.get(base, {}).keys() - inventory.keys():
                    self.removed((base, ieee))
                self.inventories[base] = inventory
                # Invalidate retired address callbacks synchronously, before
                # awaiting subscription changes or a registry refresh.
                for key, route in list(self.routes.items()):
                    if key[0] == base and inventory.get(key[1]) != route[0]:
                        self._remove_route(key)
                self.changed()

            try:
                remove = await self._subscribe(f"{topic}/bridge/devices", receive,
                    lambda base=topic, expected=token: generation == self.generation and self.bridges.get(base, (None,))[0] is expected)
                if self.closed or generation != self.generation or self.bridges.get(topic, (None,))[0] is not token:
                    remove()
                    if self.bridges.get(topic, (None,))[0] is token:
                        self.bridges.pop(topic, None)
                else:
                    self.bridges[topic] = (token, remove)
            except Exception:  # noqa: BLE001 - retry on the shared bounded cycle
                self.bridges.pop(topic, None)
        for key, route in list(self.routes.items()):
            if key not in bindings or bindings[key] != route[0] or key[0] not in wanted:
                self._remove_route(key)
        for key, address in bindings.items():
            if generation != self.generation:
                return
            if key in self.routes or key[0] not in wanted:
                continue
            token = object()
            removers: list = []
            self.routes[key] = (address, token, removers)
            for attribute in (False, True):
                topic = f"{key[0]}/{address}" + ("/linkquality" if attribute else "")

                @callback
                def receive_value(message, source=key, expected=token, attr=attribute):
                    if self.closed or self.routes.get(source, (None, None))[1] is not expected:
                        return
                    raw = message.payload
                    if isinstance(raw, str):
                        raw = raw.encode("utf-8")
                    if not isinstance(raw, bytes) or len(raw) > MAX_STATE_BYTES:
                        return
                    if attr:
                        try:
                            candidate = raw.decode("utf-8")
                        except UnicodeError:
                            return
                    else:
                        payload = payload_json(raw, MAX_STATE_BYTES)
                        if not isinstance(payload, dict) or "linkquality" not in payload:
                            return
                        candidate = payload["linkquality"]
                    value = lqi_number(candidate)
                    # Explicit unknown clears a measurement; malformed input
                    # cannot turn the previous known measurement into zero.
                    unknown = candidate is None or (isinstance(candidate, str) and candidate.lower() in {"unknown", "unavailable", "null"})
                    if value is not None or unknown:
                        self.value(source, value)

                try:
                    remove = await self._subscribe(topic, receive_value,
                        lambda source=key, expected=token: generation == self.generation and self.routes.get(source, (None, None))[1] is expected)
                    if self.closed or generation != self.generation or self.routes.get(key, (None, None))[1] is not token:
                        remove()
                        self._remove_route(key)
                        break
                    else:
                        removers.append(remove)
                except Exception:  # noqa: BLE001 - retire a partially installed address
                    self._remove_route(key)
                    break

    def _remove_route(self, key):
        route = self.routes.pop(key, None)
        if route:
            for remove in route[2]:
                remove()

    def close(self):
        self.closed = True
        if self.remove_status:
            self.remove_status()
            self.remove_status = None
        for _, remove in self.bridges.values():
            remove()
        self.bridges.clear()
        for key in list(self.routes):
            self._remove_route(key)
        self.inventories.clear()
        for task in self.operations:
            task.cancel()
