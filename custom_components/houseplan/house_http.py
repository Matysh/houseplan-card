"""Writer-only house transfer routes; not installation backup or support data."""
from __future__ import annotations

import asyncio

from aiohttp import web
from homeassistant.components.http import HomeAssistantView

from .auth import may_write
from .command_adapter import HttpPrincipal, plan_commands
from .core.command_ports import CommandError
from .core.house_archive import CHUNK, check_prefix
from .core.house_commands import download
from .core.house_prefix import PREFIX_BYTES
from .http_api import KEY_HASS
from .import_export import ImportFailure
from .store import get_data


def _error(error):
    return web.json_response({"error": error.code}, status=403 if error.code == "unauthorized"
                             else 413 if error.code == "zip_limit" else 400)


def _commands(request):
    hass, user = request.app[KEY_HASS], request.get("hass_user")
    if not may_write(hass, user):
        raise CommandError("unauthorized")
    runtime = get_data(hass)
    if runtime is None:
        raise CommandError("not_ready")
    return plan_commands(hass, HttpPrincipal(request), runtime)


class HouseplanHousePreviewView(HomeAssistantView):
    url = "/api/houseplan/transfer/import/preview"
    name = "api:houseplan:house-import-preview"
    requires_auth = True

    async def post(self, request: web.Request):
        commands, result = None, None
        operation = request.headers.get("X-Houseplan-Operation", "")
        try:
            commands = _commands(request)
            async with asyncio.timeout(600):
                # No stage allocation, archive cap or ZipInfo before routing the
                # closed first record. Never parse document.json in a transport.
                try:
                    prefix = await request.content.readexactly(PREFIX_BYTES)
                except asyncio.IncompleteReadError as error:
                    prefix = error.partial
                check_prefix(prefix)

                async def blocks():
                    yield prefix
                    async for block in request.content.iter_chunked(CHUNK):
                        yield block

                result = await commands.house_preview(blocks(), request.content_length, operation)
            commands.authority.ensure()
            if request.transport is not None and request.transport.is_closing():
                await commands.environment.house.cancel(commands.authority.scope_id,
                    commands.authority.owner_id, result["token"], operation)
                raise CommandError("zip_cancelled")
            return web.json_response(result)
        except (ImportFailure, CommandError) as error:
            if result is not None and commands is not None:
                await commands.environment.house.cancel(commands.authority.scope_id,
                    commands.authority.owner_id, result["token"], operation)
            return _error(error)
        except TimeoutError:
            return _error(CommandError("zip_cancelled"))
        except (OSError, ValueError, KeyError, TypeError):
            return _error(CommandError("zip_invalid"))


class HouseplanHouseDownloadView(HomeAssistantView):
    url = "/api/houseplan/transfer/export/{token}"
    name = "api:houseplan:house-export-download"
    requires_auth = True

    async def get(self, request: web.Request, token: str):
        response = None
        try:
            commands = _commands(request)
            consent = request.query.get("confirm_missing_content", "0")
            if consent not in {"0", "1"}:
                raise CommandError("invalid_format")
            async with download(commands, token, consent == "1") as (filename, blocks):
                response = web.StreamResponse(headers={"Content-Type": "application/zip",
                    "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store",
                    "Content-Disposition": f'attachment; filename="{filename}"'})
                commands.authority.ensure()
                await response.prepare(request)
                async for block in blocks:
                    commands.authority.ensure()
                    await response.write(block)
            # Release the operation before the client observes EOF and retries.
            await response.write_eof()
            return response
        except (ImportFailure, CommandError) as error:
            if response is not None and response.prepared:
                raise ConnectionResetError("House transfer cancelled") from error
            return _error(error)
        except (OSError, ValueError, KeyError, TypeError):
            if response is not None and response.prepared:
                raise
            return _error(CommandError("zip_invalid"))
