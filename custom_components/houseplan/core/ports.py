"""Values consumed by portable operations; no HA storage, auth or event loop."""
from __future__ import annotations

from typing import Any as Any
from typing import Protocol as Protocol


class PortableIdentity(Protocol):
    """Identity used by pure export/preview preparation, without mutable leases."""
    instance_id: str

    @property
    def integration_version(self) -> str:
        """Version supplied by the host, not imported from a HA adapter."""
        ...


class PortableRuntime(PortableIdentity, Protocol):
    """Compatibility cache context; command adapters serialize its publication."""

    import_previews: dict[str, dict[str, Any]]
