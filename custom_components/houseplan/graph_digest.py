"""Canonical diagnostic digest; a mismatch never authorizes or refuses a write."""
import hashlib
import json
import struct


def graph_digest_bytes(graph: dict) -> bytes:
    value = [
        [[n["id"], n["p"]] for n in sorted(graph["nodes"], key=lambda n: n["id"])],
        [[e["kind"], e["id"], e["from"], e["to"], struct.pack(">d", float(e["cm"]) or 0.0).hex()]
         for e in sorted(graph["edges"], key=lambda e: e["kind"] + ":" + e["id"])],
        [[r["room"], [[e["kind"], e["id"], e["reverse"]] for e in r["edges"]]]
         for r in sorted(graph["rooms"], key=lambda r: r["room"])],
        [[d["node"], d["kind"], [[r["from"], r["to"]] for r in d["refs"]], d["parameters"]]
         for d in sorted(graph["dependencies"], key=lambda d: d["node"])],
    ]
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def graph_digest(graph: dict) -> str:
    return hashlib.sha256(graph_digest_bytes(graph)).hexdigest()
