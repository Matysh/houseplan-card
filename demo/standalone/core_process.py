"""Synthetic stdio test transport, not a server or a persistence product.

The actual portable/config/geometry core owns interpretation. This dispatcher
only owns a test revision pair, preview leases, files and one-deep undo intent.
No HA application is imported. See README for the deliberately finite API.
"""
from __future__ import annotations

import base64
import copy
import importlib.abc
import json
from pathlib import Path
import sys
import tempfile
import time
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))


class NoHomeAssistant(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == "homeassistant" or fullname.startswith("homeassistant."):
            raise AssertionError("standalone test process imported HA: " + fullname)


if __name__ == "__main__":
    sys.meta_path.insert(0, NoHomeAssistant())

from custom_components.houseplan.core import import_export as portable  # noqa: E402
from custom_components.houseplan.core.contact_basis import validate_contact_bases  # noqa: E402
from custom_components.houseplan.core.decor_assets import public_asset, validate_asset  # noqa: E402
from custom_components.houseplan.core.graph_write import prepare_graph_candidate  # noqa: E402
from custom_components.houseplan.core.junction_limits import validate_junction_limits  # noqa: E402
from custom_components.houseplan.core.opening_features import guard_opening_features_write  # noqa: E402
from custom_components.houseplan.core.structural_upload import StructuralUploads  # noqa: E402
from custom_components.houseplan.core.validation import (  # noqa: E402
    CONFIG_SCHEMA, LAYOUT_SCHEMA, MAX_CONFIG_BYTES, prepare_ordinary_summary_candidate,
    validate_active_marker_ids, validate_marker_controls, validate_marker_light_entities,
    validate_marker_value_badges, validate_marker_vacuum_routes, validate_opening_passages,
    validate_partition_opening_hosts, validate_wall_model_transition,
)
from custom_components.houseplan.core.wall_node_delete import node_delete_candidate  # noqa: E402
from custom_components.houseplan.core.wall_node_move import node_move_candidate  # noqa: E402


class TestFailure(ValueError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


class CoreTestTransport:
    API = {"opening_features_api": 1, "graph_change_api": 2, "plan_graph_api": 1,
           "room_label_layout_api": 1, "decor_assets_api": 1,
           "wall_node_move_api": 1, "wall_node_delete_api": 1,
           "wall_node_merge_api": 1, "wall_node_attach_api": 1}

    def __init__(self, config, fingerprint, version, root):
        self.root = root
        self.config = CONFIG_SCHEMA(prepare_graph_candidate(copy.deepcopy(config), {}, force=True))
        self.layout = {}
        self.config_rev = self.layout_rev = 1
        self.version, self.fingerprint = version, fingerprint
        self.runtime = SimpleNamespace(instance_id="standalone-synthetic", import_previews={}, integration_version=version)
        self.uploads = StructuralUploads()
        self.undo = None
        self.assets, self.plans = {}, {}
        self.events, self.trace = [], []

    def pair(self):
        return ({"config": self.config, "rev": self.config_rev}, {"layout": self.layout, "rev": self.layout_rev})

    def cas(self, message, *, pair=False, layout=False):
        if pair:
            good = message.get("expected_config_rev") == self.config_rev and message.get("expected_layout_rev") == self.layout_rev
        else:
            good = message.get("expected_rev") == (self.layout_rev if layout else self.config_rev)
        if not good:
            raise TestFailure("conflict")

    def checked_config(self, message, *, optimize=False):
        raw = copy.deepcopy(message["config"])
        if len(json.dumps(raw).encode()) > MAX_CONFIG_BYTES:
            raise TestFailure("too_large")
        guard_opening_features_write(raw, self.config, message.get("opening_features_api"))

        def normalize(candidate):
            candidate = prepare_graph_candidate(candidate, self.config, message.get("graph_change"), force=optimize)
            validate_wall_model_transition(candidate, self.config)
            return CONFIG_SCHEMA(candidate)

        checked = prepare_ordinary_summary_candidate(raw, self.config, None, normalize)
        for validate in (validate_active_marker_ids, validate_marker_controls, validate_marker_light_entities,
                         validate_marker_value_badges, validate_marker_vacuum_routes, validate_opening_passages):
            validate(checked, self.config)
        validate_partition_opening_hosts(checked, self.config, allow_optimize_rehost=optimize, allow_room_wall_promotion=not optimize)
        validate_junction_limits(checked, self.config)
        return checked

    def commit(self, config=None, layout=None, *, keep_undo=False):
        if config is not None:
            self.config = config
            self.config_rev += 1
            self.events.append({"event": "houseplan_config_updated", "rev": self.config_rev})
        if layout is not None:
            self.layout = layout
            self.layout_rev += 1
            self.events.append({"event": "houseplan_layout_updated", "rev": self.layout_rev})
        if not keep_undo:
            self.undo = None

    def request(self, message):
        message = copy.deepcopy(message)
        token = message.get("upload_token")
        if token:
            message = self.uploads.resolve({**message, "id": 1}, "test-owner")
            self.uploads.consume(token, "test-owner")
        name = message["type"]
        self.trace.append(name)
        if name == "houseplan/config/get":
            return {"config": self.config, "rev": self.config_rev, "can_write": True,
                    "integration_version": self.version, "frontend_fingerprint": self.fingerprint,
                    "can_optimize_undo": self.undo is not None, "undo_kind": "optimize" if self.undo else None,
                    **self.API}
        if name == "houseplan/layout/get":
            return {"layout": self.layout, "rev": self.layout_rev, "can_optimize_undo": self.undo is not None,
                    "undo_kind": "optimize" if self.undo else None}
        if name == "houseplan/config/set":
            self.cas(message)
            candidate = self.checked_config(message)
            layout = None
            if "contact_layout" in message or "room_label_layout" in message:
                if message.get("expected_layout_rev") != self.layout_rev:
                    raise TestFailure("conflict")
                validate_contact_bases(message.get("contact_layout", {}), self.layout)
                layout = LAYOUT_SCHEMA({**self.layout, **message.get("contact_layout", {}), **message.get("room_label_layout", {})})
            self.commit(candidate, layout)
            return {"ok": True, "rev": self.config_rev, "config": self.config, "layout_rev": self.layout_rev, "layout": self.layout}
        if name == "houseplan/layout/set":
            self.cas(message, layout=True)
            if "expected_config_rev" in message and message["expected_config_rev"] != self.config_rev:
                raise TestFailure("conflict")
            candidate = LAYOUT_SCHEMA(portable.live_layout(self.config, message["layout"]))
            validate_contact_bases(candidate, self.layout)
            self.commit(layout=candidate)
            return {"ok": True, "rev": self.layout_rev, "layout": self.layout}
        if name in {"houseplan/wall/node_move", "houseplan/wall/node_delete"}:
            self.cas(message)
            prepare = node_move_candidate if name.endswith("node_move") else node_delete_candidate
            candidate = prepare(self.config, message["space_id"], message["intent"], message.get("direction", "apply"), message.get("before_space"))
            self.commit(CONFIG_SCHEMA(candidate))
            return {"ok": True, "rev": self.config_rev, "config": self.config}
        if name == "houseplan/plan/optimize":
            self.cas(message, pair=True)
            config = self.checked_config(message, optimize=True)
            layout = LAYOUT_SCHEMA(portable.live_layout(config, message["layout"]))
            backup = (copy.deepcopy(self.config), copy.deepcopy(self.layout))
            self.commit(config, layout)
            self.undo = backup
            return {"ok": True, "config_rev": self.config_rev, "layout_rev": self.layout_rev,
                    "config": self.config, "layout": self.layout, "can_undo": True}
        if name == "houseplan/plan/optimize_undo":
            self.cas(message, pair=True)
            if self.undo is None:
                raise TestFailure("no_undo")
            config, layout = self.undo
            self.commit(config, layout)
            return {"ok": True, "config_rev": self.config_rev, "layout_rev": self.layout_rev,
                    "config": self.config, "layout": self.layout, "can_undo": False}
        if name == "houseplan/export/create":
            if message.get("kind") != "space" or message.get("plan_only") is not True:
                raise TestFailure("not_ready")
            config, layout = self.pair()
            document, filename = portable.create_export(self.runtime, config, layout, kind="space", space_id=message["space_id"],
                plan_only=True, card_version=self.version, config_root=self.root)
            return {"document": document, "filename": filename}
        if name == "houseplan/import/apply":
            self.cas(message, pair=True)
            candidate = self.runtime.import_previews.get(message.get("token"))
            if not candidate or candidate["expires"] < time.time() or candidate["owner_id"] != "test-owner":
                raise TestFailure("preview_expired")
            if candidate["document"]["kind"] != "space":
                raise TestFailure("not_ready")
            config, layout, details = portable.prepare_apply(candidate, self.config, self.layout,
                duplicate_policy=message.get("duplicate_policy"), confirm_missing_content=bool(message.get("confirm_missing_content")))
            self.commit(config, layout)
            self.runtime.import_previews.pop(message["token"], None)
            return {"ok": True, "kind": "space", "config_rev": self.config_rev, "layout_rev": self.layout_rev, **details}
        if name == "houseplan/backup/cancel":
            self.runtime.import_previews.pop(message.get("token"), None)
            return {"ok": True}
        if name == "houseplan/import/revalidate":
            candidate = self.runtime.import_previews.get(message.get("token"))
            if not candidate:
                raise TestFailure("preview_expired")
            raw = json.dumps(candidate["document"]).encode()
            return self.preview(raw, message.get("duplicate_policy", "skip"))
        if name == "houseplan/plans/list":
            return {"plans": list(self.plans.values())}
        if name == "houseplan/assets/list":
            return {"assets": [value[0] for value in self.assets.values()]}
        if name == "houseplan/assets/delete":
            self.assets.pop(message["asset_id"], None)
            return {"ok": True}
        raise TestFailure("fixture_unsupported")

    def preview(self, raw, policy="skip"):
        config, layout = self.pair()
        return portable.create_preview(self.runtime, raw, owner_id="test-owner", duplicate_policy=policy,
            current_config_data=config, current_layout_data=layout, config_root=self.root)

    def post(self, path, value):
        if path == "/api/houseplan/structural/upload":
            raw = json.dumps(value, separators=(",", ":")).encode()
            token = self.uploads.begin("test-owner", len(raw))
            self.uploads.append(token, "test-owner", raw)
            return self.uploads.finish(token, "test-owner")
        if path.startswith("/api/houseplan/import/preview"):
            return self.preview(base64.b64decode(value["bytes"]))
        if path in {"/api/houseplan/assets/upload", "/api/houseplan/plans/upload"}:
            asset = validate_asset(base64.b64decode(value["bytes"]), value["name"], value.get("mime"))
            row = public_asset({"asset_id": asset.asset_id, "ext": asset.ext, "mime": asset.mime,
                "width": asset.width, "height": asset.height, "bytes": len(asset.data), "name": value["name"]})
            url = "data:" + asset.mime + ";base64," + base64.b64encode(asset.data).decode()
            row["url"] = url
            if path.endswith("plans/upload"):
                self.plans[asset.asset_id] = {"name": value["name"], "url": url}
                return {"url": url}
            self.assets[asset.asset_id] = (row, url)
            return {"asset": row}
        raise TestFailure("fixture_unsupported")


def main():
    transport = None
    with tempfile.TemporaryDirectory(prefix="houseplan-standalone-core-") as directory:
        for line in sys.stdin:
            envelope = json.loads(line)
            try:
                op = envelope["op"]
                if op == "init":
                    transport = CoreTestTransport(envelope["config"], envelope["fingerprint"], envelope["version"], Path(directory))
                    result = {"ready": True, "python": sys.version.split()[0]}
                elif op == "request":
                    result = transport.request(envelope["command"])
                elif op == "post":
                    result = transport.post(envelope["path"], envelope["value"])
                elif op == "snapshot":
                    result = {"config": transport.config, "layout": transport.layout, "trace": transport.trace,
                              "haImported": any(name == "homeassistant" or name.startswith("homeassistant.") for name in sys.modules)}
                else:
                    raise TestFailure("fixture_unsupported")
                events, transport.events = transport.events, []
                reply = {"id": envelope["id"], "result": result, "events": events}
            except Exception as error:  # noqa: BLE001 - explicit test RPC error channel; tests assert its code
                reply = {"id": envelope["id"], "error": {"code": getattr(error, "code", "invalid_format"), "message": str(error)[:400]}}
            print(json.dumps(reply), flush=True)


if __name__ == "__main__":
    main()
