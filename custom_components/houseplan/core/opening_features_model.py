"""Pure opening v1 transforms; geometry readers do not load schema/HA dependencies."""
from __future__ import annotations

import copy as copy
import math as math


def reparameterize_opening_features(opening: dict, intended_angle: float) -> dict:
    """Mirror src/opening-features.ts; a physical caller resolves slide face."""
    if not math.isfinite(intended_angle):
        raise ValueError("invalid_opening_angle")
    result = copy.deepcopy(opening)
    turns = math.floor((intended_angle + 90) / 180)
    result["angle"] = intended_angle - 180 * turns
    if result["angle"] == 0:
        result["angle"] = 0
    if turns % 2 == 0:
        return result
    features = result.get("opening_features")
    if not isinstance(features, dict) or type(features.get("version")) is not int or features["version"] != 1:
        return result
    if result.get("type") == "window":
        features["leaves"].reverse()
        for leaf in features["leaves"]:
            if leaf["hinge"] != "top":
                leaf["hinge"] = "end" if leaf["hinge"] == "start" else "start"
        features["side"] = "positive" if features["side"] == "negative" else "negative"
    elif result.get("type") in ("door", "gate") and (
        features.get("mechanism") == "slide" or "slide_direction" in features
    ):
        features["slide_direction"] = "end" if features.get("slide_direction", "end") == "start" else "start"
    return result


def clear_opening_bindings(opening: dict) -> dict:
    """Copy clears contacts even in disabled shades, preserving saved manual values."""
    result = copy.deepcopy(opening)
    result.pop("contact", None)
    result.pop("lock", None)
    features = result.get("opening_features")
    if result.get("type") == "window" and isinstance(features, dict) and features.get("version") == 1:
        for leaf in features.get("leaves", []):
            leaf.pop("contact", None)
            if isinstance(leaf.get("shade"), dict):
                leaf["shade"].pop("contact", None)
    return result
