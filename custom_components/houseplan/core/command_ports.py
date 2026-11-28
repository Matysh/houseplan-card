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

from .content_index import ContentIndex, ContentRef
from .input_policy import InputPolicy
from .plans import ContentRetirement
from .structural_upload import StructuralUploads

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


class ContentAccess(Protocol):
    def stage_plan(self, space_id: str, extension: str, raw: bytes) -> AsyncContextManager[Any]: ...

    def stage_asset(self, validated: Any, filename: str) -> AsyncContextManager[Any]: ...

    async def publish_upload(self, stage: Any) -> Json:
        """Atomic publication; cancellation must settle before releasing the transaction."""
        ...

    async def plan_catalog(self) -> list[Json]: ...

    async def delete_plan(self, name: str) -> bool: ...

    async def asset_catalog(self) -> list[Json]: ...

    async def resolve_assets(self, asset_ids: set[str]) -> list[Json]: ...

    async def delete_asset(self, asset_id: str) -> bool: ...


class PlanContent(ContentAccess, Protocol):
    def transaction(self) -> AsyncContextManager[ContentAccess]: ...

    async def existing_plans(self, names: set[str]) -> set[str]: ...

    async def existing_content(self, references: set[ContentRef]) -> set[ContentRef]: ...

    async def retire(self, intent: ContentRetirement) -> None:
        """Apply explicit post-commit retirements; never infer from config or age plans."""
        ...

    async def inspect(self, config: Json) -> ContentIndex:
        """Snapshot only referenced metadata/integrity; no HA pathname required."""
        ...


class CommandEvidence(Protocol):
    def readable_entity_ids(self, selected: set[str] | None) -> set[str]: ...

    def radar_registry(self) -> Any: ...

    def import_registry_snapshot(self) -> dict[str, set[str]] | None: ...

    async def configuration_extras(self, config: Json, rev: int) -> Json:
        """Host-only observations, not config mutation or validation callbacks."""
        ...


class ImportLeases(Protocol):
    async def load(self, scope: str, token: str) -> Json | None: ...

    async def publish(self, scope: str, token: str, candidate: Json) -> None:
        """Atomically retain bounded per-owner/total previews with oldest-first eviction."""
        ...

    async def update(self, scope: str, token: str, expected_digest: str, candidate: Json) -> bool:
        """Conditional update; never resurrect an evicted/expired/replaced lease."""
        ...

    async def consume(self, scope: str, token: str) -> None:
        """Idempotent post-commit release; expiry is not a reason to fail."""
        ...


class StructuralStaging(Protocol):
    def transaction(self, scope: str) -> AsyncContextManager[StructuralUploads]:
        """Load/lock/persist canonical bounded lease records for exactly one scope.

        External hosts use their actual shared repository lock/transaction, not
        one process-local lock. Run the kernel only inside this transaction;
        immutable snapshots alone may cross executor/transport awaits.
        """
        ...


class HouseResources(Protocol):
    """Separate bounded house pool; never installation-backup/cache authority.

    Tokens are owner+scope-bound, cancel/expiry settle workers before cleanup,
    and a durable pair intent pins its recovery bytes until complete/rollback.
    The file descriptor is host-private, data-only and paired with the stores.
    A database host can supply transactional blobs instead of filesystem paths.
    """

    def transaction(self) -> AsyncContextManager[Any]: ...

    async def begin(self, scope: str, owner: str, operation: str, kind: str) -> Json: ...

    async def upload(self, lease: Json, blocks: Any, declared_size: int | None, policy: InputPolicy) -> None: ...

    async def read(self, lease: Json) -> Any: ...

    async def build(self, lease: Json, document: Json) -> Json: ...

    async def prepare(self, lease: Json, payload: Any, protected_plans: set[str]) -> tuple[Json, Json]: ...

    async def publish(self, lease: Json, token: str, record: Json) -> None: ...

    async def load(self, scope: str, owner: str, token: str) -> Json: ...

    async def update(self, lease: Json, record: Json) -> None: ...

    async def pin(self, lease: Json) -> None: ...

    async def complete(self, lease: Json) -> None: ...

    async def cancel(self, scope: str, owner: str, token: str | None, operation: str | None) -> None: ...

    async def recover(self, descriptor: Json, action: str) -> None: ...

    def stream(self, lease: Json) -> AsyncContextManager[Any]: ...


@dataclass(frozen=True, slots=True)
class CommandEnvironment:
    content: PlanContent
    evidence: CommandEvidence
    policy: CommandPolicy
    identity: HostIdentity
    input_policy: InputPolicy | None = None
    leases: ImportLeases | None = None
    staging: StructuralStaging | None = None
    house: HouseResources | None = None


@dataclass(frozen=True, slots=True)
class HostIdentity:
    instance_id: str
    integration_version: str
    frontend_fingerprint: str | None
    build: dict[str, str] | None = None


class CommandSession(Protocol):
    storage: PlanStorage
    cpu: CpuExecutor
    authority: WriteAuthority
    effects: CommandEffects
    environment: CommandEnvironment | None

    async def load(self, transaction: PlanTransaction, *, prepare: bool = True) -> PlanPair: ...

    def input_policy(self) -> InputPolicy: ...

    def before_commit(self) -> None: ...
