"""Backend wire and compatibility contract for the #437 summary panel."""
from pathlib import Path

import pytest
import voluptuous as vol

from pure_imports import load_pure


ROOT = Path(__file__).resolve().parents[1]
v = load_pure("hp_validation_summary", ROOT / "custom_components" / "houseplan" / "validation.py")


def panel(entity_id="sensor.live", space_id="f1"):
    return {
        "version": 1,
        "title": "Summary",
        "show_on_mobile": True,
        "blocks": [{
            "id": "b1", "title": "General", "visible": True,
            "scope": {"type": "space", "space_id": space_id},
            "values": [{
                "id": "v1", "label": "Value",
                "source": {"type": "entity", "entity_id": entity_id},
            }],
        }],
    }


def config(summary=None):
    value = {"spaces": [], "markers": [], "settings": {}}
    if summary is not None:
        value["settings"]["summary_panel"] = summary
    return value


def test_summary_v1_schema_accepts_bounded_content_and_rejects_duplicate_ids():
    valid = panel()
    assert v.CONFIG_SCHEMA(config(valid))["settings"]["summary_panel"] == valid
    duplicate = panel()
    duplicate["blocks"][0]["values"].append(dict(duplicate["blocks"][0]["values"][0]))
    with pytest.raises(vol.Invalid, match="value ids"):
        v.CONFIG_SCHEMA(config(duplicate))


@pytest.mark.parametrize("mutation", [
    lambda p: p.update(title=""),
    lambda p: p.update(title="   "),
    lambda p: p.update(blocks=p["blocks"] * 11),
    lambda p: p["blocks"][0].update(scope={"type": "other"}),
    lambda p: p["blocks"][0]["values"][0].update(source={"type": "system", "key": "other"}),
])
def test_summary_v1_schema_rejects_malformed_wire(mutation):
    value = panel()
    mutation(value)
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA(config(value))


def test_old_client_omission_preserves_namespace_and_future_version_losslessly():
    future = {"version": 2, "opaque": {"anything": [1, 2, 3]}}
    previous = config(future)
    candidate = config()
    v.preserve_summary_panel_namespace(candidate, previous)
    checked = v.CONFIG_SCHEMA(candidate)
    assert checked["settings"]["summary_panel"] == future


def test_summary_user_text_is_trimmed_at_the_server_boundary():
    value = panel(" sensor.live ")
    value["title"] = " Summary "
    value["blocks"][0]["title"] = " General "
    value["blocks"][0]["values"][0]["label"] = " Value "
    checked = v.CONFIG_SCHEMA(config(value))["settings"]["summary_panel"]
    assert checked["title"] == "Summary"
    assert checked["blocks"][0]["title"] == "General"
    assert checked["blocks"][0]["values"][0]["label"] == "Value"
    assert checked["blocks"][0]["values"][0]["source"]["entity_id"] == "sensor.live"


def test_reference_validation_allows_old_broken_ids_but_rejects_new_ones():
    previous = config(panel("sensor.gone", "gone"))
    unchanged = config(panel("sensor.gone", "gone"))
    v.validate_summary_panel_references(unchanged, previous, set())
    renamed = config(panel("sensor.gone", "gone"))
    renamed["settings"]["summary_panel"]["title"] = "Renamed"
    v.validate_summary_panel_references(renamed, previous, set())
    replaced = config(panel("sensor.other", "gone"))
    with pytest.raises(vol.Invalid, match="entity reference"):
        v.validate_summary_panel_references(replaced, previous, set())
    new_scope = config(panel("sensor.live", "other"))
    with pytest.raises(vol.Invalid, match="space reference"):
        v.validate_summary_panel_references(new_scope, previous, {"sensor.live"})


def test_ordinary_summary_contract_preserves_omission_but_not_explicit_empty():
    previous = config(panel())
    previous["settings"].update(known=True, future={"sentinel": 1})
    omitted = {"spaces": [], "markers": [], "settings": {"known": True, "future": {"sentinel": 1}}}
    checked = v.prepare_ordinary_summary_candidate(
        omitted, previous, {"sensor.live"}, v.CONFIG_SCHEMA,
    )
    assert checked["settings"]["summary_panel"] == previous["settings"]["summary_panel"]
    assert checked["settings"]["known"] is True
    assert checked["settings"]["future"] == {"sentinel": 1}

    empty = config({
        "version": 1, "title": "Empty", "show_on_mobile": True, "blocks": [],
    })
    checked_empty = v.prepare_ordinary_summary_candidate(
        empty, previous, set(), v.CONFIG_SCHEMA,
    )
    assert checked_empty["settings"]["summary_panel"]["blocks"] == []


def test_ordinary_summary_contract_validates_after_writer_normalization():
    calls = []
    previous = config(panel("sensor.old"))
    candidate = config()

    def normalize(value):
        calls.append(value["settings"]["summary_panel"]["title"])
        value["settings"]["summary_panel"]["title"] = "Normalized"
        return v.CONFIG_SCHEMA(value)

    checked = v.prepare_ordinary_summary_candidate(candidate, previous, set(), normalize)
    assert calls == ["Summary"]
    assert checked["settings"]["summary_panel"]["title"] == "Normalized"

    replacement = config(panel("sensor.denied"))
    with pytest.raises(vol.Invalid, match="entity reference"):
        v.prepare_ordinary_summary_candidate(replacement, previous, set(), v.CONFIG_SCHEMA)
