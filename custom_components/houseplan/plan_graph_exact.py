"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import plan_graph_exact as _core
from .core.plan_graph_exact import (
    _DECIMAL as _DECIMAL,
)
from .core.plan_graph_exact import (
    _INTEGER as _INTEGER,
)
from .core.plan_graph_exact import (
    CANVAS_LIMIT as CANVAS_LIMIT,
)
from .core.plan_graph_exact import (
    GRID_N as GRID_N,
)
from .core.plan_graph_exact import (
    LATTICE_NOISE_STEPS as LATTICE_NOISE_STEPS,
)
from .core.plan_graph_exact import (
    MAX_BITS as MAX_BITS,
)
from .core.plan_graph_exact import (
    Any as Any,
)
from .core.plan_graph_exact import (
    ExactPoint as ExactPoint,
)
from .core.plan_graph_exact import (
    Fraction as Fraction,
)
from .core.plan_graph_exact import (
    GraphError as GraphError,
)
from .core.plan_graph_exact import (
    check_point as check_point,
)
from .core.plan_graph_exact import (
    checked as checked,
)
from .core.plan_graph_exact import (
    cross as cross,
)
from .core.plan_graph_exact import (
    dataclass as dataclass,
)
from .core.plan_graph_exact import (
    decode_point as decode_point,
)
from .core.plan_graph_exact import (
    decode_rational as decode_rational,
)
from .core.plan_graph_exact import (
    encode_point as encode_point,
)
from .core.plan_graph_exact import (
    encode_rational as encode_rational,
)
from .core.plan_graph_exact import (
    integer as integer,
)
from .core.plan_graph_exact import (
    intersection as intersection,
)
from .core.plan_graph_exact import (
    math as math,
)
from .core.plan_graph_exact import (
    normalization_radius as normalization_radius,
)
from .core.plan_graph_exact import (
    parse_decimal as parse_decimal,
)
from .core.plan_graph_exact import (
    point_at as point_at,
)
from .core.plan_graph_exact import (
    project_parameter as project_parameter,
)
from .core.plan_graph_exact import (
    re as re,
)
from .core.plan_graph_exact import (
    read_authored_point as read_authored_point,
)
from .core.plan_graph_exact import (
    read_source_point as read_source_point,
)
from .core.plan_graph_exact import (
    squared_distance as squared_distance,
)
from .core.plan_graph_exact import (
    to_numbers as to_numbers,
)

sys.modules[__name__] = _core
