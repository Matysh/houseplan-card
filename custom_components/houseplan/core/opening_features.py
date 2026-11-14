"""Opening-features v1: lossless data contract, not another wall model."""
from __future__ import annotations

import voluptuous as vol

from .opening_features_model import clear_opening_bindings as clear_opening_bindings
from .opening_features_model import (
    reparameterize_opening_features as reparameterize_opening_features,
)

API_VERSION = 1


def _version(value):
    if type(value) is not int or value != API_VERSION:
        raise vol.Invalid("Unsupported opening_features version")
    return value


def _text(value):
    if not isinstance(value, str) or not value.strip() or len(value) > 512:
        raise vol.Invalid("Opening binding must be a nonempty string")
    return value


POSITION_FIELDS = {
    vol.Optional("manual"): vol.In(("open", "closed")),
    vol.Optional("contact"): vol.Any(None, _text),
    vol.Optional("invert"): bool,
}
SHADE_SCHEMA = vol.Schema({vol.Required("enabled"): bool, **POSITION_FIELDS})
LEAF_SCHEMA = vol.Schema({
    vol.Required("id"): vol.All(_text, vol.Length(max=120)),
    vol.Required("hinge"): vol.In(("start", "end", "top")),
    **POSITION_FIELDS,
    vol.Optional("shade"): SHADE_SCHEMA,
})
WINDOW_FEATURES_SCHEMA = vol.Schema({
    vol.Required("version"): vol.All(_version, vol.In((1,))),
    vol.Required("side"): vol.In(("negative", "positive")),
    vol.Required("leaves"): vol.All([LEAF_SCHEMA], vol.Length(min=1, max=4)),
})
MOTION_FEATURES_SCHEMA = vol.Schema({
    vol.Required("version"): vol.All(_version, vol.In((1,))),
    vol.Optional("mechanism"): vol.In(("swing", "slide")),
    vol.Optional("slide_direction"): vol.In(("start", "end")),
    vol.Optional("manual"): vol.In(("open", "closed")),
})
OPENING_FEATURES_SCHEMA = vol.Any(WINDOW_FEATURES_SCHEMA, MOTION_FEATURES_SCHEMA)


def validate_opening_features(opening: dict) -> dict:
    """Select the strict schema by parent type, rejecting mixed legacy fields."""
    if "opening_features" not in opening:
        return opening
    features = opening["opening_features"]
    kind = opening.get("type")
    if kind == "window":
        WINDOW_FEATURES_SCHEMA(features)
        if any(key in opening for key in ("contact", "invert", "flip_h", "flip_v")):
            raise vol.Invalid("Explicit window cannot have parent contact/invert/flip fields")
        ids = [leaf["id"] for leaf in features["leaves"]]
        if len(set(ids)) != len(ids):
            raise vol.Invalid("Window leaf IDs must be unique inside the opening")
    elif kind in ("door", "gate"):
        MOTION_FEATURES_SCHEMA(features)
    else:
        raise vol.Invalid("Opening features are not applicable to this opening type")
    return opening


class OpeningFeaturesWriterRequired(vol.Invalid):
    """Reject old whole-document writes before any preservation/normalization."""

    code = "opening_features_client_outdated"


def guard_opening_features_write(candidate: dict, previous: dict | None, writer=None) -> None:
    if type(writer) is int and writer == API_VERSION:
        return
    old_spaces = previous.get("spaces", []) if isinstance(previous, dict) else []
    new_spaces = candidate.get("spaces", []) if isinstance(candidate, dict) else []

    def rows(spaces):
        result = {}
        extended = set()
        if not isinstance(spaces, list):
            return result, extended
        for space in spaces:
            if not isinstance(space, dict):
                continue  # The type schema owns malformed unrelated records.
            openings = space.get("openings")
            if not isinstance(openings, list):
                continue
            for opening in openings:
                if not isinstance(opening, dict):
                    continue
                if not isinstance(space.get("id"), str) or not isinstance(opening.get("id"), str):
                    continue
                key = (space.get("id"), opening.get("id"))
                result.setdefault(key, []).append(opening)
                if "opening_features" in opening:
                    extended.add(key)
        return result, extended

    old, old_extended = rows(old_spaces)
    new, new_extended = rows(new_spaces)
    # The generic schema still rejects malformed records. This guard must not
    # equate JSON true with numeric 1 (Python's ordinary equality does).
    from .partition_promotion import _same_json_fields
    for identity in old_extended | new_extended:
        if not _same_json_fields(old.get(identity), new.get(identity)):
            raise OpeningFeaturesWriterRequired(
                "Update House Plan and reload before editing an extended opening"
            )
