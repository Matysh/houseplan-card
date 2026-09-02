"""#51 custom decor image security and lifecycle contracts."""
from __future__ import annotations

import base64
import json

import pytest

from custom_components.houseplan.decor_assets import (
    DecorAssetError,
    asset_refs,
    public_asset,
    read_catalog,
    validate_asset,
)


PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def test_png_identity_and_dimensions_are_content_addressed() -> None:
    asset = validate_asset(PNG_1X1, "pixel.PNG")
    assert (asset.mime, asset.ext, asset.width, asset.height) == ("image/png", ".png", 1, 1)
    assert len(asset.asset_id) == 64
    assert asset.asset_id == validate_asset(PNG_1X1, "other.png").asset_id


def test_declared_mime_must_agree_with_extension_and_bytes() -> None:
    with pytest.raises(DecorAssetError, match="disagree"):
        validate_asset(PNG_1X1, "pixel.png", "image/jpeg")
    assert validate_asset(PNG_1X1, "pixel.png", "image/png; charset=binary").width == 1


@pytest.mark.parametrize("payload", [
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><script/></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20" onload="alert(1)"/>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><image href="https://example.com/x"/></svg>',
    b'<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg viewBox="0 0 1 1"/>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><mask id="a"><g mask="url(#b)"/></mask><mask id="b"><g mask="url(#a)"/></mask></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" xmlns:e="urn:evil" viewBox="0 0 10 20"><e:path d="M0 0L1 1"/></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><?evil payload?></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><foreignObject/></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><animate/></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><path style="fill:url(https://example.com/x)"/></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><linearGradient id="a" href="https://example.com/x"/></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><path fill="url(#missing)"/></svg>',
    b'<svg viewBox="0 0 10 20"><path d="M0 0L1 1"/></svg>',
])
def test_svg_rejects_the_whole_unsafe_document(payload: bytes) -> None:
    with pytest.raises(DecorAssetError):
        validate_asset(payload, "unsafe.svg")


def test_svg_canonicalizes_safe_geometry_and_requires_aspect_ratio() -> None:
    asset = validate_asset(
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><path d="M0 0L1 1"/></svg>',
        "safe.svg",
    )
    assert (asset.width, asset.height, asset.mime) == (30, 20, "image/svg+xml")
    with pytest.raises(DecorAssetError, match="dimensions"):
        validate_asset(b'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>', "bad.svg")


def test_svg_preserves_safe_local_gradient_clip_mask_and_transparency() -> None:
    asset = validate_asset(b'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">
      <defs>
        <linearGradient id="base"><stop offset="0" stop-color="#fff" stop-opacity=".5"/></linearGradient>
        <linearGradient id="derived" href="#base"/>
        <clipPath id="clip"><rect width="20" height="20"/></clipPath>
        <mask id="mask"><circle cx="10" cy="10" r="8" fill="#fff"/></mask>
      </defs>
      <path d="M0 0L30 0L30 20Z" fill="url(#derived)" clip-path="url(#clip)"
        mask="url(#mask)" opacity=".8"/>
    </svg>''', "safe.svg", "image/svg+xml")
    assert asset.data.startswith(b'<svg xmlns="http://www.w3.org/2000/svg"')
    assert validate_asset(asset.data, "again.svg").asset_id == asset.asset_id


def test_svg_resource_limits_fail_closed() -> None:
    too_deep = (
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">'
        + b'<g>' * 65 + b'</g>' * 65 + b'</svg>'
    )
    too_many = (
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">'
        + b'<g/>' * 5000 + b'</svg>'
    )
    for payload in (too_deep, too_many):
        with pytest.raises(DecorAssetError, match="safety limit"):
            validate_asset(payload, "bounded.svg")


def test_valid_looking_but_truncated_raster_is_rejected_by_full_decode() -> None:
    with pytest.raises(DecorAssetError, match="corrupt|decode"):
        validate_asset(PNG_1X1[:33], "truncated.png", "image/png")


def test_catalog_ignores_missing_or_malformed_sidecars(tmp_path) -> None:
    aid = "a" * 64
    (tmp_path / f"{aid}.png").write_bytes(PNG_1X1)
    row = {"asset_id": aid, "ext": ".png", "mime": "image/png", "width": 1, "height": 1}
    (tmp_path / f"{aid}.json").write_text(json.dumps(row), encoding="utf-8")
    (tmp_path / "broken.json").write_text("{", encoding="utf-8")
    assert read_catalog(tmp_path) == [row]
    assert public_asset(row)["url"].endswith(f"/assets/_/{aid}.png")


def test_reference_scan_is_cross_space_and_image_only() -> None:
    aid = "b" * 64
    refs = asset_refs({"spaces": [
        {"id": "one", "decor": [{"id": "a", "kind": "image", "asset_id": aid}]},
        {"id": "two", "decor": [
            {"id": "b", "kind": "image", "asset_id": aid},
            {"id": "c", "kind": "furniture", "asset_id": aid},
        ]},
    ]})
    assert refs[aid] == [
        {"space_id": "one", "decor_id": "a"},
        {"space_id": "two", "decor_id": "b"},
    ]
