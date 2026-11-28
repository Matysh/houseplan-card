"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import graph_host_continuity as _core
from .core.graph_host_continuity import (
    GraphHostContinuity as GraphHostContinuity,
)
from .core.graph_host_continuity import (
    cross as cross,
)
from .core.graph_host_continuity import (
    decode_rational as decode_rational,
)
from .core.graph_host_continuity import (
    edge_key as edge_key,
)
from .core.graph_host_continuity import (
    json as json,
)
from .core.graph_host_continuity import (
    math as math,
)
from .core.graph_host_continuity import (
    point_at as point_at,
)
from .core.graph_host_continuity import (
    project_parameter as project_parameter,
)
from .core.graph_host_continuity import (
    squared_distance as squared_distance,
)
from .core.graph_host_continuity import (
    validate_graph as validate_graph,
)

sys.modules[__name__] = _core
