#!/usr/bin/env python3
"""#33: dump the canonical persisted-config schema into a deterministic JSON.

The Voluptuous schema in custom_components/houseplan/validation.py is the
single owner of the persisted config/layout shape. This walker turns it into
scripts/config-schema.json — the machine-readable manifest the
frontend parity test and the field registry completeness test consume.

Determinism contract: two runs on the same tree produce byte-identical
output (sorted paths, sorted keys, stable value rendering). A validator this
walker does not understand is written fail-closed as {"opaque": "<repr>"} —
the manifest stays fresh and the parity test simply does not judge that node.

The importer stubs the parent packages so custom_components/houseplan/
__init__.py (which needs homeassistant) never executes; validation.py itself
is dependency-free apart from voluptuous.
"""
from __future__ import annotations

import importlib.util
import json
import re
import sys
import types
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "scripts" / "config-schema.json"


def _safe_repr(value) -> str:
    """repr() without memory addresses — the manifest must be deterministic."""
    if callable(value) and hasattr(value, "__qualname__"):
        return f"<function {value.__qualname__}>"
    return re.sub(r" at 0x[0-9a-fA-F]+", "", repr(value))


def _load_validation():
    for name, path in (
        ("custom_components", REPO / "custom_components"),
        ("custom_components.houseplan", REPO / "custom_components" / "houseplan"),
    ):
        module = types.ModuleType(name)
        module.__path__ = [str(path)]
        sys.modules[name] = module

    def load(name: str, file: Path):
        spec = importlib.util.spec_from_file_location(name, file)
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
        return module

    load(
        "custom_components.houseplan.coordinate_canonicalization",
        REPO / "custom_components" / "houseplan" / "coordinate_canonicalization.py",
    )
    return load(
        "custom_components.houseplan.validation",
        REPO / "custom_components" / "houseplan" / "validation.py",
    )


def _render_default(value):
    """Stable, JSON-safe rendering of a schema default."""
    try:
        if callable(value):
            produced = value()
            return {"factory": type(produced).__name__}
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return {"opaque": _safe_repr(value)}


