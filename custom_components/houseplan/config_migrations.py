"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import config_migrations as _core
from .core.config_migrations import (
    _GRID_PITCH as _GRID_PITCH,
)
from .core.config_migrations import (
    CONFIG_MIGRATION_BACKUP as CONFIG_MIGRATION_BACKUP,
)
from .core.config_migrations import (
    CONFIG_MIGRATION_PASSPORT as CONFIG_MIGRATION_PASSPORT,
)
from .core.config_migrations import (
    CONFIG_MIGRATION_VERSION as CONFIG_MIGRATION_VERSION,
)
from .core.config_migrations import (
    MAX_CONFIG_TEXT as MAX_CONFIG_TEXT,
)
from .core.config_migrations import (
    PLAN_MODEL_VERSION as PLAN_MODEL_VERSION,
)
from .core.config_migrations import (
    Any as Any,
)
from .core.config_migrations import (
    MigratedPair as MigratedPair,
)
from .core.config_migrations import (
    _needs_v1 as _needs_v1,
)
from .core.config_migrations import (
    _number as _number,
)
from .core.config_migrations import (
    _scalars_v1 as _scalars_v1,
)
from .core.config_migrations import (
    canonical_config as canonical_config,
)
from .core.config_migrations import (
    dataclass as dataclass,
)
from .core.config_migrations import (
    deepcopy as deepcopy,
)
from .core.config_migrations import (
    math as math,
)
from .core.config_migrations import (
    migrate_config as migrate_config,
)
from .core.config_migrations import (
    migrate_layout as migrate_layout,
)
from .core.config_migrations import (
    migrate_pair as migrate_pair,
)
from .core.config_migrations import (
    migration_version as migration_version,
)
from .core.config_migrations import (
    needs_canonical_config as needs_canonical_config,
)
from .core.config_migrations import (
    pending_from_config as pending_from_config,
)

sys.modules[__name__] = _core
