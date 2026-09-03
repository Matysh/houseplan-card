"""Bounded, shared integrity verification for content-addressed decor assets."""
from __future__ import annotations

import hashlib
import logging
import stat
import threading
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

ASSET_INTEGRITY_CACHE_ENTRIES = 256
ASSET_HASH_CHUNK_BYTES = 64 * 1024
ASSET_INTEGRITY_FOLLOWER_TIMEOUT_SECONDS = 30.0
_HASS_DATA_KEY = "asset_integrity_verifier"


@dataclass(frozen=True)
class FileSignature:
    """File version facts available without reading its content."""

    size: int
    mtime_ns: int
    ctime_ns: int


@dataclass(frozen=True)
class _CacheEntry:
    signature: FileSignature
    digest: str


@dataclass
class _Flight:
    event: threading.Event
    digest: str | None = None


def _signature(path: Path) -> FileSignature:
    current = path.stat()
    if not stat.S_ISREG(current.st_mode):
        raise OSError("asset is not a regular file")
    return FileSignature(
        size=current.st_size,
        mtime_ns=current.st_mtime_ns,
        ctime_ns=current.st_ctime_ns,
    )


def _stream_sha256(path: Path) -> str:
    """Hash a blob without retaining its bytes in memory."""
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(ASSET_HASH_CHUNK_BYTES):
            digest.update(chunk)
    return digest.hexdigest()


class AssetIntegrityVerifier:
    """Thread-safe LRU digest cache with per-file-version single-flight."""

    def __init__(
        self,
        max_entries: int = ASSET_INTEGRITY_CACHE_ENTRIES,
        *,
        hasher: Callable[[Path], str] | None = None,
        event_factory: Callable[[], threading.Event] | None = None,
    ) -> None:
        if max_entries < 1:
            raise ValueError("max_entries must be positive")
        self._max_entries = max_entries
        self._hasher = hasher or _stream_sha256
        self._event_factory = event_factory or threading.Event
        self._lock = threading.Lock()
        self._cache: OrderedDict[str, _CacheEntry] = OrderedDict()
        self._inflight: dict[tuple[str, FileSignature], _Flight] = {}

    def verify(self, path: Path, expected_digest: str) -> bool:
        """Return whether one stable file version has the expected digest."""
        try:
            canonical = str(path.resolve())
        except (OSError, RuntimeError):
            return False
        try:
            before = _signature(path)
        except OSError:
            with self._lock:
                self._cache.pop(canonical, None)
            return False

        key = (canonical, before)
        with self._lock:
            cached = self._cache.get(canonical)
            if cached is not None and cached.signature == before:
                self._cache.move_to_end(canonical)
                return cached.digest == expected_digest
            if cached is not None:
                self._cache.pop(canonical, None)
            flight = self._inflight.get(key)
            owner = flight is None
            if owner:
                flight = _Flight(self._event_factory())
                self._inflight[key] = flight

        assert flight is not None
        if not owner:
            if not flight.event.wait(ASSET_INTEGRITY_FOLLOWER_TIMEOUT_SECONDS):
                return False
            return flight.digest == expected_digest

        digest: str | None = None
        stable = False
        try:
            digest = self._hasher(path)
            # Never publish a digest for bytes that changed while they were read.
            stable = _signature(path) == before
        except Exception as err:  # noqa: BLE001 - filesystem/hash seam fails dark
            _LOGGER.debug("House Plan asset integrity check failed: %s", err)
        finally:
            with self._lock:
                if stable and digest is not None:
                    self._cache[canonical] = _CacheEntry(before, digest)
                    self._cache.move_to_end(canonical)
                    while len(self._cache) > self._max_entries:
                        self._cache.popitem(last=False)
                    flight.digest = digest
                self._inflight.pop(key, None)
                flight.event.set()
        return stable and digest == expected_digest


def get_asset_integrity_verifier(hass: Any) -> AssetIntegrityVerifier:
    """Return the single verifier shared by HTTP and WS on this HA instance."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    verifier = domain_data.get(_HASS_DATA_KEY)
    if not isinstance(verifier, AssetIntegrityVerifier):
        verifier = AssetIntegrityVerifier()
        domain_data[_HASS_DATA_KEY] = verifier
    return verifier
