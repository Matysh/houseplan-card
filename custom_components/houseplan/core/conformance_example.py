"""Example second factory: JSON boundary around a local test service.

Replace _call with your authenticated local service client; keep the scenarios
unchanged. This proves factory/transport interoperability, NOT a second storage
engine or production database. Fault controls remain local test-only methods.
"""
from __future__ import annotations

import base64
import json

from .conformance import ReferenceAdapter


class JsonClientAdapter:
    def __init__(self, root):
        self.service = ReferenceAdapter(root)

    async def _call(self, method, *arguments):
        # A real client would send the serialized envelope to its test server.
        envelope = json.loads(json.dumps({"method": method, "arguments": arguments}))
        args = envelope["arguments"]
        if method in {"preview", "stage", "upload_plan", "upload_asset", "house_preview"}:
            args[0] = base64.b64decode(args[0])
        result = await getattr(self.service, method)(*args)
        return json.loads(json.dumps(result))

    async def reset(self, config):
        return await self._call("reset", config)

    async def request(self, command):
        return await self._call("request", command)

    async def snapshot(self):
        result = await self._call("snapshot")
        result["events"] = [(name, payload) for name, payload in result["events"]]
        return result

    async def preview(self, raw):
        return await self._call("preview", base64.b64encode(raw).decode())

    async def house_preview(self, raw, operation):
        return await self._call("house_preview", base64.b64encode(raw).decode(), operation)

    async def download_house(self, token):
        return await self._call("download_house", token)

    async def stage(self, raw):
        return await self._call("stage", base64.b64encode(raw).decode())

    async def upload_plan(self, raw, space, extension):
        return await self._call("upload_plan", base64.b64encode(raw).decode(), space, extension)

    async def upload_asset(self, raw, filename):
        return await self._call("upload_asset", base64.b64encode(raw).decode(), filename)

    async def revoke_next_preparation(self):
        return await self._call("revoke_next_preparation")

    async def fail_next_pair(self):
        return await self._call("fail_next_pair")
