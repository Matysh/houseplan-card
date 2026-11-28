"""Physical reference dimensions of a stored 3D marker height (#1608)."""
from __future__ import annotations

import voluptuous as vol

# The world-space diameter of the standard 2.25%-wide marker on the reference
# 240-cell, 5 cm canvas. Match src/marker-height.ts and the 140 cm wall cut.
_REFERENCE_DIAMETER_CM = 2.25 / 100 * 240 * 5
_SECTION_HEIGHT_CM = 140
ICON_HEIGHT_MAX_CM = _SECTION_HEIGHT_CM - _REFERENCE_DIAMETER_CM * 0.24
LED_HEIGHT_MAX_CM = _SECTION_HEIGHT_CM - _REFERENCE_DIAMETER_CM * 0.075


def marker_height_number(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= LED_HEIGHT_MAX_CM:
        raise vol.Invalid("3D marker height must be a finite number within the allowed range")
    return float(value)


def validate_marker_height_representations(config: dict) -> dict:
    """Apply each marker's limit even when only a strip binding was edited."""
    strip_ids = {
        strip["marker"]
        for space in config.get("spaces", [])
        for strip in space.get("led_strips", [])
        if strip.get("marker") and strip.get("active") is not False
    }
    for index, marker in enumerate(config.get("markers", [])):
        height = marker.get("height_cm")
        if (height is not None and not marker.get("removed")
                and marker.get("id") not in strip_ids and height > ICON_HEIGHT_MAX_CM):
            raise vol.Invalid(
                "3D marker height exceeds the icon limit",
                path=["markers", index, "height_cm"],
            )
    return config
