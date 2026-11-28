"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import graph_validation_scope as _core
from .core.graph_validation_scope import (
    ContextVar as ContextVar,
)
from .core.graph_validation_scope import (
    GraphValidationScope as GraphValidationScope,
)
from .core.graph_validation_scope import (
    _active as _active,
)
from .core.graph_validation_scope import (
    _GraphProof as _GraphProof,
)
from .core.graph_validation_scope import (
    _json_key as _json_key,
)
from .core.graph_validation_scope import (
    contextmanager as contextmanager,
)
from .core.graph_validation_scope import (
    current_graph_validation_scope as current_graph_validation_scope,
)
from .core.graph_validation_scope import (
    dataclass as dataclass,
)
from .core.graph_validation_scope import (
    graph_validation_scope as graph_validation_scope,
)
from .core.graph_validation_scope import (
    json as json,
)

sys.modules[__name__] = _core
