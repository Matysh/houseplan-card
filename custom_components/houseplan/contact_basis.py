"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import contact_basis as _core
from .core.contact_basis import (
    Any as Any,
)
from .core.contact_basis import (
    TypeGuard as TypeGuard,
)
from .core.contact_basis import (
    _number as _number,
)
from .core.contact_basis import (
    copy as copy,
)
from .core.contact_basis import (
    json as json,
)
from .core.contact_basis import (
    math as math,
)
from .core.contact_basis import (
    remap_contact_basis as remap_contact_basis,
)
from .core.contact_basis import (
    valid_contact_basis as valid_contact_basis,
)
from .core.contact_basis import (
    validate_contact_bases as validate_contact_bases,
)
from .core.contact_basis import (
    vol as vol,
)

sys.modules[__name__] = _core
