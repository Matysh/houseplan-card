"""Host contracts for plan commands, not an HTTP server or a storage engine.

The transaction owner must serialize writers (or atomically repeat CAS at
commit). The reference in-memory implementation is deliberately single-process.
HA's adapter retains its durable journal and migration/source-backup fence.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from typing import Any, AsyncContextManager, Protocol, TypeVar

from .input_policy import InputPolicy

Json = dict[str, Any]
T = TypeVar("T")


class CommandPolicy(Enum):
    HA = "ha"
    PLAN_ONLY = "plan_only"


class CommandError(ValueError):
    """A stable public protocol error; never reflect an arbitrary exception."""

    def __init__(self, code: str, message: str | None = None) -> None:
        self.code = code
        self.public_message = message or code
        super().__init__(self.public_message)


class PairCommitFailure(Exception):
    """Storage restored the old pair or retained a recoverable rollback intent."""

    def __init__(self, *, recovery_pending: bool) -> None:
        super().__init__("paired store commit failed")
        self.recovery_pending = recovery_pending


@dataclass(frozen=True, slots=True)
class PlanPair:
    config_data: Json
    layout_data: Json
    recovered_kind: str | None = None


@dataclass(slots=True)
class CommandCache:
    """Optimization only: never a substitute for storage identity/CAS."""

    junction_baseline: tuple[int, Json] | None = None
    schema_clean_rev: int | None = None


class PlanTransaction(Protocol):
    cache: CommandCache

    async def load(self) -> PlanPair:
        """Finish recovery before exposing the authoritative revisions."""
        ...

    async def save_config(self, config: Json, rev: int, *, previous: Json,
                          canonical: bool, authorize: Callable[[], None]) -> None:
        """Conditional durable write with migration fence, including paired migration."""
        ...

    async def save_layout(self, previous: Json, layout: Json, rev: int, *,
                          metadata: Json | None = None, remove: tuple[str, ...] = (),
                          authorize: Callable[[], None]) -> None:
        ...

    async def commit_pair(self, target: Json, rollback: Json, *,
                          authorize: Callable[[], None]) -> None:
        """Atomically compare revisions and commit, or raise conflict/PairCommitFailure."""
        ...


class PlanStorage(Protocol):
    def transaction(self) -> AsyncContextManager[PlanTransaction]: ...


class CpuExecutor(Protocol):
    async def run(self, function: Callable[..., T], *args: Any) -> T:
        """Execute without blocking the host loop; explicitly propagate contextvars."""
        ...


class WriteAuthority(Protocol):
    owner_id: str
    scope_id: str
    can_write: bool
    archive_admin: bool

    def ensure(self) -> None:
        """Recheck the actual principal, scope and current permissions."""
        ...


class CommandEffects(Protocol):
    def emit(self, name: str, data: Json) -> None: ...

    def missing_revision(self, command: str, current_rev: int) -> None: ...

    async def release_snapshot(self, previous: Json, config: Json, metadata: Json) -> None:
        """Release physical HA history pins only after their replacement is durable."""
        ...

    async def purge_trails(self, config: Json) -> None: ...

    async def forget_deleted_markers(self, config: Json, marker_ids: list[str]) -> None: ...

    def refresh_trails(self) -> None: ...

    def schedule_repairs(self) -> None: ...

    def pinned_attachment_refs(self) -> set[str]: ...


class PlanContent(Protocol):
    async def existing_plans(self, names: set[str]) -> set[str]: ...

    async def collect(self, previous: Json | None, config: Json, pinned: set[str]) -> None: ...


class CommandEvidence(Protocol):
    def readable_entity_ids(self, selected: set[str] | None) -> set[str]: ...

    def radar_registry(self) -> Any: ...

    async def configuration_extras(self, config: Json, rev: int) -> Json:
        """Host-only observations, not config mutation or validation callbacks."""
        ...


@dataclass(frozen=True, slots=True)
class CommandEnvironment:
    content: PlanContent
    evidence: CommandEvidence
    policy: CommandPolicy
    identity: HostIdentity
    input_policy: InputPolicy | None = None


@dataclass(frozen=True, slots=True)
class HostIdentity:
    instance_id: str
    integration_version: str
    frontend_fingerprint: str | None
    build: dict[str, str] | None = None
