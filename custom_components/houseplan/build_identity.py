"""Build identity of the installed integration (#836).

Two consecutive dev builds carry the same version number, so the version alone
cannot tell which frontend a browser runs.  The identity of a build is the
fingerprint of its frontend (``frontend/houseplan-assets.json``) plus, on the
owner's dev installation only, the label written by ``scripts/dev-build.mjs``
(``BUILD.json`` next to ``manifest.json``).

Both files are read once per config-entry setup in the executor.  A missing,
unreadable or malformed file means "unknown" and the integration behaves as a
release: nothing here may raise into setup.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .const import VERSION

_LOGGER = logging.getLogger(__name__)

INTEGRATION_ROOT = Path(__file__).resolve().parent
BUILD_LABEL_FILE = "BUILD.json"
ASSET_MANIFEST_FILE = Path("frontend") / "houseplan-assets.json"
BUILD_LABEL_SCHEMA = 1
BUILD_CHANNEL_DEV = "dev"

# Both files are a few hundred bytes; anything far larger is not ours.
_MAX_FILE_BYTES = 256 * 1024
_SOURCE = re.compile(r"[0-9a-f]{40}")
_FINGERPRINT = re.compile(r"[0-9a-f]{64}")


@dataclass(frozen=True, slots=True)
class BuildIdentity:
    """What the installed integration knows about its own build."""

    fingerprint: str | None = None
    source: str | None = None

    @property
    def build(self) -> dict[str, str] | None:
        """The dev label as exposed by config/get, export and support package."""
        if self.source is None:
            return None
        return {"channel": BUILD_CHANNEL_DEV, "source": self.source}


UNKNOWN_BUILD = BuildIdentity()


def _read_json(path: Path) -> Any:
    try:
        if path.stat().st_size > _MAX_FILE_BYTES:
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, RecursionError):
        return None


def parse_build_label(value: Any) -> str | None:
    """Return the full source SHA of a valid dev label, otherwise None."""
    if not isinstance(value, dict):
        return None
    schema = value.get("schema")
    if type(schema) is not int or schema != BUILD_LABEL_SCHEMA:
        return None
    if value.get("channel") != BUILD_CHANNEL_DEV:
        return None
    source = value.get("source")
    if not isinstance(source, str) or not _SOURCE.fullmatch(source):
        return None
    return source


def parse_frontend_fingerprint(value: Any) -> str | None:
    """Return the 64-hex fingerprint of a schema-1 asset manifest, otherwise None."""
    if not isinstance(value, dict):
        return None
    schema = value.get("schema")
    if type(schema) is not int or schema != 1:
        return None
    fingerprint = value.get("fingerprint")
    if not isinstance(fingerprint, str) or not _FINGERPRINT.fullmatch(fingerprint):
        return None
    return fingerprint


def read_build_identity(root: Path | None = None) -> BuildIdentity:
    """Read the label and the frontend fingerprint; blocking, run in the executor."""
    base = INTEGRATION_ROOT if root is None else root
    try:
        return BuildIdentity(
            fingerprint=parse_frontend_fingerprint(_read_json(base / ASSET_MANIFEST_FILE)),
            source=parse_build_label(_read_json(base / BUILD_LABEL_FILE)),
        )
    except Exception:  # noqa: BLE001 - an unknown build behaves as a release
        _LOGGER.debug("House Plan: reading the build identity failed", exc_info=True)
        return UNKNOWN_BUILD


def frontend_module_url(base_url: str, identity: BuildIdentity | None) -> str:
    """Module URL that changes with every build of the same version (#836 К3).

    Without a fingerprint and a label it is exactly ``?v=<VERSION>``, as
    before.  The fingerprint prefix makes a redeploy of the same version a new
    URL, so a browser cannot keep running the previous JavaScript; the full
    dev SHA lets the card name the build it was loaded as.
    """
    query = f"v={VERSION}"
    if identity is not None and identity.fingerprint is not None:
        query += f"&b={identity.fingerprint[:8]}"
    if identity is not None and identity.source is not None:
        query += f"&dev={identity.source}"
    return f"{base_url}?{query}"
