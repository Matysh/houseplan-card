"""#1395: explicit strict input bounds and unchanged authenticated defaults."""
from __future__ import annotations

import builtins
import copy
import json
import socket
import urllib.request
from dataclasses import replace
from fractions import Fraction
from pathlib import Path
from types import SimpleNamespace

import pytest

from custom_components.houseplan.core import import_export
from custom_components.houseplan.core.backup_archive import (
    build_archive,
    expanded_size,
    plan_image_ext,
    read_archive,
    strict_json,
)
from custom_components.houseplan.core.decor_assets import (
    DecorAssetError,
    validate_asset,
)
from custom_components.houseplan.core.input_policy import (
    HA_INPUT_POLICY,
    STRICT_INPUT_POLICY,
    InputLimit,
    charge_work,
    check_json_bounds,
    checkpoint,
    current_policy,
    input_scope,
)
from custom_components.houseplan.core.plan_graph import validate_graph
from custom_components.houseplan.core.plan_graph_exact import (
    ExactPoint,
    GraphError,
    encode_point,
    integer,
)
from custom_components.houseplan.core.structural_upload import (
    UploadError,
    parse_payload,
)
from tests_backend.test_decor_assets import PNG_1X1


def document(root: Path, extra=None):
    config = {"spaces": [], "markers": [], "settings": {}, "extra": extra}
    result, _ = import_export.create_export(
        SimpleNamespace(instance_id="policy-fixture", integration_version="test"),
        {"config": config}, {"layout": {}}, kind="full", space_id=None,
        card_version="test", config_root=root,
    )
    return result


def parallel_graph(count=12):
    nodes, edges = [], []
    for i in range(count):
        a, b = f"a{i}", f"b{i}"
        nodes.extend([
            {"id": a, "p": encode_point(ExactPoint(Fraction(0), Fraction(i, 2 * count)))},
            {"id": b, "p": encode_point(ExactPoint(Fraction(1), Fraction(1, 2) + Fraction(i, 2 * count)))},
        ])
        edges.append({"id": f"e{i}", "kind": "partition", "from": a, "to": b, "cm": 10})
    return {"version": 1, "nodes": sorted(nodes, key=lambda n: n["id"]),
            "edges": sorted(edges, key=lambda e: (e["kind"], e["id"])), "rooms": [], "dependencies": []}


def test_policy_is_explicit_bounded_and_not_a_new_store_default():
    assert current_policy() is HA_INPUT_POLICY
    assert HA_INPUT_POLICY.archive_bytes == HA_INPUT_POLICY.expanded_bytes == 2 * 1024**3
    assert HA_INPUT_POLICY.json_depth is HA_INPUT_POLICY.geometry_units is None
    assert STRICT_INPUT_POLICY.archive_bytes == 256 * 1024**2
    assert STRICT_INPUT_POLICY.expanded_bytes == 512 * 1024**2
    for field, value in [("archive_bytes", 256 * 1024**2 + 1), ("geometry_units", 2_000_001),
                         ("json_depth", 65), ("json_nodes", 1_000_001), ("seconds", 5.1)]:
        with pytest.raises(ValueError):
            replace(STRICT_INPUT_POLICY, **{field: value})


@pytest.mark.parametrize("offset", [-1, 0, 1])
def test_json_node_and_depth_boundaries_count_keys_and_containers(offset):
    # dict + key + array + scalar = four nodes; maximum depth is two.
    raw = b'{"key":[0]}'
    for field, boundary in [("json_nodes", 4), ("json_depth", 2)]:
        policy = replace(STRICT_INPUT_POLICY, **{field: boundary + offset})
        if offset < 0:
            with pytest.raises(InputLimit):
                with input_scope(policy, clock=lambda: 0):
                    check_json_bounds(raw, len(raw))
        else:
            with input_scope(policy, clock=lambda: 0):
                check_json_bounds(raw, len(raw))


