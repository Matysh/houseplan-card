"""HTTP-эндпоинт загрузки файлов-инструкций House Plan.

Файлы (PDF и т.п.) грузятся не через WebSocket (у него лимит размера сообщения —
большой PDF рвёт соединение), а обычным multipart POST — как медиа в самом HA.
"""
from __future__ import annotations

import logging
from pathlib import Path

from aiohttp import web

from homeassistant.components.http import HomeAssistantView

try:  # KEY_HASS — современный доступ к hass из aiohttp-приложения
    from homeassistant.components.http import KEY_HASS
except ImportError:  # старые версии HA
    KEY_HASS = "hass"  # type: ignore[assignment]
from homeassistant.core import HomeAssistant

from .const import CONF_ADMIN_ONLY, DOMAIN, FILES_DIR, FILES_URL
from .validation import (
    FILE_EXTENSIONS,
    MAX_FILE_BYTES,
    file_ext,
    sanitize_filename,
    sanitize_marker_id,
)

_LOGGER = logging.getLogger(__name__)

_CHUNK = 64 * 1024


class HouseplanUploadView(HomeAssistantView):
    """POST /api/houseplan/upload — сохранить файл маркера, вернуть URL."""

    url = "/api/houseplan/upload"
    name = "api:houseplan:upload"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app[KEY_HASS]
        entry = hass.data.get(DOMAIN, {}).get("entry")
        admin_only = bool(entry and entry.options.get(CONF_ADMIN_ONLY, False))
        if admin_only:
            user = request.get("hass_user")
            if user is None or not user.is_admin:
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
                    # читаем чанками с обрывом по лимиту, а не весь файл в память
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
            _LOGGER.warning("House Plan upload: ошибка чтения multipart: %s", err)
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
            {"ok": True, "url": f"{FILES_URL}/{marker_id}/{safe_name}?v={mtime}", "name": filename}
        )
