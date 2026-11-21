"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import plan_graph as _core
from .core.plan_graph import (
    _GRAPH_KEYS as _GRAPH_KEYS,
)
from .core.plan_graph import (
    GRAPH_VERSION as GRAPH_VERSION,
)
from .core.plan_graph import (
    MAX_EDGES as MAX_EDGES,
)
from .core.plan_graph import (
    MAX_NODES as MAX_NODES,
)
from .core.plan_graph import (
    MODEL_VERSION as MODEL_VERSION,
)
from .core.plan_graph import (
    Any as Any,
)
from .core.plan_graph import (
    ExactPoint as ExactPoint,
)
from .core.plan_graph import (
    Fraction as Fraction,
)
from .core.plan_graph import (
    GraphError as GraphError,
)
from .core.plan_graph import (
    GraphIndex as GraphIndex,
)
from .core.plan_graph import (
    _dependency_order as _dependency_order,
)
from .core.plan_graph import (
    _id as _id,
)
from .core.plan_graph import (
    _record as _record,
)
from .core.plan_graph import (
    _validate_graph as _validate_graph,
)
from .core.plan_graph import (
    apply_graph_patch as apply_graph_patch,
)
from .core.plan_graph import (
    copy as copy,
)
from .core.plan_graph import (
    cross as cross,
)
from .core.plan_graph import (
    dataclass as dataclass,
)
from .core.plan_graph import (
    decode_point as decode_point,
)
from .core.plan_graph import (
    decode_rational as decode_rational,
)
from .core.plan_graph import (
    edge_key as edge_key,
)
from .core.plan_graph import (
    encode_point as encode_point,
)
from .core.plan_graph import (
    intersection as intersection,
)
from .core.plan_graph import (
    math as math,
)
from .core.plan_graph import (
    parse_decimal as parse_decimal,
)
from .core.plan_graph import (
    point_at as point_at,
)
from .core.plan_graph import (
    project_graph_opening as project_graph_opening,
)
from .core.plan_graph import (
    project_graph_space as project_graph_space,
)
from .core.plan_graph import (
    propagate_dependencies as propagate_dependencies,
)
from .core.plan_graph import (
    to_numbers as to_numbers,
)
from .core.plan_graph import (
    validate_graph as validate_graph,
)
from .core.plan_graph import (
    verify_projection as verify_projection,
)

sys.modules[__name__] = _core
