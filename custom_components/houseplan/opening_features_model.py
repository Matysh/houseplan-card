"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import opening_features_model as _core
from .core.opening_features_model import (
    clear_opening_bindings as clear_opening_bindings,
)
from .core.opening_features_model import (
    copy as copy,
)
from .core.opening_features_model import (
    math as math,
)
from .core.opening_features_model import (
    reparameterize_opening_features as reparameterize_opening_features,
)

sys.modules[__name__] = _core
