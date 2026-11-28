"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import validation as _core
from .core.validation import (
    _APPEARANCE_COLOR as _APPEARANCE_COLOR,
)
from .core.validation import (
    _BG_MODE as _BG_MODE,
)
from .core.validation import (
    _COLOR as _COLOR,
)
from .core.validation import (
    _CONTROL_ENTITY_ID_RE as _CONTROL_ENTITY_ID_RE,
)
from .core.validation import (
    _COORD as _COORD,
)
from .core.validation import (
    _CUSTOM_FILL as _CUSTOM_FILL,
)
from .core.validation import (
    _DECOR_ASSET_ID as _DECOR_ASSET_ID,
)
from .core.validation import (
    _DECOR_COMMON as _DECOR_COMMON,
)
from .core.validation import (
    _DEFAULT_ROOM_WALL_CM as _DEFAULT_ROOM_WALL_CM,
)
from .core.validation import (
    _DEVICE_BATTERY as _DEVICE_BATTERY,
)
from .core.validation import (
    _ENTITY_ID as _ENTITY_ID,
)
from .core.validation import (
    _EXTENT as _EXTENT,
)
from .core.validation import (
    _EXTERNAL_SCREEN_SCHEMA as _EXTERNAL_SCREEN_SCHEMA,
)
from .core.validation import (
    _EXTERNAL_SCREEN_V2_SCHEMA as _EXTERNAL_SCREEN_V2_SCHEMA,
)
from .core.validation import (
    _EXTERNAL_SCREEN_VIEW_SCHEMA as _EXTERNAL_SCREEN_VIEW_SCHEMA,
)
from .core.validation import (
    _FURN_SIZE as _FURN_SIZE,
)
from .core.validation import (
    _FURN_SYMBOL as _FURN_SYMBOL,
)
from .core.validation import (
    _GEOM as _GEOM,
)
from .core.validation import (
    _LEGACY_MAX_DRAFT_SEGMENTS as _LEGACY_MAX_DRAFT_SEGMENTS,
)
from .core.validation import (
    _LEGACY_MAX_ROOM_DRAFTS as _LEGACY_MAX_ROOM_DRAFTS,
)
from .core.validation import (
    _LEGACY_ROOM_DRAFT_SCHEMA as _LEGACY_ROOM_DRAFT_SCHEMA,
)
from .core.validation import (
    _LIGHT_ENTITY_RE as _LIGHT_ENTITY_RE,
)
from .core.validation import (
    _NONEMPTY_TEXT as _NONEMPTY_TEXT,
)
from .core.validation import (
    _NORM as _NORM,
)
from .core.validation import (
    _OPTIMIZE_PARTITION_KEYS as _OPTIMIZE_PARTITION_KEYS,
)
from .core.validation import (
    _OPTIMIZE_REHOST_EPSILON as _OPTIMIZE_REHOST_EPSILON,
)
from .core.validation import (
    _RECORD_CAPS as _RECORD_CAPS,
)
from .core.validation import (
    _SAFE_NAME_RE as _SAFE_NAME_RE,
)
from .core.validation import (
    _SUMMARY_BLOCK_SCHEMA as _SUMMARY_BLOCK_SCHEMA,
)
from .core.validation import (
    _SUMMARY_ID as _SUMMARY_ID,
)
from .core.validation import (
    _SUMMARY_LABEL as _SUMMARY_LABEL,
)
from .core.validation import (
    _SUMMARY_SCOPE as _SUMMARY_SCOPE,
)
from .core.validation import (
    _SUMMARY_SOURCE as _SUMMARY_SOURCE,
)
from .core.validation import (
    _SUMMARY_TITLE as _SUMMARY_TITLE,
)
from .core.validation import (
    _SUMMARY_VALUE_SCHEMA as _SUMMARY_VALUE_SCHEMA,
)
from .core.validation import (
    _SUN_RAY_ORIGIN as _SUN_RAY_ORIGIN,
)
from .core.validation import (
    _TEXT as _TEXT,
)
from .core.validation import (
    _TEXT_OR_NONE as _TEXT_OR_NONE,
)
from .core.validation import (
    _URL as _URL,
)
from .core.validation import (
    CANVAS_LIMIT as CANVAS_LIMIT,
)
from .core.validation import (
    CELL_CM_MAX as CELL_CM_MAX,
)
from .core.validation import (
    CELL_CM_MIN as CELL_CM_MIN,
)
from .core.validation import (
    CONFIG_SCHEMA as CONFIG_SCHEMA,
)
from .core.validation import (
    CONFIG_TYPE_SCHEMA as CONFIG_TYPE_SCHEMA,
)
from .core.validation import (
    DECOR_SCHEMA as DECOR_SCHEMA,
)
from .core.validation import (
    DECOR_TEXT_CM_MAX as DECOR_TEXT_CM_MAX,
)
from .core.validation import (
    DECOR_TEXT_SCALE_MAX as DECOR_TEXT_SCALE_MAX,
)
from .core.validation import (
    DECOR_TEXT_SCALE_MIN as DECOR_TEXT_SCALE_MIN,
)
from .core.validation import (
    EXTERNAL_SCREENS_SCHEMA as EXTERNAL_SCREENS_SCHEMA,
)
from .core.validation import (
    EXTERNAL_SCREENS_V1_SCHEMA as EXTERNAL_SCREENS_V1_SCHEMA,
)
from .core.validation import (
    EXTERNAL_SCREENS_V2_SCHEMA as EXTERNAL_SCREENS_V2_SCHEMA,
)
from .core.validation import (
    EXTERNAL_SCREENS_WIRE_SCHEMA as EXTERNAL_SCREENS_WIRE_SCHEMA,
)
from .core.validation import (
    FILE_EXTENSIONS as FILE_EXTENSIONS,
)
from .core.validation import (
    LAYOUT_SCHEMA as LAYOUT_SCHEMA,
)
from .core.validation import (
    LED_STRIPS_SCHEMA as LED_STRIPS_SCHEMA,
)
from .core.validation import (
    MARKER_CONTROL_PREFIX as MARKER_CONTROL_PREFIX,
)
from .core.validation import (
    MARKER_SCHEMA as MARKER_SCHEMA,
)
from .core.validation import (
    MAX_CONFIG_BYTES as MAX_CONFIG_BYTES,
)
from .core.validation import (
    MAX_CONFIG_TEXT as MAX_CONFIG_TEXT,
)
from .core.validation import (
    MAX_CONTROLS as MAX_CONTROLS,
)
from .core.validation import (
    MAX_DECOR as MAX_DECOR,
)
from .core.validation import (
    MAX_DECOR_ATTR as MAX_DECOR_ATTR,
)
from .core.validation import (
    MAX_DECOR_TEXT as MAX_DECOR_TEXT,
)
from .core.validation import (
    MAX_DECOR_UNIT as MAX_DECOR_UNIT,
)
from .core.validation import (
    MAX_DESCRIPTION as MAX_DESCRIPTION,
)
from .core.validation import (
    MAX_ENTITY_ID as MAX_ENTITY_ID,
)
from .core.validation import (
    MAX_FILE_BYTES as MAX_FILE_BYTES,
)
from .core.validation import (
    MAX_FILENAME as MAX_FILENAME,
)
from .core.validation import (
    MAX_FURN_SYMBOL as MAX_FURN_SYMBOL,
)
from .core.validation import (
    MAX_KNOWN_DEVICES as MAX_KNOWN_DEVICES,
)
from .core.validation import (
    MAX_LAYOUT as MAX_LAYOUT,
)
from .core.validation import (
    MAX_MARKER_AREA_SNAPSHOT as MAX_MARKER_AREA_SNAPSHOT,
)
from .core.validation import (
    MAX_MARKERS as MAX_MARKERS,
)
from .core.validation import (
    MAX_OPEN_SPANS as MAX_OPEN_SPANS,
)
from .core.validation import (
    MAX_OPEN_TO as MAX_OPEN_TO,
)
from .core.validation import (
    MAX_OPENINGS as MAX_OPENINGS,
)
from .core.validation import (
    MAX_PARTITIONS as MAX_PARTITIONS,
)
from .core.validation import (
    MAX_PDFS as MAX_PDFS,
)
from .core.validation import (
    MAX_PLAN_BYTES as MAX_PLAN_BYTES,
)
from .core.validation import (
    MAX_POLY_POINTS as MAX_POLY_POINTS,
)
from .core.validation import (
    MAX_ROOMS as MAX_ROOMS,
)
from .core.validation import (
    MAX_SPACES as MAX_SPACES,
)
from .core.validation import (
    MAX_STAIRS as MAX_STAIRS,
)
from .core.validation import (
    MAX_TEXT as MAX_TEXT,
)
from .core.validation import (
    MAX_URL as MAX_URL,
)
from .core.validation import (
    MAX_WALL_COLUMNS as MAX_WALL_COLUMNS,
)
from .core.validation import (
    MAX_WALL_SEGMENTS as MAX_WALL_SEGMENTS,
)
from .core.validation import (
    MAX_WALLS as MAX_WALLS,
)
from .core.validation import (
    NORMALIZED_CANVAS_CELLS as NORMALIZED_CANVAS_CELLS,
)
from .core.validation import (
    OPEN_SPAN_MIN_LEN as OPEN_SPAN_MIN_LEN,
)
from .core.validation import (
    OPENING_FEATURES_SCHEMA as OPENING_FEATURES_SCHEMA,
)
from .core.validation import (
    OPENING_HOST_SCHEMA as OPENING_HOST_SCHEMA,
)
from .core.validation import (
    PARTITION_OPENING_HOST_SCHEMA as PARTITION_OPENING_HOST_SCHEMA,
)
from .core.validation import (
    PARTITION_SCHEMA as PARTITION_SCHEMA,
)
from .core.validation import (
    PASSAGE_FORBIDDEN_FIELDS as PASSAGE_FORBIDDEN_FIELDS,
)
from .core.validation import (
    PLAN_EXTENSIONS as PLAN_EXTENSIONS,
)
from .core.validation import (
    PLAN_SCALE_MAX as PLAN_SCALE_MAX,
)
from .core.validation import (
    PLAN_SCALE_MIN as PLAN_SCALE_MIN,
)
from .core.validation import (
    POINT as POINT,
)
from .core.validation import (
    POS_SCHEMA as POS_SCHEMA,
)
from .core.validation import (
    ROOM_SCHEMA as ROOM_SCHEMA,
)
from .core.validation import (
    SPACE_DISPLAY_SCHEMA as SPACE_DISPLAY_SCHEMA,
)
from .core.validation import (
    SPACE_ID_RE as SPACE_ID_RE,
)
from .core.validation import (
    SPACE_SCHEMA as SPACE_SCHEMA,
)
from .core.validation import (
    STAIR_SCHEMA as STAIR_SCHEMA,
)
from .core.validation import (
    SUMMARY_PANEL_SCHEMA as SUMMARY_PANEL_SCHEMA,
)
from .core.validation import (
    SUMMARY_PANEL_WIRE_SCHEMA as SUMMARY_PANEL_WIRE_SCHEMA,
)
from .core.validation import (
    VALUE_BADGE_ATTRIBUTES as VALUE_BADGE_ATTRIBUTES,
)
from .core.validation import (
    VALUE_BADGE_POSITIONS as VALUE_BADGE_POSITIONS,
)
from .core.validation import (
    VALUE_BADGE_SOURCE_KINDS as VALUE_BADGE_SOURCE_KINDS,
)
from .core.validation import (
    WALL_COLUMN_SCHEMA as WALL_COLUMN_SCHEMA,
)
from .core.validation import (
    WALL_OPENING_HOST_SCHEMA as WALL_OPENING_HOST_SCHEMA,
)
from .core.validation import (
    WALL_SCHEMA as WALL_SCHEMA,
)
from .core.validation import (
    WALL_SEGMENT_SCHEMA as WALL_SEGMENT_SCHEMA,
)
from .core.validation import (
    Counter as Counter,
)
from .core.validation import (
    DuplicateMarkerIdError as DuplicateMarkerIdError,
)
from .core.validation import (
    MarkerControlError as MarkerControlError,
)
from .core.validation import (
    OpeningPassageError as OpeningPassageError,
)
from .core.validation import (
    OrdinaryWriteScope as OrdinaryWriteScope,
)
from .core.validation import (
    PartitionOpeningHostError as PartitionOpeningHostError,
)
from .core.validation import (
    PartitionOpeningJambMarginError as PartitionOpeningJambMarginError,
)
from .core.validation import (
    WallModelClientOutdatedError as WallModelClientOutdatedError,
)
from .core.validation import (
    _active_marker_groups as _active_marker_groups,
)
from .core.validation import (
    _angle_delta_mod_180 as _angle_delta_mod_180,
)
from .core.validation import (
    _axis_point as _axis_point,
)
from .core.validation import (
    _axis_range as _axis_range,
)
from .core.validation import (
    _bounded_external_screens as _bounded_external_screens,
)
from .core.validation import (
    _canonical_segment_key as _canonical_segment_key,
)
from .core.validation import (
    _catalog_coupled_wall_geometry_projection as _catalog_coupled_wall_geometry_projection,
)
from .core.validation import (
    _config_wall_segment_invariants as _config_wall_segment_invariants,
)
from .core.validation import (
    _dedupe_open_spans as _dedupe_open_spans,
)
from .core.validation import (
    _exact_host_parameter as _exact_host_parameter,
)
from .core.validation import (
    _exact_partition_align as _exact_partition_align,
)
from .core.validation import (
    _existing_wall_room_ownership_only as _existing_wall_room_ownership_only,
)
from .core.validation import (
    _external_screen_invariants as _external_screen_invariants,
)
from .core.validation import (
    _finite as _finite,
)
from .core.validation import (
    _finite_number as _finite_number,
)
from .core.validation import (
    _finite_number_or_none as _finite_number_or_none,
)
from .core.validation import (
    _future_external_screens as _future_external_screens,
)
from .core.validation import (
    _future_summary_panel as _future_summary_panel,
)
from .core.validation import (
    _graph_host_interval as _graph_host_interval,
)
from .core.validation import (
    _hosted_opening_geometry as _hosted_opening_geometry,
)
from .core.validation import (
    _known_optimize_partition as _known_optimize_partition,
)
from .core.validation import (
    _legacy_room_draft_segments as _legacy_room_draft_segments,
)
from .core.validation import (
    _legacy_wall_model_projection as _legacy_wall_model_projection,
)
from .core.validation import (
    _line_distance as _line_distance,
)
from .core.validation import (
    _matching_previous_marker as _matching_previous_marker,
)
from .core.validation import (
    _north_deg as _north_deg,
)
from .core.validation import (
    _open_span as _open_span,
)
from .core.validation import (
    _optimize_partition_needs_proof as _optimize_partition_needs_proof,
)
from .core.validation import (
    _partition_nonzero as _partition_nonzero,
)
from .core.validation import (
    _projection as _projection,
)
from .core.validation import (
    _projection_differs as _projection_differs,
)
from .core.validation import (
    _record_key as _record_key,
)
from .core.validation import (
    _require_geometry as _require_geometry,
)
from .core.validation import (
    _reserve_host_interval as _reserve_host_interval,
)
from .core.validation import (
    _restore_wall_model_fields as _restore_wall_model_fields,
)
from .core.validation import (
    _room_polygon as _room_polygon,
)
from .core.validation import (
    _safe_optimize_partition_delta as _safe_optimize_partition_delta,
)
from .core.validation import (
    _safe_optimize_partition_rehost as _safe_optimize_partition_rehost,
)
from .core.validation import (
    _safe_optimize_residual_rehost as _safe_optimize_residual_rehost,
)
from .core.validation import (
    _same_unchanged_graph_host_run as _same_unchanged_graph_host_run,
)
from .core.validation import (
    _screen_int as _screen_int,
)
from .core.validation import (
    _screen_rotation as _screen_rotation,
)
from .core.validation import (
    _screen_scale as _screen_scale,
)
from .core.validation import (
    _screen_seconds as _screen_seconds,
)
from .core.validation import (
    _screen_zoom as _screen_zoom,
)
from .core.validation import (
    _segment_covers as _segment_covers,
)
from .core.validation import (
    _segment_metrics as _segment_metrics,
)
from .core.validation import (
    _segments_cover_target as _segments_cover_target,
)
from .core.validation import (
    _segments_overlap_on_axis as _segments_overlap_on_axis,
)
from .core.validation import (
    _space_geometry_invariants as _space_geometry_invariants,
)
from .core.validation import (
    _stair_dimensions as _stair_dimensions,
)
from .core.validation import (
    _strict_stair as _strict_stair,
)
from .core.validation import (
    _strict_wall_column as _strict_wall_column,
)
from .core.validation import (
    _summary_panel_invariants as _summary_panel_invariants,
)
from .core.validation import (
    _summary_text as _summary_text,
)
from .core.validation import (
    _view_box as _view_box,
)
from .core.validation import (
    _wall_catalog_projection as _wall_catalog_projection,
)
from .core.validation import (
    _wall_endpoints_pair as _wall_endpoints_pair,
)
from .core.validation import (
    _wall_segment_nonzero as _wall_segment_nonzero,
)
from .core.validation import (
    canonical_config as canonical_config,
)
from .core.validation import (
    canonicalize_config_geometry as canonicalize_config_geometry,
)
from .core.validation import (
    canonicalize_lattice_coordinate as canonicalize_lattice_coordinate,
)
from .core.validation import (
    canonicalize_layout_geometry as canonicalize_layout_geometry,
)
from .core.validation import (
    canonicalize_number as canonicalize_number,
)
from .core.validation import (
    canonicalize_position as canonicalize_position,
)
from .core.validation import (
    config_led_strip_links as config_led_strip_links,
)
from .core.validation import (
    copy as copy,
)
from .core.validation import (
    external_screens_config_event as external_screens_config_event,
)
from .core.validation import (
    file_ext as file_ext,
)
from .core.validation import (
    json as json,
)
from .core.validation import (
    materialize_space_appearance as materialize_space_appearance,
)
from .core.validation import (
    math as math,
)
from .core.validation import (
    needs_canonical_config as needs_canonical_config,
)
from .core.validation import (
    normalize_space_display as normalize_space_display,
)
from .core.validation import (
    ordinary_write_scope as ordinary_write_scope,
)
from .core.validation import (
    partition_opening_host_fault as partition_opening_host_fault,
)
from .core.validation import (
    prepare_ordinary_summary_candidate as prepare_ordinary_summary_candidate,
)
from .core.validation import (
    preserve_external_screens_namespace as preserve_external_screens_namespace,
)
from .core.validation import (
    preserve_led_strips as preserve_led_strips,
)
from .core.validation import (
    preserve_space_appearance as preserve_space_appearance,
)
from .core.validation import (
    preserve_summary_panel_namespace as preserve_summary_panel_namespace,
)
from .core.validation import (
    re as re,
)
from .core.validation import (
    same_partition_wall_chain_promotion as same_partition_wall_chain_promotion,
)
from .core.validation import (
    same_partition_wall_promotion as same_partition_wall_promotion,
)
from .core.validation import (
    sanitize_filename as sanitize_filename,
)
from .core.validation import (
    sanitize_marker_id as sanitize_marker_id,
)
from .core.validation import (
    summary_panel_entity_ids as summary_panel_entity_ids,
)
from .core.validation import (
    valid_marker_alerts as valid_marker_alerts,
)
from .core.validation import (
    valid_space_id as valid_space_id,
)
from .core.validation import (
    validate_active_marker_ids as validate_active_marker_ids,
)
from .core.validation import (
    validate_external_screens_references as validate_external_screens_references,
)
from .core.validation import (
    validate_marker_controls as validate_marker_controls,
)
from .core.validation import (
    validate_marker_light_entities as validate_marker_light_entities,
)
from .core.validation import (
    validate_marker_routes as validate_marker_routes,
)
from .core.validation import (
    validate_marker_vacuum_routes as validate_marker_vacuum_routes,
)
from .core.validation import (
    validate_marker_value_badges as validate_marker_value_badges,
)
from .core.validation import (
    validate_opening_features as validate_opening_features,
)
from .core.validation import (
    validate_opening_passages as validate_opening_passages,
)
from .core.validation import (
    validate_partition_opening_hosts as validate_partition_opening_hosts,
)
from .core.validation import (
    validate_scoped_candidate as validate_scoped_candidate,
)
from .core.validation import (
    validate_summary_panel_references as validate_summary_panel_references,
)
from .core.validation import (
    validate_wall_model_transition as validate_wall_model_transition,
)
from .core.validation import (
    vol as vol,
)
from .core.validation import (
    wall_opening_host_fault as wall_opening_host_fault,
)

sys.modules[__name__] = _core