def build_manifest():
    import voluptuous as vol

    validation = _load_validation()

    def describe(validator):  # noqa: C901 - a walker is naturally branchy
        """Describe one value validator as a JSON-able dict."""
        if isinstance(validator, vol.Schema):
            return describe(validator.schema) | _extra_flag(validator)
        if isinstance(validator, vol.All):
            merged: dict = {}
            for part in validator.validators:
                for key, value in describe(part).items():
                    if key in merged and merged[key] != value:
                        merged.setdefault("conflicts", []).append({key: value})
                    else:
                        merged[key] = value
            return merged or {"opaque": _safe_repr(validator)}
        if isinstance(validator, vol.Any):
            variants = [describe(part) for part in validator.validators]
            if any(v == {"type": "null"} for v in variants):
                rest = [v for v in variants if v != {"type": "null"}]
                if len(rest) == 1:
                    return rest[0] | {"nullable": True}
            return {"variants": variants}
        if isinstance(validator, vol.In):
            return {"enum": sorted(validator.container, key=str)}
        if isinstance(validator, vol.Range):
            out = {}
            if validator.min is not None:
                out["min"] = validator.min
            if validator.max is not None:
                out["max"] = validator.max
            return out
        if isinstance(validator, vol.Length):
            out = {}
            if validator.min is not None:
                out["minLength"] = validator.min
            if validator.max is not None:
                out["maxLength"] = validator.max
            return out
        if isinstance(validator, vol.Equal):
            return {"const": validator.target}
        if isinstance(validator, vol.Coerce):
            return {"type": getattr(validator.type, "__name__", _safe_repr(validator.type))}
        if validator is None or validator is type(None):
            return {"type": "null"}
        if validator is bool:
            return {"type": "bool"}
        if validator is int:
            return {"type": "int"}
        if validator is float:
            return {"type": "float"}
        if validator is str:
            return {"type": "str"}
        if validator is dict or validator is object:
            return {"type": "object"}
        if isinstance(validator, dict):
            return {"object": True}
        if isinstance(validator, (list, tuple)):
            items = [describe(part) for part in validator]
            return {"list": items[0] if len(items) == 1 else items}
        if isinstance(validator, (str, int, float, bool)):
            return {"const": validator}
        if isinstance(validator, type):
            return {"type": validator.__name__}
        return {"opaque": _safe_repr(validator)}

    def _extra_flag(schema):
        if getattr(schema, "extra", None) == vol.ALLOW_EXTRA:
            return {"allowExtra": True}
        return {}

    leaves: dict[str, dict] = {}

    def _variant_tag(schema, index: int) -> str:
        """Discriminator for an Any-of-dicts variant: kind const/enum, else index."""
        inner = schema.schema if isinstance(schema, vol.Schema) else schema
        if isinstance(inner, dict):
            for key, value in inner.items():
                name = key.schema if isinstance(key, (vol.Optional, vol.Required)) else key
                if name == "kind":
                    if isinstance(value, str):
                        return value
                    if isinstance(value, vol.In):
                        return "|".join(sorted(value.container, key=str))
                    if isinstance(value, vol.Equal):
                        return str(value.target)
        return f"var{index}"

    def _is_struct(candidate) -> bool:
        return isinstance(candidate, (vol.Schema, dict)) and isinstance(
            candidate.schema if isinstance(candidate, vol.Schema) else candidate, dict)

    def walk(node, path: str):
        if isinstance(node, vol.Any):
            non_null = [p for p in node.validators if p is not None and p is not type(None)]
            nullable = len(non_null) != len(node.validators)
            if non_null and all(_is_struct(p) for p in non_null):
                if nullable:
                    leaves.setdefault(path or "<root>", {})["nullable"] = True
                if len(non_null) == 1:
                    walk(non_null[0], path)
                    return
                for index, variant in enumerate(non_null):
                    walk(variant, f"{path}<{_variant_tag(variant, index)}>")
                return
            leaves[path or "<root>"] = describe(node)
            return
        if isinstance(node, vol.Schema):
            entry_extra = _extra_flag(node)
            if entry_extra and path:
                leaves.setdefault(path or "<root>", {}).update(entry_extra)
            walk(node.schema, path)
            return
        if isinstance(node, vol.All):
            # A dict wrapped in vol.All carries semantic validators after the
            # structural schema; walk the structural part only.
            structural = [p for p in node.validators
                          if isinstance(p, (vol.Schema, dict, list, tuple))]
            if structural:
                for part in structural:
                    walk(part, path)
                return
            leaves[path] = describe(node)
            return
        if isinstance(node, dict):
            for key, value in node.items():
                marker = key
                info: dict = {}
                if isinstance(key, vol.Remove):
                    inner = key.schema
                    name = inner if isinstance(inner, str) else _safe_repr(inner)
                    leaves[f"{path}.{name}".lstrip(".")] = {"removed": True}
                    continue
                if isinstance(key, (vol.Optional, vol.Required)):
                    info["required"] = isinstance(key, vol.Required)
                    default = getattr(key, "default", vol.UNDEFINED)
                    if default is not vol.UNDEFINED:
                        info["default"] = _render_default(default)
                    marker = key.schema
                if isinstance(marker, str):
                    child = f"{path}.{marker}".lstrip(".")
                elif marker is str:
                    child = f"{path}.*".lstrip(".")
                else:
                    child = f"{path}.<{getattr(marker, '__name__', _safe_repr(marker))}>".lstrip(".")
                if isinstance(value, (vol.Schema, dict)):
                    if info:
                        leaves.setdefault(child, {}).update(info)
                    walk(value, child)
                elif isinstance(value, (list, tuple)) and len(value) == 1 \
                        and isinstance(value[0], (vol.Schema, dict, vol.All)):
                    if info:
                        leaves.setdefault(f"{child}[]", {}).update(info)
                    walk(value[0], f"{child}[]")
                elif isinstance(value, vol.All) and any(
                        isinstance(p, (vol.Schema, dict, list, tuple))
                        for p in value.validators):
                    if info:
                        leaves.setdefault(child, {}).update(info)
                    walk(value, child)
                elif isinstance(value, vol.Any) and value.validators and all(
                        _is_struct(p) or p is None or p is type(None)
                        for p in value.validators) and any(
                        _is_struct(p) for p in value.validators):
                    if info:
                        leaves.setdefault(child, {}).update(info)
                    walk(value, child)
                elif isinstance(value, (list, tuple)) and len(value) == 1 \
                        and isinstance(value[0], vol.Any):
                    if info:
                        leaves.setdefault(f"{child}[]", {}).update(info)
                    walk(value[0], f"{child}[]")
                else:
                    leaves[child] = info | describe(value)
            return
        if isinstance(node, (list, tuple)) and len(node) == 1:
            walk(node[0], f"{path}[]")
            return
        leaves[path or "<root>"] = describe(node)

    walk(validation.CONFIG_SCHEMA, "config")
    walk(validation.LAYOUT_SCHEMA, "layout")

    return {
        "_comment": "#33: generated by scripts/dump-config-schema.py — do not edit by hand",
        "fields": {path: dict(sorted(entry.items())) for path, entry in sorted(leaves.items())},
    }


def main() -> int:
    manifest = build_manifest()
    rendered = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if "--check" in sys.argv:
        current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if current != rendered:
            sys.stderr.write(
                "config-schema.json is stale: run python3 scripts/dump-config-schema.py\n")
            return 1
        print(f"manifest fresh: {len(manifest['fields'])} paths")
        return 0
    OUT.write_text(rendered, encoding="utf-8")
    print(f"manifest written: {len(manifest['fields'])} paths")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
