"""Single-process, non-durable plan-only host for labs and adapter examples.

This assembles ports, not a web server. Commands, validation, revision changes,
portable imports and content ownership all remain in PlanCommands.
"""
from __future__ import annotations

import copy
from pathlib import Path
from types import SimpleNamespace

from .command_ports import CommandEnvironment, CommandPolicy, HostIdentity
from .content_files import FilesystemContent
from .graph_write import prepare_graph_candidate
from .house_resources import FilesystemHouseResources
from .import_leases import DictionaryImportLeases
from .memory_host import (
    MemoryAuthority,
    MemoryEffects,
    MemoryPlanStorage,
    ThreadCpuExecutor,
)
from .plan_commands import PLAN_APIS, PlanCommands
from .room_appearance import normalize_room_appearance
from .staging_commands import DictionaryStructuralStaging
from .structural_upload import StructuralUploads
from .validation import CONFIG_SCHEMA


class NoHostEntities:
    """No entity authority or HA registry is fabricated by the reference host."""

    def readable_entity_ids(self, selected):
        return set()

    def radar_registry(self):
        return None

    def import_registry_snapshot(self):
        return None

    async def configuration_extras(self, config, rev):
        return {}


class ReferencePlanHost:
    API = PLAN_APIS

    def __init__(self, config: dict, fingerprint: str | None, version: str, root: Path,
                 *, scope: str = "reference-plan", owner: str = "reference-owner"):
        self.root = root
        self.version, self.fingerprint = version, fingerprint
        # Bootstrap a synthetic fixture only. Persistent hosts load and recover
        # their authoritative pair before exposing command ports.
        config = normalize_room_appearance(CONFIG_SCHEMA(prepare_graph_candidate(copy.deepcopy(config), {}, force=True)))
        self.storage = MemoryPlanStorage({"config": config, "rev": 1}, {"layout": {}, "rev": 1})
        self.authority = MemoryAuthority(owner_id=owner, current_owner=owner,
                                         scope_id=scope, current_scope=scope)
        self.effects = MemoryEffects()
        self.runtime = SimpleNamespace(instance_id=scope, import_previews={}, integration_version=version)
        self.uploads = StructuralUploads()
        self.cpu = ThreadCpuExecutor()
        self.content = FilesystemContent(root, self.cpu)
        self.house = FilesystemHouseResources(root, self.cpu, lock=self.content.lock)
        self.storage.house = self.house
        self.environment = CommandEnvironment(self.content, NoHostEntities(), CommandPolicy.PLAN_ONLY,
            HostIdentity(scope, version, fingerprint), leases=DictionaryImportLeases(self.runtime),
            staging=DictionaryStructuralStaging(scope, self.uploads), house=self.house)
        self.commands = PlanCommands(self.storage, self.cpu, self.authority, self.effects, self.environment)

    async def request(self, message):
        message = copy.deepcopy(message)
        if "upload_token" in message:
            message = await self.commands.resolve_structural({"id": 1, **message})
        return await self.commands.execute(message)

    async def preview(self, raw, policy="skip"):
        return await self.commands.import_preview(raw, policy)

    async def stage(self, raw):
        async def blocks():
            yield raw

        return await self.commands.stage_structural(blocks(), len(raw))

    def pair(self):
        pair = self.storage.snapshot()
        return pair.config_data, pair.layout_data

    @property
    def config(self):
        return self.storage.config_data["config"]

    @property
    def layout(self):
        return self.storage.layout_data["layout"]

    @layout.setter
    def layout(self, value):
        self.storage.layout_data["layout"] = value

    @property
    def config_rev(self):
        return self.storage.config_data["rev"]

    @config_rev.setter
    def config_rev(self, value):
        self.storage.config_data["rev"] = value

    @property
    def layout_rev(self):
        return self.storage.layout_data["rev"]

    @layout_rev.setter
    def layout_rev(self, value):
        self.storage.layout_data["rev"] = value
