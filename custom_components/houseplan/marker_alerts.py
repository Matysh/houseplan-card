"""Compatibility alias; structural rules have one canonical core owner."""
import sys

from .core import marker_alerts as _core
from .core.marker_alerts import (
    ALERT_TEXT_LIMIT as ALERT_TEXT_LIMIT,
)
from .core.marker_alerts import (
    MAX_MARKER_ALERTS as MAX_MARKER_ALERTS,
)
from .core.marker_alerts import (
    valid_marker_alert as valid_marker_alert,
)
from .core.marker_alerts import (
    valid_marker_alerts as valid_marker_alerts,
)

sys.modules[__name__] = _core
