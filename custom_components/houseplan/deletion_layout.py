"""Compatibility import for the canonical layout ownership rule."""
import sys

from .core import deletion_layout as _core
from .core.deletion_layout import deletion_layout_candidate as deletion_layout_candidate

sys.modules[__name__] = _core
