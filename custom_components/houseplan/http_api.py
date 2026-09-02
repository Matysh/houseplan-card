"""HTTP endpoint for uploading House Plan manual files.

Files (PDF and the like) are uploaded not over WebSocket (its message size limit
breaks the connection on a large PDF) but via a plain multipart POST — like media in HA itself.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import tempfile
from datetime import datetime, timezone
from functools import partial
from pathlib import Path

from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

try:  # KEY_HASS — the modern way to access hass from the aiohttp application
    from homeassistant.components.http import KEY_HASS
except ImportError:  # older HA versions
    KEY_HASS = "hass"  # type: ignore[assignment]

from .auth import may_write
from .const import (
    ASSETS_DIR,
    CONTENT_URL,
    FILES_DIR,
    MAX_DECOR_ASSET_BYTES,
    MAX_DECOR_ASSETS_BYTES,
    MAX_DECOR_ASSETS_COUNT,
    MAX_EXPORT_BYTES,
    MAX_FILES_BYTES,
    MAX_FILES_COUNT,
    MIN_FREE_BYTES,
    PLANS_DIR,
)
from .decor_assets import (
    ASSET_EXTENSIONS,
    ASSET_ID_RE,
    DecorAssetError,
    asset_meta_path,
    public_asset,
    read_catalog,
    validate_asset,
)
from .import_export import ImportFailure, create_preview
from .plans import TMP_PREFIX, QuotaError, check_quota, reserve_filename
from .registry_snapshot import import_registry_snapshot
from .store import get_data
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


class HouseplanImportPreviewView(HomeAssistantView):
    """Upload a bounded JSON backup and return a server-side preview token."""

    url = "/api/houseplan/import/preview"
    name = "api:houseplan:import-preview"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app[KEY_HASS]
        user = request.get("hass_user")
        if not may_write(hass, user):
            return web.json_response({"error": "unauthorized"}, status=403)
        runtime = get_data(hass)
        if runtime is None:
            return web.json_response({"error": "not_ready"}, status=503)
        policy = request.query.get("duplicate_policy", "skip")
        if policy not in ("skip", "virtual"):
            return web.json_response({"error": "invalid_format"}, status=400)
        declared = request.content_length
        if declared is not None and declared > MAX_EXPORT_BYTES:
            return web.json_response({"error": "too_large"}, status=413)
        blocks: list[bytes] = []
        size = 0
        async for block in request.content.iter_chunked(_CHUNK):
            size += len(block)
            if size > MAX_EXPORT_BYTES:
                return web.json_response({"error": "too_large"}, status=413)
            blocks.append(block)
        owner_id = str(getattr(user, "id", ""))
        try:
            # Hold the global writer only while taking one coherent store
            # snapshot. Parsing up to 8 MiB, schema validation and space remap
            # are CPU work and apply will revalidate both revisions anyway.
            async with runtime.write_lock:
                config_data = await runtime.config_store.async_load() or {}
                layout_data = await runtime.store.async_load() or {}
            try:
                registry_snapshot = import_registry_snapshot(hass)
            except Exception:  # noqa: BLE001 - summary must not block a valid backup
                _LOGGER.debug("House Plan import registry summary unavailable", exc_info=True)
                registry_snapshot = None
            result = await hass.async_add_executor_job(
                partial(
                    create_preview,
                    runtime,
                    b"".join(blocks),
                    owner_id=owner_id,
                    duplicate_policy=policy,
                    current_config_data=config_data,
                    current_layout_data=layout_data,
                    config_root=Path(hass.config.path("")),
                    registry_snapshot=registry_snapshot,
                )
            )
        except ImportFailure as err:
            status = 413 if err.code == "too_large" else 400
            return web.json_response({"error": err.code, "message": err.message}, status=status)
        except Exception:  # noqa: BLE001 - the HTTP boundary must answer 400, never leak a traceback
            _LOGGER.exception("House Plan import preview failed")
            return web.json_response({"error": "invalid_format"}, status=400)
        return web.json_response(result)


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
        if kind not in ("plans", "files", "assets"):
            return web.Response(status=404)
        safe_sub = sanitize_marker_id(sub)
        safe_name = sanitize_filename(name)
        if not safe_sub or not safe_name:
            return web.Response(status=404)
        root_dir = PLANS_DIR if kind == "plans" else ASSETS_DIR if kind == "assets" else FILES_DIR
        base = Path(hass.config.path(root_dir)).resolve()
        # plans live flat in one directory: the sub segment is a placeholder ("_")
        if kind == "assets":
            stem, suffix = Path(safe_name).stem, Path(safe_name).suffix.lower()
            if safe_sub != "_" or not ASSET_ID_RE.fullmatch(stem) or suffix not in ASSET_EXTENSIONS:
                return web.Response(status=404)
            path = (base / safe_name).resolve()
        else:
            path = (base / safe_name if kind == "plans" else base / safe_sub / safe_name).resolve()
        # defence in depth: the sanitizers already strip separators
        if not str(path).startswith(str(base)):
            return web.Response(status=404)

        if not await hass.async_add_executor_job(path.is_file):
            return web.Response(status=404)
        suffix = path.suffix.lower()
        if kind == "assets":
            try:
                digest = await hass.async_add_executor_job(
                    lambda: hashlib.sha256(path.read_bytes()).hexdigest(),
                )
            except OSError:
                return web.Response(status=404)
            if digest != path.stem:
                return web.Response(status=404)
        headers = {
            "Cache-Control": "private, max-age=31536000, immutable"
                if kind == "assets" else "private, max-age=3600",
            "Content-Type": _MIME.get(suffix, "application/octet-stream"),
            "X-Content-Type-Options": "nosniff",
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


class HouseplanDecorAssetUploadView(HomeAssistantView):
    """POST one bounded custom decor image and return its catalog row."""

    url = "/api/houseplan/assets/upload"
    name = "api:houseplan:decor-asset-upload"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app[KEY_HASS]
        if not may_write(hass, request.get("hass_user")):
            return web.json_response({"error": "unauthorized"}, status=403)
        runtime = get_data(hass)
        if runtime is None:
            return web.json_response({"error": "not_ready"}, status=503)
        if request.content_length is not None and request.content_length > MAX_DECOR_ASSET_BYTES + _FLUSH_AT:
            return web.json_response({"error": "too_large"}, status=413)
        filename: str | None = None
        declared_mime: str | None = None
        blocks: list[bytes] = []
        size = 0
        try:
            reader = await request.multipart()
            async for part in reader:
                if part.name != "file":
                    continue
                if filename is not None:
                    return web.json_response({"error": "invalid_format"}, status=400)
                filename = part.filename or "image"
                declared_mime = part.headers.get("Content-Type")
                while chunk := await part.read_chunk(_CHUNK):
                    size += len(chunk)
                    if size > MAX_DECOR_ASSET_BYTES:
                        return web.json_response({"error": "too_large"}, status=413)
                    blocks.append(chunk)
        except Exception as err:  # noqa: BLE001 - malformed multipart boundary
            _LOGGER.warning("House Plan decor asset upload: multipart read error: %s", err)
            return web.json_response({"error": "invalid_format"}, status=400)
        if not filename:
            return web.json_response({"error": "invalid_format"}, status=400)

        try:
            validated = await hass.async_add_executor_job(
                validate_asset, b"".join(blocks), filename, declared_mime,
            )
        except DecorAssetError as err:
            return web.json_response({"error": err.code, "message": str(err)}, status=413 if err.code == "too_large" else 400)

        root = Path(hass.config.path(ASSETS_DIR))

        def _store() -> tuple[dict, bool]:
            root.mkdir(parents=True, exist_ok=True)
            existing = next(
                (row for row in read_catalog(root) if row["asset_id"] == validated.asset_id),
                None,
            )
            if existing is not None:
                existing_blob = root / f"{validated.asset_id}{existing['ext']}"
                if hashlib.sha256(existing_blob.read_bytes()).hexdigest() != validated.asset_id:
                    raise DecorAssetError("invalid_image", "The stored image failed its integrity check")
                return existing, True
            rows = read_catalog(root)
            used = sum(int(row.get("bytes") or 0) for row in rows)
            if len(rows) >= MAX_DECOR_ASSETS_COUNT or used + len(validated.data) > MAX_DECOR_ASSETS_BYTES:
                raise DecorAssetError("capacity_exceeded", "The decor image store is full")
            try:
                if shutil.disk_usage(root).free - len(validated.data) < MIN_FREE_BYTES:
                    raise DecorAssetError("capacity_exceeded", "Not enough free disk space")
            except OSError:
                pass
            aid = validated.asset_id
            blob = root / f"{aid}{validated.ext}"
            meta = asset_meta_path(root, aid)
            safe_display = sanitize_filename(Path(filename).name) or "image"
            row = {
                "asset_id": aid, "name": safe_display, "mime": validated.mime,
                "ext": validated.ext, "width": validated.width, "height": validated.height,
                "bytes": len(validated.data), "created_at": datetime.now(timezone.utc).isoformat(),
            }
            fd, temp_name = tempfile.mkstemp(prefix=".asset-", dir=str(root))
            os.close(fd)
            temp = Path(temp_name)
            meta_temp = temp.with_suffix(".json")
            promoted_blob = False
            try:
                with temp.open("wb") as stream:
                    stream.write(validated.data)
                    stream.flush()
                    os.fsync(stream.fileno())
                with meta_temp.open("w", encoding="utf-8") as stream:
                    stream.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")))
                    stream.flush()
                    os.fsync(stream.fileno())
                if blob.exists():
                    # A previous hard stop may have promoted the blob but not
                    # its sidecar. The content hash proves those bytes; finish
                    # the catalog transaction rather than leaving a ghost.
                    if hashlib.sha256(blob.read_bytes()).hexdigest() != aid:
                        raise DecorAssetError("invalid_image", "The stored image failed its integrity check")
                    os.replace(meta_temp, meta)
                    return row, True
                os.replace(temp, blob)
                promoted_blob = True
                os.replace(meta_temp, meta)
                return row, False
            except Exception:
                # A normal I/O failure is fully transactional. A process hard
                # stop between the two renames is healed by the orphan branch
                # above on the next identical upload.
                if promoted_blob:
                    blob.unlink(missing_ok=True)
                raise
            finally:
                temp.unlink(missing_ok=True)
                meta_temp.unlink(missing_ok=True)

        try:
            async with runtime.upload_lock:
                row, reused = await hass.async_add_executor_job(_store)
        except DecorAssetError as err:
            return web.json_response({"error": err.code, "message": str(err)}, status=507)
        except OSError as err:
            _LOGGER.warning("House Plan decor asset upload: store failed: %s", err)
            return web.json_response({"error": "io_error"}, status=500)
        return web.json_response({"ok": True, "reused": reused, "asset": public_asset(row)})


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
            except Exception as err:  # noqa: BLE001 - a broken multipart stream must answer 400, not crash the view
                _LOGGER.warning("House Plan upload: multipart read error: %s", err)
                error = ({"error": "bad_request"}, 400)

            if error:
                return web.json_response(error[0], status=error[1])
            if not temps or not filename:
                return web.json_response({"error": "no_file"}, status=400)

            tmp_path = temps[0]
            try:
                await hass.async_add_executor_job(
                    check_quota, files_root, tmp_path.stat().st_size,
                    MAX_FILES_BYTES, MAX_FILES_COUNT,
                )
            except QuotaError as err:
                _LOGGER.warning("House Plan upload refused: %s", err.detail)
                return web.json_response({"error": err.reason, "detail": err.detail}, status=507)
            except OSError:
                pass
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
