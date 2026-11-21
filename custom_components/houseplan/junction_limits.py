"""Compatibility exports for the canonical plan core; no copied algorithms."""
from .core import junction_limits as _core
from .core.junction_limits import (
    _EPS as _EPS,
)
from .core.junction_limits import (
    _INCIDENT_EPS as _INCIDENT_EPS,
)
from .core.junction_limits import (
    _KEY_FACTOR as _KEY_FACTOR,
)
from .core.junction_limits import (
    _LOGGER as _LOGGER,
)
from .core.junction_limits import (
    COORDINATE_FACTOR as COORDINATE_FACTOR,
)
from .core.junction_limits import (
    GRID_STEP_N as GRID_STEP_N,
)
from .core.junction_limits import (
    LATTICE_GRID_N as LATTICE_GRID_N,
)
from .core.junction_limits import (
    MAX_JUNCTION_VALENCE as MAX_JUNCTION_VALENCE,
)
from .core.junction_limits import (
    MIN_JUNCTION_ANGLE_DEG as MIN_JUNCTION_ANGLE_DEG,
)
from .core.junction_limits import (
    MIN_NODE_DISTANCE_CM as MIN_NODE_DISTANCE_CM,
)
from .core.junction_limits import (
    MIN_SEGMENT_LENGTH_CM as MIN_SEGMENT_LENGTH_CM,
)
from .core.junction_limits import (
    WALL_SEGMENT_MODEL_VERSION as WALL_SEGMENT_MODEL_VERSION,
)
from .core.junction_limits import (
    Any as Any,
)
from .core.junction_limits import (
    JunctionLimitError as JunctionLimitError,
)
from .core.junction_limits import (
    WallSegmentMigrationError as WallSegmentMigrationError,
)
from .core.junction_limits import (
    _axis_degrees as _axis_degrees,
)
from .core.junction_limits import (
    _build_node_index as _build_node_index,
)
from .core.junction_limits import (
    _collinear as _collinear,
)
from .core.junction_limits import (
    _distance_to_segment as _distance_to_segment,
)
from .core.junction_limits import (
    _finite_point as _finite_point,
)
from .core.junction_limits import (
    _key as _key,
)
from .core.junction_limits import (
    _length as _length,
)
from .core.junction_limits import (
    _migrated_spaces as _migrated_spaces,
)
from .core.junction_limits import (
    _quantize_key_coord as _quantize_key_coord,
)
from .core.junction_limits import (
    _stored_wall_contact as _stored_wall_contact,
)
from .core.junction_limits import (
    check_node_distances as check_node_distances,
)
from .core.junction_limits import (
    check_nodes as check_nodes,
)
from .core.junction_limits import (
    check_segment_lengths as check_segment_lengths,
)
from .core.junction_limits import (
    cm_to_units as cm_to_units,
)
from .core.junction_limits import (
    collinear_run_length_units as collinear_run_length_units,
)
from .core.junction_limits import (
    commit_wall_segment_model as commit_wall_segment_model,
)
from .core.junction_limits import (
    graph_only_removes_wall_material as graph_only_removes_wall_material,
)
from .core.junction_limits import (
    limit_segments as limit_segments,
)
from .core.junction_limits import (
    logging as logging,
)
from .core.junction_limits import (
    math as math,
)
from .core.junction_limits import (
    removes_only_limit_segments as removes_only_limit_segments,
)
from .core.junction_limits import (
    space_violation_counts as space_violation_counts,
)
from .core.junction_limits import (
    space_violations as space_violations,
)
from .core.junction_limits import (
    sys as sys,
)
from .core.junction_limits import (
    validate_junction_limits as validate_junction_limits,
)

sys.modules[__name__] = _core