def test_json_string_escapes_are_not_structural_tokens():
    raw = json.dumps({"key": '[{]}\\\"\\\\ [ null : , true'}).encode()
    with input_scope(replace(STRICT_INPUT_POLICY, json_depth=1, json_nodes=3), clock=lambda: 0):
        check_json_bounds(raw, len(raw))
        check_json_bounds(b'\xef\xbb\xbf' + raw, len(raw) + 3)


@pytest.mark.parametrize("encoding", ["utf-16-le", "utf-16-be", "utf-32-le", "utf-32-be"])
@pytest.mark.parametrize("bom", [False, True])
def test_strict_zip_json_refuses_alternate_encoding_before_decoder(encoding, bom, monkeypatch):
    # An escaped quote changes the ASCII-byte scanner's string state for
    # UTF16/32, hiding the following containers from its old depth counter.
    text = json.dumps({"escape": '"'})[:-1] + ',"x":' + '[' * 65 + '0' + ']' * 65 + '}'
    raw = text.encode(encoding)
    if bom:
        raw = {"utf-16-le": b'\xff\xfe', "utf-16-be": b'\xfe\xff',
               "utf-32-le": b'\xff\xfe\0\0', "utf-32-be": b'\0\0\xfe\xff'}[encoding] + raw
    assert strict_json(raw, 4096)["escape"] == '"'  # Preserve the existing HA decoder contract.
    with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0):
        assert strict_json(b'{"escape":"safe","x":[0]}', 4096)["x"] == [0]
        def forbidden(*_args, **_kwargs):
            raise AssertionError("alternate encoded tree reached json.loads")
        monkeypatch.setattr(import_export.json, "loads", forbidden)
        with pytest.raises(InputLimit) as error:
            strict_json(raw, 4096)
        assert error.value.reason == "json_encoding"


def test_depth_guard_runs_before_the_json_decoder_and_preserves_source(tmp_path, monkeypatch):
    base = json.dumps(document(tmp_path)).encode()
    raw = base.replace(b'"extra": null', b'"extra":' + b'[' * 1500 + b'0' + b']' * 1500)
    before = bytes(raw)
    def forbidden(*_args, **_kwargs):
        raise AssertionError("decoder entered before structural preflight")
    monkeypatch.setattr(import_export.json, "loads", forbidden)
    with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0):
        with pytest.raises(import_export.ImportFailure) as error:
            import_export.parse_document(raw)
    assert error.value.code == "capacity_exceeded"
    assert raw == before


def test_ha_deep_copy_failure_is_a_domain_error_without_new_depth64_cap(tmp_path):
    base = json.dumps(document(tmp_path)).encode()
    def raw(n):
        return base.replace(b'"extra": null', b'"extra":' + b'[' * n + b'0' + b']' * n)
    assert import_export.parse_document(raw(65))["payload"]["config"]["extra"] is not None
    with pytest.raises(import_export.ImportFailure) as error:
        import_export.parse_document(raw(1500))
    assert error.value.code == "invalid_config"
    assert "RecursionError" not in error.value.message


def test_direct_zip_json_and_structural_upload_share_the_strict_scanner(tmp_path):
    raw = json.dumps(document(tmp_path)).encode()
    with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0):
        assert import_export.parse_document(raw)["kind"] == "full"
        assert strict_json(b'{"x":[0]}', 100) == {"x": [0]}
        assert parse_payload(b'{"type":"houseplan/config/set","config":{}}')["config"] == {}
    nested = b'[' * 65 + b'0' + b']' * 65
    with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0):
        with pytest.raises(InputLimit):
            strict_json(b'{"x":' + nested + b'}', 1000)
        with pytest.raises(UploadError) as error:
            parse_payload(b'{"type":"houseplan/config/set","config":{"x":' + nested + b'}}')
        assert error.value.code == "capacity_exceeded"


@pytest.mark.parametrize("raw", [b'{"x":1,"x":2}', b'{"x":NaN}', b'{"x":1e999}', b'{"x":-1e999}', b'{"x":', b'{"__proto__":{}}'])
def test_preflight_does_not_replace_the_canonical_strict_decoder(raw):
    with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0):
        with pytest.raises(import_export.ImportFailure):
            strict_json(raw, 1000)
        assert strict_json(b'{"x":1}', 1000) == {"x": 1}


