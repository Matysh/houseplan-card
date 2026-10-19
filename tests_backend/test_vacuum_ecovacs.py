"""#939 SVG geometry, actual compact grammar and ordinary negative inputs."""
import base64

import pytest

from pure_imports import HOUSEPLAN_ROOT, load_pure
from ecovacs_fixtures import png, svg

codec = load_pure("hp_vacuum_ecovacs_939", HOUSEPLAN_ROOT / "vacuum_ecovacs.py")


def test_actual_svg_grammar_keeps_shared_coordinates_and_move_gaps():
    value = codec.decode_ecovacs_svg(svg())
    assert value.position == {"x": 3, "y": -4}
    assert value.bounds == (-10, -20, 100, 80)
    assert value.paths == [
        [[2, -4], [3, -3], [4, -3], [4, -5]], [[6, -7], [5, -6]],
    ]
    assert value.png.startswith("data:image/png;base64,")
    assert b"must not be returned" not in base64.b64decode(value.png.split(",")[1])
    assert value.preview_reason is None
    assert value.digest == codec.decode_ecovacs_svg(svg()).digest
    assert value.digest != codec.decode_ecovacs_svg(svg(position="10 20")).digest


@pytest.mark.parametrize("path,expected", [
    ("M1e1,2e1 15,15 H20V25m10,10-5-5", [[[2, -4], [3, -3], [4, -3], [4, -5]], [[6, -7], [5, -6]]]),
    ("m0 0h5-5 5v5-5", [[[0, 0], [1, 0], [0, 0], [1, 0], [1, -1], [1, 0]]]),
    ("M0 0L0 0 1 1", [[[0, 0], [.2, -.2]]]),
    ("", []),
])
def test_paths_preserve_revisits_and_support_implicit_compact_values(path, expected):
    assert codec.trace_path(path, "scale(0.2-0.2)") == expected


def test_empty_renderer_and_missing_robot_have_distinct_valid_meanings():
    assert codec.decode_ecovacs_svg(svg(None)).paths == []
    no_robot = codec.decode_ecovacs_svg(svg(position=None))
    assert no_robot.position is None and no_robot.paths


@pytest.mark.parametrize("path", [
    "M0", "M0 0L", "M0 0L L1 1", "L0 0", "M0 0Q1 2 3 4", "M0 0Z",
    "Mnan 0", "M1e999 0", "M0 0x1 1", "M0 0;L1 1", "M0 0<garbage>",
])
def test_invalid_path_is_error_never_empty_or_a_guessed_connector(path):
    with pytest.raises(codec.EcovacsRejected):
        codec.trace_path(path, "scale(0.2-0.2)")


@pytest.mark.parametrize("transform", ["", "matrix(1 0 0 1 0 0)", "scale(0)", "scale(NaN)", "scale(1 1) rotate(1)"])
def test_unsupported_transform_is_not_a_coordinate_guess(transform):
    with pytest.raises(codec.EcovacsRejected):
        codec.trace_path("M0 0L1 1", transform)


@pytest.mark.parametrize("extra", [
    '<script>alert(1)</script>', '<foreignObject/>', '<image href="https://evil.test/a.png"/>',
    '<use href="file:///private"/>', '<g onload="alert(1)"/>', '<style>@import "https://evil.test";</style>',
    '<style>svg{transform:scale(9)}</style>', '<g id="d"/>', '<use href="#d" x="1" y="2"/>',
])
def test_unsafe_and_ambiguous_svg_is_rejected_without_resource_reads(extra):
    with pytest.raises(codec.EcovacsRejected):
        codec.decode_ecovacs_svg(svg(extra=extra))


def test_resource_limits_and_xml_entities_are_actual_negative_inputs():
    with pytest.raises(codec.EcovacsRejected):
        codec.decode_ecovacs_svg(b'<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///private">]>' + svg())
    with pytest.raises(codec.EcovacsRejected):
        codec.decode_ecovacs_svg(('<!DOCTYPE svg [<!ENTITY x "expanded">]>' + svg().decode()).encode('utf-16'))
    with pytest.raises(codec.EcovacsRejected, match="limited"):
        codec.decode_ecovacs_svg(svg(extra="<g/>" * codec.MAX_NODES))
    with pytest.raises(codec.EcovacsRejected, match="limited"):
        codec.decode_ecovacs_svg(b" " * (codec.MAX_SVG_BYTES + 1))
    with pytest.raises(codec.EcovacsRejected, match="limited"):
        codec.trace_path("M0 0L" + "1 1 " * codec.MAX_POINTS, "scale(1)")
    with pytest.raises(codec.EcovacsRejected, match="limited"):
        codec.trace_path("M0 0" * (codec.MAX_SEGMENTS + 1), "scale(1)")


def test_invalid_preview_does_not_destroy_usable_position_and_path():
    value = codec.decode_ecovacs_svg(svg(image=b"not a png"))
    assert value.png is None and value.preview_reason == "preview_unsupported"
    assert value.position and value.paths
    large = codec.decode_ecovacs_svg(svg(image=png(width=4097)))
    assert large.png is None and large.preview_reason == "limited"
    bad_crc = bytearray(png())
    bad_crc[-1] ^= 1
    assert codec.decode_ecovacs_svg(svg(image=bytes(bad_crc))).png is None
