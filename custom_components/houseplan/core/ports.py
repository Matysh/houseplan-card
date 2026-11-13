"""Values consumed by portable operations; no HA storage, auth or event loop."""
from __future__ import annotations

from typing import Any as Any
from typing import Protocol as Protocol


class PortableRuntime(Protocol):
    """Per-owner portable context; the adapter retains lock/TTL/dispatch ownership."""

    instance_id: str
    import_previews: dict[str, dict[str, Any]]

    @property
    def integration_version(self) -> str:
        """Version supplied by the host, not imported from a HA adapter."""
        ...
