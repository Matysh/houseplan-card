"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import radar_geometry as _core
from .core.radar_geometry import (
    MAX_LOCAL_CM as MAX_LOCAL_CM,
)
from .core.radar_geometry import (
    UNIT_TO_CM as UNIT_TO_CM,
)
from .core.radar_geometry import (
    Any as Any,
)
from .core.radar_geometry import (
    Iterable as Iterable,
)
from .core.radar_geometry import (
    RadarFit as RadarFit,
)
from .core.radar_geometry import (
    clipped_arc_segments as clipped_arc_segments,
)
from .core.radar_geometry import (
    dataclass as dataclass,
)
from .core.radar_geometry import (
    inverse_project as inverse_project,
)
from .core.radar_geometry import (
    length_cm as length_cm,
)
from .core.radar_geometry import (
    math as math,
)
from .core.radar_geometry import (
    point_in_polygon as point_in_polygon,
)
from .core.radar_geometry import (
    polar_to_cartesian as polar_to_cartesian,
)
from .core.radar_geometry import (
    polygon_is_convex as polygon_is_convex,
)
from .core.radar_geometry import (
    project_local as project_local,
)
from .core.radar_geometry import (
    solve_two_point as solve_two_point,
)

sys.modules[__name__] = _core
