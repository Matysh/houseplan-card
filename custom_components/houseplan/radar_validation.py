"""Compatibility exports for the canonical plan core; no copied algorithms."""
from __future__ import annotations

from .core.radar_validation import (
    _COMMON_SOURCE_ROLES as _COMMON_SOURCE_ROLES,
)
from .core.radar_validation import (
    _PROFILE_SOURCE_ROLES as _PROFILE_SOURCE_ROLES,
)
from .core.radar_validation import (
    ANGLE_UNITS as ANGLE_UNITS,
)
from .core.radar_validation import (
    CANVAS_LIMIT as CANVAS_LIMIT,
)
from .core.radar_validation import (
    ENTITY_RE as ENTITY_RE,
)
from .core.radar_validation import (
    ID_RE as ID_RE,
)
from .core.radar_validation import (
    LD2450_MODELS as LD2450_MODELS,
)
from .core.radar_validation import (
    LENGTH_UNITS as LENGTH_UNITS,
)
from .core.radar_validation import (
    MAX_RADARS as MAX_RADARS,
)
from .core.radar_validation import (
    RADAR_PROFILES as RADAR_PROFILES,
)
from .core.radar_validation import (
    Any as Any,
)
from .core.radar_validation import (
    RadarValidationError as RadarValidationError,
)
from .core.radar_validation import (
    _array as _array,
)
from .core.radar_validation import (
    _canonical_model as _canonical_model,
)
from .core.radar_validation import (
    _entity as _entity,
)
from .core.radar_validation import (
    _finite as _finite,
)
from .core.radar_validation import (
    _identifier as _identifier,
)
from .core.radar_validation import (
    _invalid as _invalid,
)
from .core.radar_validation import (
    _mapping as _mapping,
)
from .core.radar_validation import (
    _point as _point,
)
from .core.radar_validation import (
    _source_ids as _source_ids,
)
from .core.radar_validation import (
    _validate_radar as _validate_radar,
)
from .core.radar_validation import (
    _validate_settings as _validate_settings,
)
from .core.radar_validation import (
    _validate_sources as _validate_sources,
)
from .core.radar_validation import (
    _validate_verified_adapter as _validate_verified_adapter,
)
from .core.radar_validation import (
    copy as copy,
)
from .core.radar_validation import (
    math as math,
)
from .core.radar_validation import (
    radar_source_entity_ids as radar_source_entity_ids,
)
from .core.radar_validation import (
    re as re,
)
from .core.radar_validation import (
    solve_two_point as solve_two_point,
)
from .core.radar_validation import (
    validate_marker_radars as validate_marker_radars,
)
from .core.radar_validation import (
    validate_radar_draft as validate_radar_draft,
)
from .core.radar_validation import (
    vol as vol,
)


def radar_registry_evidence(hass: Any) -> dict[str, dict[str, dict[str, Any]]]:
    """Capture the small registry subset needed by verified adapters.

    The returned plain mapping is safe to pass into executor-side validation.
    Generic/manual profiles deliberately do not depend on registry evidence.
    """
    from homeassistant.helpers import device_registry as dr
    from homeassistant.helpers import entity_registry as er

    entities = {
        str(entry.entity_id): {
            "device_id": str(entry.device_id) if entry.device_id else None,
            "platform": str(getattr(entry, "platform", "") or ""),
        }
        for entry in er.async_get(hass).entities.values()
    }
    devices = {
        str(entry.id): {
            "model": str(getattr(entry, "model", "") or ""),
        }
        for entry in dr.async_get(hass).devices.values()
    }
    return {"entities": entities, "devices": devices}

