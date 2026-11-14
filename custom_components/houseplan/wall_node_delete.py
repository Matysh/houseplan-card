"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import wall_node_delete as _core
from .core.wall_node_delete import (
    EPS as EPS,
)
from .core.wall_node_delete import (
    WALL_SEGMENT_MODEL_VERSION as WALL_SEGMENT_MODEL_VERSION,
)
from .core.wall_node_delete import (
    Any as Any,
)
from .core.wall_node_delete import (
    NodeDeleteError as NodeDeleteError,
)
from .core.wall_node_delete import (
    PreparedNodeDelete as PreparedNodeDelete,
)
from .core.wall_node_delete import (
    _area as _area,
)
from .core.wall_node_delete import (
    _bounded as _bounded,
)
from .core.wall_node_delete import (
    _contacts as _contacts,
)
from .core.wall_node_delete import (
    _current_basis as _current_basis,
)
from .core.wall_node_delete import (
    _deletion as _deletion,
)
from .core.wall_node_delete import (
    _edges as _edges,
)
from .core.wall_node_delete import (
    _equal as _equal,
)
from .core.wall_node_delete import (
    _host_baseline as _host_baseline,
)
from .core.wall_node_delete import (
    _inside as _inside,
)
from .core.wall_node_delete import (
    _materialize_space as _materialize_space,
)
from .core.wall_node_delete import (
    _overlap as _overlap,
)
from .core.wall_node_delete import (
    _replace_space as _replace_space,
)
from .core.wall_node_delete import (
    _rooms_overlap as _rooms_overlap,
)
from .core.wall_node_delete import (
    _simple as _simple,
)
from .core.wall_node_delete import (
    _wall_key as _wall_key,
)
from .core.wall_node_delete import (
    canonicalize_config_geometry as canonicalize_config_geometry,
)
from .core.wall_node_delete import (
    commit_wall_segment_model as commit_wall_segment_model,
)
from .core.wall_node_delete import (
    copy as copy,
)
from .core.wall_node_delete import (
    dataclass as dataclass,
)
from .core.wall_node_delete import (
    delete_node_space as delete_node_space,
)
from .core.wall_node_delete import (
    graph as graph,
)
from .core.wall_node_delete import (
    math as math,
)
from .core.wall_node_delete import (
    node_delete_candidate as node_delete_candidate,
)
from .core.wall_node_delete import (
    node_delete_host_baseline as node_delete_host_baseline,
)
from .core.wall_node_delete import (
    prepare_node_delete as prepare_node_delete,
)
from .core.wall_node_delete import (
    transport_opening_orientations as transport_opening_orientations,
)

sys.modules[__name__] = _core
