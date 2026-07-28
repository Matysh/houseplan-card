"""HTTP endpoint for uploading House Plan manual files.

Files (PDF and the like) are uploaded not over WebSocket (its message size limit
breaks the connection on a large PDF) but via a plain multipart POST — like media in HA itself.
"""
from __future__ import annotations

import logging
import os
import tempfile
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
from .plans import TMP_PREFIX, reserve_filename
from .validation import (
    FILE_EXTENSIONS,
    MAX_FILE_BYTES,
    file_ext,
    sanitize_filename,
    sanitize_marker_id,
)

_LOGGER = logging.getLogger(__name__)

_CHUNK = 64 * 1024
# batch disk writes: one executor job per megabyte instead of per chunk
_FLUSH_AT = 1024 * 1024

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

        if not await hass.async_add_executor_job(path.is_file):
            return web.Response(status=404)
        suffix = path.suffix.lower()
        headers = {
            "Cache-Control": "private, max-age=3600",
            "Content-Type": _MIME.get(suffix, "application/octet-stream"),
        }
        if suffix == ".svg":
            # An uploaded SVG is user content served from Home Assistant's own
            # origin. Inside the card it is referenced by <image>, where scripts
            # never run — but the same url opened as a top-level document is a
            # live document of this origin, and a <script> in it reaches the
            # session's localStorage and API (HP-1454-01, 2026-07-28: uploading
            # needs write access, which by default every authenticated user has,
            # and the signed url is easy to hand to an admin).
            #
            # `sandbox` with no allow-* tokens drops the document into an opaque
            # origin: no scripts, no same-origin access, no forms. The explicit
            # directives below are belt and braces for older engines. Only SVG
            # gets this — a CSP on a PDF response can break the browser's built-in
            # viewer, and a raster image cannot execute anything in the first place.
            headers["Content-Security-Policy"] = (
                "sandbox; default-src 'none'; script-src 'none'; object-src 'none'; "
                "base-uri 'none'; form-action 'none'; style-src 'unsafe-inline'; img-src data:"
            )
        # FileResponse streams from disk: a 50 MB manual used to be read whole
        # into memory and copied into the response body, so a couple of parallel
        # downloads could push a small Home Assistant host into swap (HP-1454-06).
        return web.FileResponse(path, chunk_size=_CHUNK, headers=headers)


class HouseplanUploadView(HomeAssistantView):
    """POST /api/houseplan/upload — save a marker file, return its URL."""

    url = "/api/houseplan/upload"
    name = "api:houseplan:upload"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app[KEY_HASS]
        if not may_write(hass, request.get("hass_user")):
            return web.json_response({"error": "unauthorized"}, status=403)

        files_root = Path(hass.config.path(FILES_DIR))
        marker_id = "misc"
        filename: str | None = None
        # Every temporary file this request creates, promoted or not. The outer
        # `finally` removes whatever is left: a dropped connection, a second
        # `file` part or a failure while promoting used to leave a `.upload-*`
        # behind for good, and the collector only ever walks marker folders, so
        # nothing would have picked it up (HP-1460-02).
        temps: list[Path] = []
        error: tuple[dict, int] | None = None

        def _new_tmp() -> Path:
            files_root.mkdir(parents=True, exist_ok=True)
            fd, name = tempfile.mkstemp(prefix=TMP_PREFIX, dir=str(files_root))
            os.close(fd)
            return Path(name)

        def _flush(target: Path, blocks: list[bytes]) -> None:
            with open(target, "ab") as fh:
                for block in blocks:
                    fh.write(block)

        def _cleanup(paths: list[Path]) -> None:
            for path in paths:
                try:
                    path.unlink()
                except OSError:
                    pass

        try:
            try:
                reader = await request.multipart()
                async for part in reader:
                    if part.name == "marker_id":
                        marker_id = sanitize_marker_id(await part.text())
                    elif part.name == "file":
                        if filename is not None:
                            # one upload per request: a second part would strand
                            # the first temporary file and make the response
                            # ambiguous about which url was returned
                            error = ({"error": "one_file_only"}, 400)
                            break
                        filename = part.filename or "file"
                        if file_ext(filename) not in FILE_EXTENSIONS:
                            error = ({"error": "bad_ext", "allowed": sorted(FILE_EXTENSIONS)}, 400)
                            break
                        # Stream to a temporary file instead of collecting the
                        # whole upload in memory and copying it again into one
                        # buffer: a 50 MB manual used to cost ~100 MB of RSS
                        # mid-request (HP-1454-06). Blocks are batched so this
                        # is one executor job per megabyte, not per 64 KB.
                        tmp = await hass.async_add_executor_job(_new_tmp)
                        temps.append(tmp)
                        size = 0
                        pending: list[bytes] = []
                        buffered = 0
                        while chunk := await part.read_chunk(_CHUNK):
                            size += len(chunk)
                            if size > MAX_FILE_BYTES:
                                error = (
                                    {"error": "too_large", "max_mb": MAX_FILE_BYTES // 1024 // 1024},
                                    413,
                                )
                                break
                            pending.append(chunk)
                            buffered += len(chunk)
                            if buffered >= _FLUSH_AT:
                                await hass.async_add_executor_job(_flush, tmp, pending)
                                pending, buffered = [], 0
                        if error:
                            break
                        if pending:
                            await hass.async_add_executor_job(_flush, tmp, pending)
            except Exception as err:  # noqa: BLE001
                _LOGGER.warning("House Plan upload: multipart read error: %s", err)
                error = ({"error": "bad_request"}, 400)

            if error:
                return web.json_response(error[0], status=error[1])
            if not temps or not filename:
                return web.json_response({"error": "no_file"}, status=400)

            tmp_path = temps[0]
            target_dir = files_root / marker_id
            safe_name = filename

            def _promote() -> str:
                """Claim a free name, then move the finished upload onto it.

                Never overwrite an existing attachment: its bytes may be
                referenced by the stored configuration, and this upload is not
                part of that transaction — a cancelled dialog or a rejected save
                would leave the old url serving the new content (HP-1454-02).
                The name is reserved atomically, so two uploads racing on the
                same filename cannot agree on it (HP-1460-01).
                """
                name = reserve_filename(target_dir, safe_name)
                try:
                    os.replace(tmp_path, target_dir / name)
                except OSError:
                    (target_dir / name).unlink(missing_ok=True)
                    raise
                return name

            try:
                name = await hass.async_add_executor_job(_promote)
            except OSError as err:
                _LOGGER.warning("House Plan upload: could not store the file: %s", err)
                return web.json_response({"error": "io_error"}, status=500)
            temps.remove(tmp_path)  # it is the attachment now, not a temporary
            return web.json_response(
                {"ok": True, "url": f"{CONTENT_URL}/files/{marker_id}/{name}", "name": filename}
            )
        finally:
            # BaseException too: cancelling the request task raises
            # asyncio.CancelledError, which an `except Exception` never saw —
            # an aborted large upload leaked its temporary file every time
            if temps:
                await hass.async_add_executor_job(_cleanup, list(temps))
