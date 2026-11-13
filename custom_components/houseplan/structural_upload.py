"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import structural_upload as _core
from .core.structural_upload import (
    CONTROL_KEYS as CONTROL_KEYS,
)
from .core.structural_upload import (
    INLINE_BYTES as INLINE_BYTES,
)
from .core.structural_upload import (
    MAX_STAGED_BYTES as MAX_STAGED_BYTES,
)
from .core.structural_upload import (
    MAX_UPLOAD_BYTES as MAX_UPLOAD_BYTES,
)
from .core.structural_upload import (
    PURPOSES as PURPOSES,
)
from .core.structural_upload import (
    UPLOAD_TTL as UPLOAD_TTL,
)
from .core.structural_upload import (
    Any as Any,
)
from .core.structural_upload import (
    Callable as Callable,
)
from .core.structural_upload import (
    StructuralUploads as StructuralUploads,
)
from .core.structural_upload import (
    Upload as Upload,
)
from .core.structural_upload import (
    UploadError as UploadError,
)
from .core.structural_upload import (
    UploadSnapshot as UploadSnapshot,
)
from .core.structural_upload import (
    _pairs as _pairs,
)
from .core.structural_upload import (
    copy as copy,
)
from .core.structural_upload import (
    dataclass as dataclass,
)
from .core.structural_upload import (
    datetime as datetime,
)
from .core.structural_upload import (
    field as field,
)
from .core.structural_upload import (
    hashlib as hashlib,
)
from .core.structural_upload import (
    json as json,
)
from .core.structural_upload import (
    parse_payload as parse_payload,
)
from .core.structural_upload import (
    prepare_finish as prepare_finish,
)
from .core.structural_upload import (
    prepare_resolution as prepare_resolution,
)
from .core.structural_upload import (
    secrets as secrets,
)
from .core.structural_upload import (
    time as time,
)
from .core.structural_upload import (
    timezone as timezone,
)
from .core.structural_upload import (
    uploads as uploads,
)

sys.modules[__name__] = _core
