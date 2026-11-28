"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import wall_node_merge as _core
from .core.wall_node_merge import (
    GraphError as GraphError,
)
from .core.wall_node_merge import (
    NodeMoveError as NodeMoveError,
)
from .core.wall_node_merge import (
    SimpleNamespace as SimpleNamespace,
)
from .core.wall_node_merge import (
    _classify as _classify,
)
from .core.wall_node_merge import (
    _contacts as _contacts,
)
from .core.wall_node_merge import (
    _dot as _dot,
)
from .core.wall_node_merge import (
    _fail as _fail,
)
from .core.wall_node_merge import (
    _index as _index,
)
from .core.wall_node_merge import (
    _length as _length,
)
from .core.wall_node_merge import (
    _on as _on,
)
from .core.wall_node_merge import (
    _point as _point,
)
from .core.wall_node_merge import (
    _ref as _ref,
)
from .core.wall_node_merge import (
    _same as _same,
)
from .core.wall_node_merge import (
    _sub as _sub,
)
from .core.wall_node_merge import (
    _verify_contacts as _verify_contacts,
)
from .core.wall_node_merge import (
    _walls as _walls,
)
from .core.wall_node_merge import (
    canonicalize_number as canonicalize_number,
)
from .core.wall_node_merge import (
    copy as copy,
)
from .core.wall_node_merge import (
    cross as cross,
)
from .core.wall_node_merge import (
    decode_point as decode_point,
)
from .core.wall_node_merge import (
    decode_rational as decode_rational,
)
from .core.wall_node_merge import (
    edge_key as edge_key,
)
from .core.wall_node_merge import (
    encode_rational as encode_rational,
)
from .core.wall_node_merge import (
    intersection as intersection,
)
from .core.wall_node_merge import (
    math as math,
)
from .core.wall_node_merge import (
    merge_graph_node_space as merge_graph_node_space,
)
from .core.wall_node_merge import (
    opening_axis_rotation as opening_axis_rotation,
)
from .core.wall_node_merge import (
    parse_decimal as parse_decimal,
)
from .core.wall_node_merge import (
    point_at as point_at,
)
from .core.wall_node_merge import (
    project_graph_space as project_graph_space,
)
from .core.wall_node_merge import (
    project_parameter as project_parameter,
)
from .core.wall_node_merge import (
    squared_distance as squared_distance,
)
from .core.wall_node_merge import (
    to_numbers as to_numbers,
)
from .core.wall_node_merge import (
    transport_opening_orientations as transport_opening_orientations,
)
from .core.wall_node_merge import (
    validate_graph as validate_graph,
)

sys.modules[__name__] = _core
