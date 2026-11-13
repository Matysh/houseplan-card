"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import geometry_migration as _core
from .core.geometry_migration import (
    _LOGGER as _LOGGER,
)
from .core.geometry_migration import (
    Any as Any,
)
from .core.geometry_migration import (
    _pt as _pt,
)
from .core.geometry_migration import (
    logging as logging,
)
from .core.geometry_migration import (
    migrate_config as migrate_config,
)
from .core.geometry_migration import (
    migrate_layout as migrate_layout,
)
from .core.geometry_migration import (
    migrate_space as migrate_space,
)
from .core.geometry_migration import (
    pending_from_config as pending_from_config,
)
from .core.geometry_migration import (
    transform_for as transform_for,
)

sys.modules[__name__] = _core
