"""External-process factory used only to rehearse installation conformance."""
from __future__ import annotations

import asyncio
import atexit
import base64
import json
import os
import subprocess
import sys
from pathlib import Path

from houseplan_core.command_ports import CommandError
from houseplan_core.conformance import ReferenceAdapter
from houseplan_core.conformance_example import JsonClientAdapter


class ExternalAdapter(JsonClientAdapter):
    def __init__(self, root):
        self.test_service = subprocess.Popen(
            [sys.executable, "-I", __file__, str(root)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding="utf-8",
        )
        atexit.register(self.close)

    def close(self):
        self.test_service.stdin.close()
        try:
            self.test_service.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.test_service.kill()
            self.test_service.wait()

    async def _call(self, method, *arguments):
        self.test_service.stdin.write(json.dumps({"method": method, "arguments": arguments}) + "\n")
        self.test_service.stdin.flush()
        reply = self.test_service.stdout.readline()
        if not reply:
            raise RuntimeError("External conformance process stopped without a response")
        envelope = json.loads(reply)
        if "error" in envelope:
            raise CommandError(envelope["error"]["code"], envelope["error"]["message"])
        return envelope["result"]


def create_adapter(root):
    return ExternalAdapter(root)


def serve(root):
    adapter = ReferenceAdapter(root)
    with asyncio.Runner() as runner:
        for line in sys.stdin:
            request = json.loads(line)
            method, args = request["method"], request["arguments"]
            if os.environ.get("HP_TEST_WRONG_EXTERNAL_REPLY") == "1" and method == "request":
                print("External negative control delivered", file=sys.stderr, flush=True)
                print('{"result": null}', flush=True)
                continue
            if method in {"preview", "stage", "upload_plan", "upload_asset", "house_preview"}:
                args[0] = base64.b64decode(args[0])
            try:
                response = {"result": runner.run(getattr(adapter, method)(*args))}
            except Exception as error:
                # Import/geometry have their own typed domain failures. A transport
                # client reconstructs the public code; unexpected failures still stop.
                code = getattr(error, "code", None)
                if not isinstance(code, str):
                    raise
                response = {"error": {"code": code, "message": str(error)}}
            print(json.dumps(response), flush=True)


if __name__ == "__main__":
    serve(Path(sys.argv[1]))
