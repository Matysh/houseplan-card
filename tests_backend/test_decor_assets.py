"""#51 custom decor image security and lifecycle contracts."""
from __future__ import annotations

import base64
import json

import pytest

from custom_components.houseplan.decor_assets import (
    DecorAssetError,
    asset_meta_path,
    asset_refs,
    public_asset,
    read_catalog,
    validate_asset,
)

PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
JPEG_3X2 = base64.b64decode(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAMDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDx2iiiu04z/9k="
)
WEBP_VP8_3X2 = base64.b64decode(
    "UklGRjAAAABXRUJQVlA4ICQAAABQAQCdASoDAAIAAUAmJQBOgC6gAP77LkvF3YjjJ4dVU9ffoAA="
)
WEBP_VP8L_3X2 = base64.b64decode(
    "UklGRh4AAABXRUJQVlA4TBEAAAAvAkAAAAdQkTIUp/+BiOh/AAA="
)
WEBP_VP8X_3X2 = base64.b64decode(
    "UklGRlIAAABXRUJQVlA4WAoAAAAQAAAAAgAAAQAAQUxQSAcAAAAAgICAgICAAFZQOCAkAAAAUAEAnQEqAwACAAFAJiUAToAuoAD++y5Lxd2I4yeHVVPX36AA"
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


@pytest.mark.parametrize(("payload", "filename", "mime"), [
    (JPEG_3X2, "photo.jpeg", "image/jpeg"),
    (WEBP_VP8_3X2, "lossy.webp", "image/webp"),
    (WEBP_VP8L_3X2, "lossless.webp", "image/webp"),
    (WEBP_VP8X_3X2, "alpha.webp", "image/webp"),
])
def test_supported_raster_headers_and_full_decode(
    payload: bytes, filename: str, mime: str,
) -> None:
    asset = validate_asset(payload, filename, "application/octet-stream")
    assert (asset.width, asset.height, asset.mime) == (3, 2, mime)


def test_upload_size_and_extension_guards() -> None:
    with pytest.raises(DecorAssetError, match="empty"):
        validate_asset(b"", "empty.png")
    with pytest.raises(DecorAssetError, match="2 MiB"):
        validate_asset(b"x" * (2 * 1024 * 1024 + 1), "large.png")
    with pytest.raises(DecorAssetError, match="PNG, JPEG, WebP or SVG"):
        validate_asset(PNG_1X1, "pixel.gif")


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


def test_svg_utf16_doctype_is_rejected_before_entity_expansion() -> None:
    payload = '''<?xml version="1.0" encoding="UTF-16"?>
      <!DOCTYPE svg [
        <!ENTITY a "0123456789">
        <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">
        <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">
      ]>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">
        <path d="&c;"/>
      </svg>'''.encode("utf-16")
    with pytest.raises(DecorAssetError, match="DTD, entities"):
        validate_asset(payload, "encoded.svg")


def test_svg_canonicalizes_safe_geometry_and_requires_aspect_ratio() -> None:
    asset = validate_asset(
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><path d="M0 0L1 1"/></svg>',
        "safe.svg",
    )
    assert (asset.width, asset.height, asset.mime) == (30, 20, "image/svg+xml")
    with pytest.raises(DecorAssetError, match="dimensions"):
        validate_asset(b'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>', "bad.svg")


def test_svg_dimension_and_text_boundaries_fail_closed() -> None:
    with pytest.raises(DecorAssetError, match="viewBox"):
        validate_asset(
            b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10"><path/></svg>',
            "bad.svg",
        )
    with pytest.raises(DecorAssetError, match="dimensions"):
        validate_asset(
            b'<svg xmlns="http://www.w3.org/2000/svg" width="bad" height="20"><path/></svg>',
            "bad.svg",
        )
    with pytest.raises(DecorAssetError, match="safety limit"):
        validate_asset(
            b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20000 1"><path/></svg>',
            "large.svg",
        )
    with pytest.raises(DecorAssetError, match="SVG text"):
        validate_asset(
            b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path>text</path></svg>',
            "text.svg",
        )


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


@pytest.mark.parametrize("attribute", [
    'opacity="NaN"', 'opacity="1.1"', 'stop-opacity="101%"', 'offset="-0.1"',
])
def test_svg_rejects_non_finite_or_out_of_range_unit_values(attribute: str) -> None:
    tag = "stop" if attribute.startswith(("stop", "offset")) else "path"
    payload = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">'
        f'<{tag} {attribute}/></svg>'
    ).encode()
    with pytest.raises(DecorAssetError, match="invalid|range"):
        validate_asset(payload, "bounded.svg")


def test_svg_rejects_one_oversized_attribute_before_tree_use() -> None:
    payload = (
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="'
        + b"M" * 65_537 + b'"/></svg>'
    )
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


def test_catalog_empty_directory_and_metadata_path(tmp_path) -> None:
    missing = tmp_path / "missing"
    aid = "c" * 64
    assert read_catalog(missing) == []
    assert asset_meta_path(tmp_path, aid) == tmp_path / f"{aid}.json"


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


def test_reference_scan_skips_malformed_spaces_and_asset_ids() -> None:
    assert asset_refs({"spaces": [None, {"decor": [None, {
        "kind": "image", "asset_id": "not-a-content-hash",
    }]}]}) == {}
