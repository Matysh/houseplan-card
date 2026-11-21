"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import wall_segment_model as _core
from .core.wall_segment_model import (
    _LEGACY_NUMBER as _LEGACY_NUMBER,
)
from .core.wall_segment_model import (
    EPS as EPS,
)
from .core.wall_segment_model import (
    GRID_STEP_N as GRID_STEP_N,
)
from .core.wall_segment_model import (
    LEGACY_DRAFT_POINT_EPSILON as LEGACY_DRAFT_POINT_EPSILON,
)
from .core.wall_segment_model import (
    LEGACY_WALL_SEGMENT_MODEL_VERSION as LEGACY_WALL_SEGMENT_MODEL_VERSION,
)
from .core.wall_segment_model import (
    WALL_SEGMENT_MODEL_VERSION as WALL_SEGMENT_MODEL_VERSION,
)
from .core.wall_segment_model import (
    Any as Any,
)
from .core.wall_segment_model import (
    WallSegmentMigrationError as WallSegmentMigrationError,
)
from .core.wall_segment_model import (
    _angle_matches as _angle_matches,
)
from .core.wall_segment_model import (
    _assign_lineage as _assign_lineage,
)
from .core.wall_segment_model import (
    _atomize as _atomize,
)
from .core.wall_segment_model import (
    _canonical_span as _canonical_span,
)
from .core.wall_segment_model import (
    _collinear_overlap as _collinear_overlap,
)
from .core.wall_segment_model import (
    _distance_to_segment as _distance_to_segment,
)
from .core.wall_segment_model import (
    _fresh_wall_segment_id as _fresh_wall_segment_id,
)
from .core.wall_segment_model import (
    _host_openings as _host_openings,
)
from .core.wall_segment_model import (
    _js_round as _js_round,
)
from .core.wall_segment_model import (
    _legacy_draft_point as _legacy_draft_point,
)
from .core.wall_segment_model import (
    _legacy_finite_number as _legacy_finite_number,
)
from .core.wall_segment_model import (
    _legacy_identity as _legacy_identity,
)
from .core.wall_segment_model import (
    _legacy_thickness_at as _legacy_thickness_at,
)
from .core.wall_segment_model import (
    _length as _length,
)
from .core.wall_segment_model import (
    _materialize_wall_host as _materialize_wall_host,
)
from .core.wall_segment_model import (
    _migrate_room_drafts_to_partitions as _migrate_room_drafts_to_partitions,
)
from .core.wall_segment_model import (
    _migrate_space as _migrate_space,
)
from .core.wall_segment_model import (
    _non_catalog_ids as _non_catalog_ids,
)
from .core.wall_segment_model import (
    _point_key as _point_key,
)
from .core.wall_segment_model import (
    _project_t as _project_t,
)
from .core.wall_segment_model import (
    _quantize as _quantize,
)
from .core.wall_segment_model import (
    _room_poly as _room_poly,
)
from .core.wall_segment_model import (
    _shared_boundaries as _shared_boundaries,
)
from .core.wall_segment_model import (
    _span_key as _span_key,
)
from .core.wall_segment_model import (
    _thickness as _thickness,
)
from .core.wall_segment_model import (
    _translated_segment_delta as _translated_segment_delta,
)
from .core.wall_segment_model import (
    _wall_direction as _wall_direction,
)
from .core.wall_segment_model import (
    _wall_key as _wall_key,
)
from .core.wall_segment_model import (
    base64 as base64,
)
from .core.wall_segment_model import (
    canonicalize_config_geometry as canonicalize_config_geometry,
)
from .core.wall_segment_model import (
    canonicalize_lattice_coordinate as canonicalize_lattice_coordinate,
)
from .core.wall_segment_model import (
    commit_wall_segment_model as commit_wall_segment_model,
)
from .core.wall_segment_model import (
    copy as copy,
)
from .core.wall_segment_model import (
    decimal as decimal,
)
from .core.wall_segment_model import (
    decode_legacy_wall_segment_model as decode_legacy_wall_segment_model,
)
from .core.wall_segment_model import (
    deterministic_wall_segment_id as deterministic_wall_segment_id,
)
from .core.wall_segment_model import (
    hashlib as hashlib,
)
from .core.wall_segment_model import (
    math as math,
)
from .core.wall_segment_model import (
    opening_frame as opening_frame,
)
from .core.wall_segment_model import (
    pick_wall_carrier as pick_wall_carrier,
)
from .core.wall_segment_model import (
    re as re,
)
from .core.wall_segment_model import (
    uuid as uuid,
)
from .core.wall_segment_model import (
    wall_carrier_eligible as wall_carrier_eligible,
)
from .core.wall_segment_model import (
    wall_host_t as wall_host_t,
)
from .core.wall_segment_model import (
    wall_interval_free as wall_interval_free,
)

sys.modules[__name__] = _core
