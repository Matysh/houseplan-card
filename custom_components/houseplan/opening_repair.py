"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import opening_repair as _core
from .core.opening_repair import (
    _UNREADABLE as _UNREADABLE,
)
from .core.opening_repair import (
    LEGACY_WALL_SEGMENT_MODEL_VERSION as LEGACY_WALL_SEGMENT_MODEL_VERSION,
)
from .core.opening_repair import (
    MAX_REPAIR_EXAMPLES as MAX_REPAIR_EXAMPLES,
)
from .core.opening_repair import (
    Any as Any,
)
from .core.opening_repair import (
    GraphError as GraphError,
)
from .core.opening_repair import (
    GraphHostContinuity as GraphHostContinuity,
)
from .core.opening_repair import (
    _angle_delta_mod_180 as _angle_delta_mod_180,
)
from .core.opening_repair import (
    _example as _example,
)
from .core.opening_repair import (
    _graph_host_fault as _graph_host_fault,
)
from .core.opening_repair import (
    _host as _host,
)
from .core.opening_repair import (
    _intervals as _intervals,
)
from .core.opening_repair import (
    _number as _number,
)
from .core.opening_repair import (
    _place_on_graph_wall as _place_on_graph_wall,
)
from .core.opening_repair import (
    _place_on_wall as _place_on_wall,
)
from .core.opening_repair import (
    _repair_space as _repair_space,
)
from .core.opening_repair import (
    _reserve_host_interval as _reserve_host_interval,
)
from .core.opening_repair import (
    canonicalize_config_geometry as canonicalize_config_geometry,
)
from .core.opening_repair import (
    canonicalize_lattice_coordinate as canonicalize_lattice_coordinate,
)
from .core.opening_repair import (
    canonicalize_number as canonicalize_number,
)
from .core.opening_repair import (
    copy as copy,
)
from .core.opening_repair import (
    decode_rational as decode_rational,
)
from .core.opening_repair import (
    empty_repair_report as empty_repair_report,
)
from .core.opening_repair import (
    encode_rational as encode_rational,
)
from .core.opening_repair import (
    math as math,
)
from .core.opening_repair import (
    merge_repair_reports as merge_repair_reports,
)
from .core.opening_repair import (
    opening_frame as opening_frame,
)
from .core.opening_repair import (
    partition_opening_host_fault as partition_opening_host_fault,
)
from .core.opening_repair import (
    pick_wall_carrier as pick_wall_carrier,
)
from .core.opening_repair import (
    project_graph_opening as project_graph_opening,
)
from .core.opening_repair import (
    project_parameter as project_parameter,
)
from .core.opening_repair import (
    read_source_point as read_source_point,
)
from .core.opening_repair import (
    repair_imported_openings as repair_imported_openings,
)
from .core.opening_repair import (
    to_numbers as to_numbers,
)
from .core.opening_repair import (
    wall_carrier_eligible as wall_carrier_eligible,
)
from .core.opening_repair import (
    wall_host_t as wall_host_t,
)
from .core.opening_repair import (
    wall_interval_free as wall_interval_free,
)
from .core.opening_repair import (
    wall_opening_host_fault as wall_opening_host_fault,
)

sys.modules[__name__] = _core
