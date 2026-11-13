"""Compatibility exports for the canonical plan core; no copied algorithms."""
from __future__ import annotations

from typing import Any

from .const import DOMAIN
from .core.asset_integrity import (
    _LOGGER as _LOGGER,
)
from .core.asset_integrity import (
    ASSET_HASH_CHUNK_BYTES as ASSET_HASH_CHUNK_BYTES,
)
from .core.asset_integrity import (
    ASSET_INTEGRITY_CACHE_ENTRIES as ASSET_INTEGRITY_CACHE_ENTRIES,
)
from .core.asset_integrity import (
    ASSET_INTEGRITY_FOLLOWER_TIMEOUT_SECONDS as ASSET_INTEGRITY_FOLLOWER_TIMEOUT_SECONDS,
)
from .core.asset_integrity import (
    AssetIntegrityVerifier as AssetIntegrityVerifier,
)
from .core.asset_integrity import (
    Callable as Callable,
)
from .core.asset_integrity import (
    FileSignature as FileSignature,
)
from .core.asset_integrity import (
    OrderedDict as OrderedDict,
)
from .core.asset_integrity import (
    Path as Path,
)
from .core.asset_integrity import (
    _CacheEntry as _CacheEntry,
)
from .core.asset_integrity import (
    _Flight as _Flight,
)
from .core.asset_integrity import (
    _signature as _signature,
)
from .core.asset_integrity import (
    _stream_sha256 as _stream_sha256,
)
from .core.asset_integrity import (
    dataclass as dataclass,
)
from .core.asset_integrity import (
    hashlib as hashlib,
)
from .core.asset_integrity import (
    logging as logging,
)
from .core.asset_integrity import (
    stat as stat,
)
from .core.asset_integrity import (
    threading as threading,
)

_HASS_DATA_KEY = "asset_integrity_verifier"


def get_asset_integrity_verifier(hass: Any) -> AssetIntegrityVerifier:
    """Return the single verifier shared by HTTP and WS on this HA instance."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    verifier = domain_data.get(_HASS_DATA_KEY)
    if not isinstance(verifier, AssetIntegrityVerifier):
        verifier = AssetIntegrityVerifier()
        domain_data[_HASS_DATA_KEY] = verifier
    return verifier
