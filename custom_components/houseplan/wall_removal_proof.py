"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import wall_removal_proof as _core
from .core.wall_removal_proof import (
    GraphError as GraphError,
)
from .core.wall_removal_proof import (
    _metadata as _metadata,
)
from .core.wall_removal_proof import (
    _same_json as _same_json,
)
from .core.wall_removal_proof import (
    cross as cross,
)
from .core.wall_removal_proof import (
    decode_point as decode_point,
)
from .core.wall_removal_proof import (
    graph_only_removes_wall_material as graph_only_removes_wall_material,
)
from .core.wall_removal_proof import (
    project_parameter as project_parameter,
)

sys.modules[__name__] = _core
