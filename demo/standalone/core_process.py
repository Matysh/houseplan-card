"""Synthetic stdio adapter for the common command service, never a server.

All plan semantics are in core. Only lab RPC framing, base64 and synthetic
content URLs live here. This process has no HA application or durable storage.
"""
# ruff: noqa: E402 -- install the isolated subprocess import guard first
from __future__ import annotations

import asyncio
import base64
import importlib.abc
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))


class NoHomeAssistant(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == "homeassistant" or fullname.startswith("homeassistant."):
            raise AssertionError("standalone test process imported HA: " + fullname)


if __name__ == "__main__":
    sys.meta_path.insert(0, NoHomeAssistant())

from custom_components.houseplan.core.command_ports import CommandError  # noqa: E402
from custom_components.houseplan.core.constants import (  # noqa: E402
    ASSETS_DIR,
    FILES_DIR,
    PLANS_DIR,
)
from custom_components.houseplan.core.content_index import (
    internal_reference,  # noqa: E402
)
from custom_components.houseplan.core.reference_host import (
    ReferencePlanHost,  # noqa: E402
)


class CoreTestTransport(ReferencePlanHost):
    def __init__(self, config, fingerprint, version, root):
        super().__init__(config, fingerprint, version, root)
        self.trace = []

    async def request(self, message):
        self.trace.append(message["type"])
        return await super().request(message)

    async def post(self, path, value):
        if path == "/api/houseplan/structural/upload":
            return await self.stage(json.dumps(value, separators=(",", ":")).encode())
        raw = base64.b64decode(value["bytes"])
        if path == "/api/houseplan/transfer/import/preview":
            from custom_components.houseplan.core.house_archive import check_prefix

            check_prefix(raw[:1024])

            async def blocks():
                yield raw

            return await self.commands.house_preview(blocks(), len(raw), value.get("operation_id", "lab-house"))
        if path.startswith("/api/houseplan/import/preview"):
            from urllib.parse import parse_qs, urlsplit

            policy = parse_qs(urlsplit(path).query).get("duplicate_policy", ["skip"])[0]
            return await self.preview(raw, policy)
        if path == "/api/houseplan/assets/upload":
            return await self.commands.upload_asset(raw, value["name"], value.get("mime"))
        if path == "/api/houseplan/plans/upload":
            return await self.commands.upload_plan(raw, value.get("space_id"), value.get("ext"))
        raise CommandError("invalid_format", "Unknown lab HTTP route")

    async def get(self, path):
        from urllib.parse import parse_qs, urlsplit

        from custom_components.houseplan.core.house_commands import download

        parsed = urlsplit(path)
        prefix = "/api/houseplan/transfer/export/"
        if not parsed.path.startswith(prefix):
            raise CommandError("invalid_format", "Unknown lab GET route")
        token = parsed.path[len(prefix):]
        consent = parse_qs(parsed.query).get("confirm_missing_content", ["0"])[0]
        if consent not in {"0", "1"}:
            raise CommandError("invalid_format")
        async with download(self.commands, token, consent == "1") as (filename, blocks):
            raw = b"".join([block async for block in blocks])
        # RPC-only synthetic transport. The real HA endpoint streams chunks.
        return {"bytes": base64.b64encode(raw).decode(), "mime": "application/zip", "filename": filename}

    async def resolve_content(self, paths):
        def read():
            import mimetypes

            result = {}
            for url in paths:
                ref = internal_reference(url)
                if ref is None:
                    continue
                directory = {"plan": PLANS_DIR, "attachment": FILES_DIR, "asset_file": ASSETS_DIR}.get(ref.kind)
                if directory is None:
                    continue
                path = self.root / directory / ref.key
                if path.is_file():
                    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
                    result[url] = "data:" + mime + ";base64," + base64.b64encode(path.read_bytes()).decode()
            return result

        return await self.cpu.run(read)


def main():
    transport = None
    with tempfile.TemporaryDirectory(prefix="houseplan-standalone-core-") as directory, asyncio.Runner() as runner:
        for line in sys.stdin:
            envelope = json.loads(line)
            try:
                op = envelope["op"]
                if op == "init":
                    transport = CoreTestTransport(envelope["config"], envelope["fingerprint"], envelope["version"], Path(directory))
                    result = {"ready": True, "python": sys.version.split()[0]}
                elif op == "request":
                    result = runner.run(transport.request(envelope["command"]))
                elif op == "post":
                    result = runner.run(transport.post(envelope["path"], envelope["value"]))
                elif op == "get":
                    result = runner.run(transport.get(envelope["path"]))
                elif op == "content":
                    result = runner.run(transport.resolve_content(envelope["paths"]))
                elif op == "snapshot":
                    result = {"config": transport.config, "layout": transport.layout, "trace": transport.trace,
                              "haImported": any(name == "homeassistant" or name.startswith("homeassistant.") for name in sys.modules)}
                else:
                    raise CommandError("invalid_format", "Unknown lab RPC")
                events = [{"event": name, **data} for name, data in transport.effects.events]
                transport.effects.events.clear()
                reply = {"id": envelope["id"], "result": result, "events": events}
            except Exception as error:  # noqa: BLE001 - explicit lab RPC error channel
                reply = {"id": envelope["id"], "error": {"code": getattr(error, "code", "invalid_format"), "message": str(error)[:400]}}
            print(json.dumps(reply), flush=True)


if __name__ == "__main__":
    main()
