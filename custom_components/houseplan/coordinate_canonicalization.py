"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import coordinate_canonicalization as _core
from .core.coordinate_canonicalization import (
    COORDINATE_DECIMALS as COORDINATE_DECIMALS,
)
from .core.coordinate_canonicalization import (
    COORDINATE_FACTOR as COORDINATE_FACTOR,
)
from .core.coordinate_canonicalization import (
    DECOR_BOX_KINDS as DECOR_BOX_KINDS,
)
from .core.coordinate_canonicalization import (
    LATTICE_GRID_N as LATTICE_GRID_N,
)
from .core.coordinate_canonicalization import (
    LATTICE_NOISE_STEPS as LATTICE_NOISE_STEPS,
)
from .core.coordinate_canonicalization import (
    Any as Any,
)
from .core.coordinate_canonicalization import (
    _lattice_fields as _lattice_fields,
)
from .core.coordinate_canonicalization import (
    _lattice_point as _lattice_point,
)
from .core.coordinate_canonicalization import (
    _lattice_points as _lattice_points,
)
from .core.coordinate_canonicalization import (
    _record as _record,
)
from .core.coordinate_canonicalization import (
    _records as _records,
)
from .core.coordinate_canonicalization import (
    _scalar_fields as _scalar_fields,
)
from .core.coordinate_canonicalization import (
    _scalar_points as _scalar_points,
)
from .core.coordinate_canonicalization import (
    canonicalize_config_geometry as canonicalize_config_geometry,
)
from .core.coordinate_canonicalization import (
    canonicalize_lattice_coordinate as canonicalize_lattice_coordinate,
)
from .core.coordinate_canonicalization import (
    canonicalize_layout_geometry as canonicalize_layout_geometry,
)
from .core.coordinate_canonicalization import (
    canonicalize_number as canonicalize_number,
)
from .core.coordinate_canonicalization import (
    canonicalize_position as canonicalize_position,
)
from .core.coordinate_canonicalization import (
    copy as copy,
)
from .core.coordinate_canonicalization import (
    math as math,
)

sys.modules[__name__] = _core
