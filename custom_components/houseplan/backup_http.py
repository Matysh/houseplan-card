"""Authenticated ZIP transfer; JSON import and support endpoints remain separate."""
from __future__ import annotations

import asyncio
import json
from functools import partial

from aiohttp import web
from homeassistant.components.http import HomeAssistantView

from .auth import may_write
from .backup_archive import CHUNK, fail
from .backup_service import get_backup_service
from .const import IMPORT_PREVIEW_TTL_S
from .http_api import KEY_HASS
from .import_export import ImportFailure
from .store import get_data


def archive_admin(hass, user) -> bool:
    return bool(user and user.is_admin and may_write(hass, user))


def error_response(error: ImportFailure) -> web.Response:
    return web.json_response({"error": error.code}, status=413 if error.code == "zip_limit" else 400)


class HouseplanArchivePreviewView(HomeAssistantView):
    url = "/api/houseplan/backup/import/preview"
    name = "api:houseplan:backup-import-preview"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass, user = request.app[KEY_HASS], request.get("hass_user")
        if not archive_admin(hass, user):
            return web.json_response({"error": "unauthorized"}, status=403)
        runtime = get_data(hass)
        if runtime is None:
            return web.json_response({"error": "not_ready"}, status=503)
        service = get_backup_service(hass, runtime)
        try:
            async with asyncio.timeout(IMPORT_PREVIEW_TTL_S):
                result = await service.upload(str(user.id), request.content, request.content_length,
                    operation_id=request.headers.get("X-Houseplan-Operation", ""))
            if not archive_admin(hass, user):
                candidate = runtime.import_previews.get(result["token"], {})
                session = service.candidate_session(candidate, str(user.id))
                await service.release(session)
                return web.json_response({"error": "unauthorized"}, status=403)
            if request.transport is not None and request.transport.is_closing():
                candidate = runtime.import_previews.get(result["token"], {})
                await service.release(service.candidate_session(candidate, str(user.id)))
                raise fail("zip_cancelled")
            return web.json_response(result)
        except ImportFailure as err:
            return error_response(err)
        except TimeoutError:
            return error_response(fail("zip_cancelled"))
        except (OSError, ValueError, KeyError, TypeError):
            return error_response(fail())


class HouseplanArchiveDownloadView(HomeAssistantView):
    url = "/api/houseplan/backup/export/{token}"
    name = "api:houseplan:backup-export-download"
    requires_auth = True

    async def post(self, request: web.Request, token: str) -> web.StreamResponse:
        hass, user = request.app[KEY_HASS], request.get("hass_user")
        if not archive_admin(hass, user):
            return web.json_response({"error": "unauthorized"}, status=403)
        runtime = get_data(hass)
        if runtime is None:
            return web.json_response({"error": "not_ready"}, status=503)
        service = get_backup_service(hass, runtime)
        session, source, response = None, None, None
        try:
            raw = await request.content.read(1025)
            if len(raw) > 1024:
                raise fail()
            body = json.loads(raw)
            if (not isinstance(body, dict) or set(body) != {"confirm_missing_content"}
                    or type(body["confirm_missing_content"]) is not bool):
                raise fail()
            session = service.get(token, str(user.id), "export")
            if not session.manifest["complete"] and not body["confirm_missing_content"]:
                # Keep the prepared candidate for the separate explicit action.
                session = None
                raise ImportFailure("content_confirmation_required")
            source = await service.run(session, partial(service.export_stream, session))
            service.get(token, str(user.id), "export")
            if not archive_admin(hass, user):
                return web.json_response({"error": "unauthorized"}, status=403)
            response = web.StreamResponse(headers={
                "Content-Type": "application/zip", "X-Content-Type-Options": "nosniff",
                "Cache-Control": "no-store", "Content-Disposition": f'attachment; filename="{session.filename}"',
            })
            await response.prepare(request)
            while block := await service.run(session, partial(source.read, CHUNK)):
                await response.write(block)
            await response.write_eof()
            return response
        except ImportFailure as err:
            if response is not None:
                raise ConnectionResetError("ZIP transfer cancelled") from err
            return error_response(err)
        except (OSError, ValueError, KeyError, TypeError):
            if response is not None:
                raise
            return error_response(fail())
        finally:
            if source is not None:
                source.close()
            if session is not None:
                await service.release(session)
