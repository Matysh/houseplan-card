"""Compatibility alias; the portable route schema does not depend on HA."""
import sys

from .core import vacuum_routes as _core
from .core.vacuum_routes import (
    VAC_ROUTE_ERROR as VAC_ROUTE_ERROR,
)
from .core.vacuum_routes import (
    VAC_ROUTE_ID_MAX as VAC_ROUTE_ID_MAX,
)
from .core.vacuum_routes import (
    VAC_ROUTE_LIMIT as VAC_ROUTE_LIMIT,
)
from .core.vacuum_routes import (
    VAC_ROUTE_MAP_ID_MAX as VAC_ROUTE_MAP_ID_MAX,
)
from .core.vacuum_routes import (
    VAC_ROUTE_SOURCE_MAX as VAC_ROUTE_SOURCE_MAX,
)
from .core.vacuum_routes import (
    adopt_legacy_run as adopt_legacy_run,
)
from .core.vacuum_routes import (
    effective_routes as effective_routes,
)
from .core.vacuum_routes import (
    is_entity_id_like as is_entity_id_like,
)
from .core.vacuum_routes import (
    legacy_route_id as legacy_route_id,
)
from .core.vacuum_routes import (
    normalize_route_matrix as normalize_route_matrix,
)
from .core.vacuum_routes import (
    recording_route as recording_route,
)
from .core.vacuum_routes import (
    resolve_route as resolve_route,
)
from .core.vacuum_routes import (
    validate_marker_routes as validate_marker_routes,
)

sys.modules[__name__] = _core
