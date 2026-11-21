"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import room_appearance as _core
from .core.room_appearance import (
    APPEARANCE_KEYS as APPEARANCE_KEYS,
)
from .core.room_appearance import (
    _color as _color,
)
from .core.room_appearance import (
    config_appearance_materialized as config_appearance_materialized,
)
from .core.room_appearance import (
    deepcopy as deepcopy,
)
from .core.room_appearance import (
    materialize_space_appearance as materialize_space_appearance,
)
from .core.room_appearance import (
    math as math,
)
from .core.room_appearance import (
    normalize_room_appearance as normalize_room_appearance,
)
from .core.room_appearance import (
    preserve_space_appearance as preserve_space_appearance,
)
from .core.room_appearance import (
    re as re,
)
from .core.room_appearance import (
    resolve_space_appearance as resolve_space_appearance,
)
from .core.room_appearance import (
    space_appearance_materialized as space_appearance_materialized,
)

sys.modules[__name__] = _core