@pytest.mark.parametrize("number", [b"1e999", b"-1e999"])
def test_overflowing_floats_are_rejected_at_all_json_ingress_points(tmp_path, number):
    base = json.dumps(document(tmp_path)).encode()
    raw = base.replace(b'"extra": null', b'"extra":' + number)
    with pytest.raises(import_export.ImportFailure) as portable:
        import_export.parse_document(raw)
    assert portable.value.code == "invalid_json"
    with pytest.raises(UploadError) as structural:
        parse_payload(b'{"type":"houseplan/config/set","config":{"x":' + number + b'}}')
    assert structural.value.code == "invalid_format"
    assert parse_payload(b'{"type":"houseplan/config/set","config":{"x":1e100}}')["config"]["x"] == 1e100


def test_request_budget_is_shared_and_never_reset_by_nested_calls():
    policy = replace(STRICT_INPUT_POLICY, geometry_units=3)
    with pytest.raises(InputLimit):
        with input_scope(policy, clock=lambda: 0) as budget:
            charge_work(2)
            with input_scope() as inner:
                assert inner is budget
                charge_work()
            charge_work()
    assert budget.used == 3
    assert current_policy() is HA_INPUT_POLICY
    with input_scope(policy, clock=lambda: 0) as fresh:
        assert fresh.used == 0
        with pytest.raises(ValueError):
            with input_scope(HA_INPUT_POLICY):
                pytest.fail("nested policy replacement was accepted")


def test_time_is_secondary_injected_and_checked_within_256_units():
    now = [0.0]
    with pytest.raises(InputLimit) as error:
        with input_scope(STRICT_INPUT_POLICY, clock=lambda: now[0]) as budget:
            charge_work()
            now[0] = 5.0
            checkpoint()  # The inclusive boundary remains allowed.
            now[0] = 5.000001
            for _ in range(256):
                charge_work()
    assert error.value.reason == "time"
    assert budget.used == 257


def test_cancellation_is_checked_before_any_owned_work():
    with pytest.raises(InputLimit) as error:
        with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0, cancel=lambda: True):
            pytest.fail("cancelled scope was entered")
    assert error.value.code == "zip_cancelled"
    assert current_policy() is HA_INPUT_POLICY


def test_real_graph_boundaries_and_two_calls_share_one_budget():
    graph = parallel_graph()
    original = copy.deepcopy(graph)
    with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0) as measured:
        assert len(validate_graph(graph).edges) == 12
    units = measured.used
    assert units > 66  # Includes actual intersection pairs and index/point work.
    for maximum in (units, units + 1):
        with input_scope(replace(STRICT_INPUT_POLICY, geometry_units=maximum), clock=lambda: 0):
            validate_graph(graph)
    with pytest.raises(InputLimit):
        with input_scope(replace(STRICT_INPUT_POLICY, geometry_units=units - 1), clock=lambda: 0):
            validate_graph(graph)
    with pytest.raises(InputLimit):
        with input_scope(replace(STRICT_INPUT_POLICY, geometry_units=2 * units - 1), clock=lambda: 0):
            validate_graph(graph)
            validate_graph(graph)
    assert graph == original
    assert integer(str(2**4095)).bit_length() == 4096
    with pytest.raises(GraphError, match="exact_number_limit"):
        integer(str(2**4096))


def test_strict_raster_requires_decoder_but_ha_keeps_its_existing_fallback(monkeypatch):
    original = builtins.__import__
    def without_pillow(name, *args, **kwargs):
        if name == "PIL" or name.startswith("PIL."):
            raise ImportError("fixture has no decoder")
        return original(name, *args, **kwargs)
    monkeypatch.setattr(builtins, "__import__", without_pillow)
    assert validate_asset(PNG_1X1, "pixel.png").width == 1
    with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0):
        with pytest.raises(DecorAssetError) as error:
            validate_asset(PNG_1X1, "pixel.png")
        assert error.value.code == "not_ready"


