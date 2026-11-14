"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import graph_digest as _core
from .core.graph_digest import (
    graph_digest as graph_digest,
)
from .core.graph_digest import (
    graph_digest_bytes as graph_digest_bytes,
)
from .core.graph_digest import (
    hashlib as hashlib,
)
from .core.graph_digest import (
    json as json,
)
from .core.graph_digest import (
    struct as struct,
)

sys.modules[__name__] = _core
