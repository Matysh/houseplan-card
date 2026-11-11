"""#1387: negotiate actual HTTP bytes through the production HA view."""
import base64
import gzip
import json

import pytest
from homeassistant.setup import async_setup_component

from custom_components.houseplan import frontend_assets
from custom_components.houseplan.const import FRONTEND_ASSETS_URL


@pytest.fixture
async def assets(hass, hass_client, tmp_path, monkeypatch):
    root = tmp_path / "frontend"
    raw = b"export const answer=42;\n" * 1000
    # Fixed Brotli fixture; build tests independently decode generated variants.
    br = base64.b64decode("G79d+I3UYy0xWEpPlupDNs20ZKobglAogl6rE0xxfnMOwdpDilUBuIoB")
    bodies = {None: raw, "gzip": gzip.compress(raw, mtime=0), "br": br}
    rows = []
    for encoding, body in bodies.items():
        relative = (f"houseplan-encoded/{encoding}/main-HASH.js" if encoding
                    else "houseplan-assets/main-HASH.js")
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        if encoding:
            rows.append({"source": "houseplan-assets/main-HASH.js", "path": relative,
                         "encoding": encoding})
    manifest = {"schema": 1, "files": [{"path": "houseplan-assets/main-HASH.js"}],
                "encodings": rows}
    (root / "houseplan-assets.json").write_text(json.dumps(manifest))
    monkeypatch.setattr(frontend_assets, "_FRONTEND_ROOT", root)
    assert await async_setup_component(hass, "http", {})
    hass.http.register_view(frontend_assets.HouseplanFrontendAssetView)
    return await hass_client(), root, manifest, bodies


@pytest.mark.parametrize(("accept", "encoding"), [
    ("", None), ("identity", None), ("gzip", "gzip"), ("gzip, br", "br"),
    ("br;q=0.3, gzip;q=0.8", "gzip"), ("gzip;q=0, br;q=0", None),
    ("GZip;Q=1", "gzip"), ("*;q=0.5, gzip;q=0", "br"),
    ("identity;q=1, gzip;q=0.5", None),
])
async def test_negotiation_and_exact_wire_bytes(assets, accept, encoding):
    client, _, _, bodies = assets
    response = await client.get(f"{FRONTEND_ASSETS_URL}/main-HASH.js",
                                headers={"Accept-Encoding": accept}, auto_decompress=False)
    assert response.status == 200
    body = await response.read()
    assert body == bodies[encoding]
    if encoding == "gzip":
        assert gzip.decompress(body) == bodies[None]
    assert response.headers.get("Content-Encoding") == encoding
    assert response.headers["Vary"] == "Accept-Encoding"
    assert response.headers["Content-Type"].startswith("text/javascript")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Cache-Control"] == "public, max-age=31536000, immutable"
    assert int(response.headers["Content-Length"]) == len(body)


async def test_conditional_head_ranges_and_representation_switch(assets):
    client, _, _, bodies = assets
    url = f"{FRONTEND_ASSETS_URL}/main-HASH.js"
    gzip_headers = {"Accept-Encoding": "gzip"}
    first = await client.get(url, headers=gzip_headers, auto_decompress=False)
    assert await first.read() == bodies["gzip"]
    cached = await client.get(url, headers={**gzip_headers, "If-None-Match": first.headers["ETag"]})
    assert cached.status == 304 and await cached.read() == b""
    assert cached.headers["Vary"] == "Accept-Encoding"
    identity = await client.get(url, headers={"Accept-Encoding": "identity",
                                              "If-None-Match": first.headers["ETag"]})
    assert identity.status == 200 and await identity.read() == bodies[None]
    head = await client.head(url, headers=gzip_headers, auto_decompress=False)
    assert head.status == 200 and await head.read() == b""
    assert head.headers["Content-Encoding"] == "gzip"
    assert head.headers["Content-Length"] == first.headers["Content-Length"]
    part = await client.get(url, headers={**gzip_headers, "Range": "bytes=0-9"}, auto_decompress=False)
    assert part.status == 206 and await part.read() == bodies["gzip"][:10]


async def test_old_manifest_missing_variant_and_no_acceptable_representation(assets):
    client, root, manifest, bodies = assets
    url = f"{FRONTEND_ASSETS_URL}/main-HASH.js"
    refused = await client.get(url, headers={"Accept-Encoding": "*;q=0"})
    assert refused.status == 406
    (root / "houseplan-encoded/gzip/main-HASH.js").unlink()
    fallback = await client.get(url, headers={"Accept-Encoding": "gzip"})
    assert fallback.status == 200 and await fallback.read() == bodies[None]
    refused = await client.get(url, headers={"Accept-Encoding": "gzip, identity;q=0"})
    assert refused.status == 406
    manifest.pop("encodings")
    (root / "houseplan-assets.json").write_text(json.dumps(manifest))
    legacy = await client.get(url, headers={"Accept-Encoding": "br, gzip"})
    assert legacy.status == 200 and await legacy.read() == bodies[None]
    assert "Content-Encoding" not in legacy.headers


async def test_unknown_assets_and_encoded_paths_are_not_public(assets):
    client, _, _, _ = assets
    for name in ("old-HASH.js", "houseplan-assets.json", "../houseplan-assets.json",
                 "houseplan-encoded/gzip/main-HASH.js", "main-HASH.js.gz"):
        response = await client.get(f"{FRONTEND_ASSETS_URL}/{name}")
        assert response.status == 404
