"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import portable_recovery as _core
from .core.portable_recovery import (
    RECOVERY_EXAMPLES as RECOVERY_EXAMPLES,
)
from .core.portable_recovery import (
    RECOVERY_VERSION as RECOVERY_VERSION,
)
from .core.portable_recovery import (
    Any as Any,
)
from .core.portable_recovery import (
    _ControlGraph as _ControlGraph,
)
from .core.portable_recovery import (
    _Report as _Report,
)
from .core.portable_recovery import (
    math as math,
)
from .core.portable_recovery import (
    prepare_portable_markers as prepare_portable_markers,
)
from .core.portable_recovery import (
    radar_spatial_problem as radar_spatial_problem,
)
from .core.portable_recovery import (
    recover_portable_references as recover_portable_references,
)
from .core.portable_recovery import (
    validate_active_marker_ids as validate_active_marker_ids,
)
from .core.portable_recovery import (
    validate_marker_controls as validate_marker_controls,
)
from .core.portable_recovery import (
    validate_marker_light_entities as validate_marker_light_entities,
)
from .core.portable_recovery import (
    validate_marker_radars as validate_marker_radars,
)
from .core.portable_recovery import (
    validate_marker_vacuum_routes as validate_marker_vacuum_routes,
)
from .core.portable_recovery import (
    validate_marker_value_badges as validate_marker_value_badges,
)

sys.modules[__name__] = _core
