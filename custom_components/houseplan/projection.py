"""Compatibility import for the canonical pure projection owner."""
import sys

from .core import projection as _core
from .core.projection import (
    project_config as project_config,
    project_layout as project_layout,
    project_markers as project_markers,
)

sys.modules[__name__] = _core
