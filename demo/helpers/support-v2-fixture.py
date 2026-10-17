"""Synthetic browser fixture bridge to the ACTUAL support builder (#942)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from custom_components.houseplan.support_package import build_support_package  # noqa: E402

payload = json.load(sys.stdin)
request = payload["request"]
raw, meta = build_support_package(payload["config"], payload["layout"],
    config_rev=payload["config_rev"], layout_rev=payload["layout_rev"],
    card_version=request["card_version"], integration_version="1.81.0", home_assistant_version="2026.10.2",
    runtime={key: request[key] for key in ("browser_family", "browser_major", "language", "coarse_pointer",
                                         "hover_capable", "registry_access", "registry_age_bucket")},
    package_version=request.get("package_version", 1), diagnostics=request.get("diagnostics"),
    server_snapshot={"available": True, "trails_available": False})
print(json.dumps({**meta, "text": raw.decode(), "token": "a" * 48, "expires_in": 600}))
