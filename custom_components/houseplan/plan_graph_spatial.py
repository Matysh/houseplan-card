"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import plan_graph_spatial as _core
from .core.plan_graph_spatial import (
    P as P,
)
from .core.plan_graph_spatial import (
    SegmentTree as SegmentTree,
)

sys.modules[__name__] = _core
