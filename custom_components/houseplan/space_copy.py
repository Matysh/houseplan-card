"""Compatibility import for the canonical independent space-copy proof."""
import sys

from .core import space_copy as _core
from .core.space_copy import (
    is_saved_space_copy as is_saved_space_copy,
    space_copy_candidate as space_copy_candidate,
)

sys.modules[__name__] = _core
