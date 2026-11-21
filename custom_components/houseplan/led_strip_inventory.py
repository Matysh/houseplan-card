"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import led_strip_inventory as _core
from .core.led_strip_inventory import (
    Any as Any,
)
from .core.led_strip_inventory import (
    Iterator as Iterator,
)
from .core.led_strip_inventory import (
    iter_led_strips as iter_led_strips,
)
from .core.led_strip_inventory import (
    led_strip_counts as led_strip_counts,
)

sys.modules[__name__] = _core