def test_strict_backdrop_rejects_active_svg_without_rewriting_ha_bytes():
    active = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    assert plan_image_ext(active, "plan.svg") == ".svg"
    with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0):
        with pytest.raises(InputLimit) as error:
            plan_image_ext(active, "plan.svg")
        assert error.value.reason == "strict_image_policy"
        assert plan_image_ext(b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><path d="M0 0L1 1"/></svg>', "plan.svg") == ".svg"
    assert b"<script>" in active


@pytest.mark.parametrize("body", [
    b'<script>alert(1)</script>', b'<g onload="alert(1)"/>',
    b'<foreignObject><div>active</div></foreignObject>',
    b'<use href="https://payload.invalid/source.svg#x"/>',
    b'<use href="data:image/svg+xml,active"/>',
    b'<path style="fill:url(https://payload.invalid/x)" d="M0 0L1 1"/>',
])
def test_svg_whitelist_refuses_active_content_without_network_access(body, monkeypatch):
    def forbidden(*_args, **_kwargs):
        raise AssertionError("input selected an outbound connection")
    monkeypatch.setattr(socket, "socket", forbidden)
    monkeypatch.setattr(urllib.request, "urlopen", forbidden)
    raw = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2">' + body + b'</svg>'
    before = bytes(raw)
    with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0):
        with pytest.raises(DecorAssetError):
            validate_asset(raw, "untrusted.svg")
        validate_asset(b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><path d="M0 0L1 1"/></svg>', "safe.svg")
    assert raw == before


@pytest.mark.parametrize("encoding", ["utf-8", "utf-16"])
def test_xml_depth_is_checked_by_encoding_aware_streaming_parser(encoding):
    # Root counts towards depth64; checking before ElementTree avoids allocating
    # an arbitrarily deep tree, including when ASCII substring scans cannot see it.
    def svg(levels):
        return ('<?xml version="1.0" encoding="' + encoding + '"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2">'
                + '<g>' * levels + '</g>' * levels + '</svg>').encode(encoding)
    with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0):
        assert validate_asset(svg(63), "safe.svg").width == 2
        with pytest.raises(InputLimit, match="capacity"):
            validate_asset(svg(64), "deep.svg")


def test_strict_archive_preserves_large_comment_bytes_without_claiming_larger_svg_content_limits(tmp_path):
    raw = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><!--' + b'x' * (3 * 1024**2) + b'--><path d="M0 0L1 1"/></svg>'
    root = tmp_path / "source"
    plan = root / "houseplan/plans/source.svg"
    plan.parent.mkdir(parents=True)
    plan.write_bytes(raw)
    config = {"spaces": [{"id": "floor", "title": "Floor", "rooms": [], "view_box": [0, 0, 1, 1],
                         "plan_url": "/api/houseplan/content/plans/_/source.svg", "plan_aspect": 1}],
              "markers": [], "settings": {}}
    exported, _ = import_export.create_export(
        SimpleNamespace(instance_id="policy-source", integration_version="test"), {"config": config},
        {"layout": {}}, kind="full", space_id=None, card_version="test", config_root=root,
    )
    archive = tmp_path / "backup.zip"
    build_archive(archive, exported, root, {})
    stage = tmp_path / "stage"
    stage.mkdir()
    with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0):
        parsed = read_archive(archive, stage)
    assert len(parsed.blobs) == 1
    assert next(iter(parsed.blobs.values())).read_bytes() == raw
    assert plan.read_bytes() == raw
    assert exported["payload"]["config"]["spaces"][0]["plan_url"].endswith("source.svg")
    assert expanded_size(archive) > len(raw)


def test_strict_backdrop_reports_decor_content_limit_without_changing_ha_acceptance():
    # Unlike the round-trip comment fixture, desc text survives canonical XML.
    raw = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><desc>' + b'x' * (3 * 1024**2) + b'</desc></svg>'
    assert plan_image_ext(raw, "plan.svg") == ".svg"
    with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0):
        with pytest.raises(InputLimit) as error:
            plan_image_ext(raw, "plan.svg")
        assert error.value.reason == "strict_image_policy"
        assert error.value.code == "capacity_exceeded"
    assert raw.endswith(b'</desc></svg>')
