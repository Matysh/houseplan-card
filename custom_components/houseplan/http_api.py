"""HTTP endpoint for uploading House Plan manual files.

Files (PDF and the like) are uploaded not over WebSocket (its message size limit
breaks the connection on a large PDF) but via a plain multipart POST — like media in HA itself.
"""
from __future__ import annotations

import logging
from pathlib import Path

from aiohttp import web

from homeassistant.components.http import HomeAssistantView

try:  # KEY_HASS — the modern way to access hass from the aiohttp application
    from homeassistant.components.http import KEY_HASS
except ImportError:  # older HA versions
    KEY_HASS = "hass"  # type: ignore[assignment]
from homeassistant.core import HomeAssistant

from .const import CONF_ADMIN_ONLY, CONTENT_URL, FILES_DIR, FILES_URL, PLANS_DIR
from .auth import may_write
from .validation import (
    FILE_EXTENSIONS,
    MAX_FILE_BYTES,
    file_ext,
    sanitize_filename,
    sanitize_marker_id,
)

_LOGGER = logging.getLogger(__name__)

_CHUNK = 64 * 1024

_MIME = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".txt": "text/plain",
}


class HouseplanContentView(HomeAssistantView):
    """Authenticated read access to plans and marker files (audit B1).

    The directories used to be exposed as unauthenticated static paths, so
    anyone who could reach the HA endpoint could pull floor plans and uploaded
    manuals without logging in. This view keeps the same URLs but requires a
    Home Assistant session (or a signed path, which the frontend uses for
    <image href> inside the SVG).
    """

    url = "/api/houseplan/content/{kind}/{sub}/{name}"
    name = "api:houseplan:content"
    requires_auth = True

    async def get(self, request: web.Request, kind: str, sub: str, name: str) -> web.StreamResponse:
        hass: HomeAssistant = request.app[KEY_HASS]
        if kind not in ("plans", "files"):
            return web.Response(status=404)
        safe_sub = sanitize_marker_id(sub)
        safe_name = sanitize_filename(name)
        if not safe_sub or not safe_name:
            return web.Response(status=404)
        base = Path(hass.config.path(PLANS_DIR if kind == "plans" else FILES_DIR)).resolve()
        # plans live flat in one directory: the sub segment is a placeholder ("_")
        path = (base / safe_name if kind == "plans" else base / safe_sub / safe_name).resolve()
        # defence in depth: the sanitizers already strip separators
        if not str(path).startswith(str(base)):
            return web.Response(status=404)

        def _read() -> bytes | None:
            return path.read_bytes() if path.is_file() else None

        blob = await hass.async_add_executor_job(_read)
        if blob is None:
            return web.Response(status=404)
        return web.Response(
            body=blob,
            content_type=_MIME.get(path.suffix.lower(), "application/octet-stream"),
            headers={"Cache-Control": "private, max-age=3600"},
        )


class HouseplanUploadView(HomeAssistantView):
    """POST /api/houseplan/upload — save a marker file, return its URL."""

    url = "/api/houseplan/upload"
    name = "api:houseplan:upload"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app[KEY_HASS]
        if not may_write(hass, request.get("hass_user")):
            return web.json_response({"error": "unauthorized"}, status=403)

        marker_id = "misc"
        filename: str | None = None
        blob: bytes | None = None
        too_large = False
        try:
            reader = await request.multipart()
            async for part in reader:
                if part.name == "marker_id":
                    marker_id = sanitize_marker_id(await part.text())
                elif part.name == "file":
                    filename = part.filename or "file"
                    # read in chunks, aborting at the limit, instead of loading the whole file into memory
                    chunks: list[bytes] = []
                    size = 0
                    while chunk := await part.read_chunk(_CHUNK):
                        size += len(chunk)
                        if size > MAX_FILE_BYTES:
                            too_large = True
                            break
                        chunks.append(chunk)
                    if too_large:
                        break
                    blob = b"".join(chunks)
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("House Plan upload: multipart read error: %s", err)
            return web.json_response({"error": "bad_request"}, status=400)

        if too_large:
            return web.json_response(
                {"error": "too_large", "max_mb": MAX_FILE_BYTES // 1024 // 1024}, status=413
            )
        if blob is None or not filename:
            return web.json_response({"error": "no_file"}, status=400)
        ext = file_ext(filename)
        if ext not in FILE_EXTENSIONS:
            return web.json_response(
                {"error": "bad_ext", "allowed": sorted(FILE_EXTENSIONS)}, status=400
            )

        safe_name = sanitize_filename(filename)
        target_dir = Path(hass.config.path(FILES_DIR)) / marker_id
        path = target_dir / safe_name

        def _write() -> int:
            target_dir.mkdir(parents=True, exist_ok=True)
            path.write_bytes(blob)
            return int(path.stat().st_mtime)

        mtime = await hass.async_add_executor_job(_write)
        return web.json_response(
            {"ok": True, "url": f"{CONTENT_URL}/files/{marker_id}/{safe_name}?v={mtime}", "name": filename}
        )
