"""Canonical pure imports after #1391, without replacing the parent namespace.

Integration modules are normal imports of the real lazy package. A requested
test alias may be scoped, but core classes/functions are never loaded twice.
Only standalone non-package fixtures retain a scoped file-loader fallback.
"""
from __future__ import annotations

import importlib
import importlib.util
import sys
from contextlib import contextmanager
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PACKAGE_ROOT = REPO / "custom_components"
HOUSEPLAN_ROOT = PACKAGE_ROOT / "houseplan"
_MISSING = object()


@contextmanager
def pure_module(name: str, file: Path):
    """Reuse the canonical owner; scope only a caller's noncanonical alias."""
    file = file.resolve()
    try:
        relative = file.relative_to(HOUSEPLAN_ROOT)
    except ValueError:
        relative = None
    if relative is not None:
        parts = list(relative.with_suffix("").parts)
        if parts[-1] == "__init__":
            parts.pop()
        canonical = ".".join(["custom_components", "houseplan", *parts])
        module = importlib.import_module(canonical)
        if name == canonical:
            yield module
            return
    else:
        spec = importlib.util.spec_from_file_location(name, file)
        if spec is None or spec.loader is None:
            raise ImportError(f"cannot create import spec for {name} from {file}")
        module = importlib.util.module_from_spec(spec)

    # Never shadow an actual canonical package/module with a test alias.
    if name == "custom_components" or name == "custom_components.houseplan":
        raise ImportError("A pure alias cannot replace the integration package")
    previous = sys.modules.get(name, _MISSING)
    try:
        sys.modules[name] = module
        if relative is None:
            spec.loader.exec_module(module)
        yield module
    finally:
        if previous is _MISSING:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = previous


def load_pure(name: str, file: Path):
    """Return the single canonical implementation, preserving the helper API."""
    with pure_module(name, file) as module:
        return module
