"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import led_strips as _core
from .core.led_strips import (
    _POINT as _POINT,
)
from .core.led_strips import (
    CANVAS_LIMIT as CANVAS_LIMIT,
)
from .core.led_strips import (
    LED_ID_MAX as LED_ID_MAX,
)
from .core.led_strips import (
    LED_KEY as LED_KEY,
)
from .core.led_strips import (
    LED_MARKER_MAX as LED_MARKER_MAX,
)
from .core.led_strips import (
    LED_STRIP_SCHEMA as LED_STRIP_SCHEMA,
)
from .core.led_strips import (
    LED_STRIPS_SCHEMA as LED_STRIPS_SCHEMA,
)
from .core.led_strips import (
    MAX_LED_POINTS as MAX_LED_POINTS,
)
from .core.led_strips import (
    MAX_LED_STRIPS as MAX_LED_STRIPS,
)
from .core.led_strips import (
    Any as Any,
)
from .core.led_strips import (
    LedStripLinkError as LedStripLinkError,
)
from .core.led_strips import (
    _coordinate as _coordinate,
)
from .core.led_strips import (
    _distinct_vertices as _distinct_vertices,
)
from .core.led_strips import (
    _live_markers as _live_markers,
)
from .core.led_strips import (
    _marker_ref as _marker_ref,
)
from .core.led_strips import (
    _same as _same,
)
from .core.led_strips import (
    _strict_bool as _strict_bool,
)
from .core.led_strips import (
    _strip_id as _strip_id,
)
from .core.led_strips import (
    _strips as _strips,
)
from .core.led_strips import (
    config_led_strip_links as config_led_strip_links,
)
from .core.led_strips import (
    copy as copy,
)
from .core.led_strips import (
    led_strip_counts as led_strip_counts,
)
from .core.led_strips import (
    led_strip_link_report as led_strip_link_report,
)
from .core.led_strips import (
    math as math,
)
from .core.led_strips import (
    normalize_led_strip_links as normalize_led_strip_links,
)
from .core.led_strips import (
    plan_only_strips as plan_only_strips,
)
from .core.led_strips import (
    polyline_length as polyline_length,
)
from .core.led_strips import (
    preserve_led_strips as preserve_led_strips,
)
from .core.led_strips import (
    strip_is_closed as strip_is_closed,
)
from .core.led_strips import (
    unbind_strips as unbind_strips,
)
from .core.led_strips import (
    validate_strip_shape as validate_strip_shape,
)
from .core.led_strips import (
    vol as vol,
)

sys.modules[__name__] = _core
