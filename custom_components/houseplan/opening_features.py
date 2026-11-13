"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import opening_features as _core
from .core.opening_features import (
    API_VERSION as API_VERSION,
)
from .core.opening_features import (
    LEAF_SCHEMA as LEAF_SCHEMA,
)
from .core.opening_features import (
    MOTION_FEATURES_SCHEMA as MOTION_FEATURES_SCHEMA,
)
from .core.opening_features import (
    OPENING_FEATURES_SCHEMA as OPENING_FEATURES_SCHEMA,
)
from .core.opening_features import (
    POSITION_FIELDS as POSITION_FIELDS,
)
from .core.opening_features import (
    SHADE_SCHEMA as SHADE_SCHEMA,
)
from .core.opening_features import (
    WINDOW_FEATURES_SCHEMA as WINDOW_FEATURES_SCHEMA,
)
from .core.opening_features import (
    OpeningFeaturesWriterRequired as OpeningFeaturesWriterRequired,
)
from .core.opening_features import (
    _text as _text,
)
from .core.opening_features import (
    _version as _version,
)
from .core.opening_features import (
    clear_opening_bindings as clear_opening_bindings,
)
from .core.opening_features import (
    guard_opening_features_write as guard_opening_features_write,
)
from .core.opening_features import (
    reparameterize_opening_features as reparameterize_opening_features,
)
from .core.opening_features import (
    validate_opening_features as validate_opening_features,
)
from .core.opening_features import (
    vol as vol,
)

sys.modules[__name__] = _core
