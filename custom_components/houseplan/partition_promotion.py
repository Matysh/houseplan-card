"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import partition_promotion as _core
from .core.partition_promotion import (
    _EPS as _EPS,
)
from .core.partition_promotion import (
    _INCIDENT_EPS as _INCIDENT_EPS,
)
from .core.partition_promotion import (
    _WALL_KEYS as _WALL_KEYS,
)
from .core.partition_promotion import (
    _angle_equal as _angle_equal,
)
from .core.partition_promotion import (
    _geometry as _geometry,
)
from .core.partition_promotion import (
    _point_equal as _point_equal,
)
from .core.partition_promotion import (
    _same_json_fields as _same_json_fields,
)
from .core.partition_promotion import (
    _stored_wall_contact as _stored_wall_contact,
)
from .core.partition_promotion import (
    canonicalize_lattice_coordinate as canonicalize_lattice_coordinate,
)
from .core.partition_promotion import (
    math as math,
)
from .core.partition_promotion import (
    same_partition_wall_chain_promotion as same_partition_wall_chain_promotion,
)
from .core.partition_promotion import (
    same_partition_wall_promotion as same_partition_wall_promotion,
)

sys.modules[__name__] = _core
