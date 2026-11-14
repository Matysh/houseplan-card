"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import opening_orientation as _core
from .core.opening_orientation import (
    _inside as _inside,
)
from .core.opening_orientation import (
    math as math,
)
from .core.opening_orientation import (
    opening_axis_rotation as opening_axis_rotation,
)
from .core.opening_orientation import (
    opening_face_normal as opening_face_normal,
)
from .core.opening_orientation import (
    reparameterize_opening_features as reparameterize_opening_features,
)
from .core.opening_orientation import (
    transport_opening_orientations as transport_opening_orientations,
)

sys.modules[__name__] = _core
