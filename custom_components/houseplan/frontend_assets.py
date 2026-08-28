"""Public, manifest-gated JavaScript chunks for the Lovelace card."""
from __future__ import annotations

from pathlib import Path

from aiohttp import web
from homeassistant.components.http import HomeAssistantView
try:
    from homeassistant.components.http import KEY_HASS
except ImportError:  # pragma: no cover - old HA compatibility
    KEY_HASS = "hass"  # type: ignore[assignment]

from .const import FRONTEND_ASSETS_URL
from .frontend_asset_manifest import ASSET_CACHE_CONTROL, resolve_frontend_asset

_FRONTEND_ROOT = Path(__file__).parent / "frontend"


class HouseplanFrontendAssetView(HomeAssistantView):
    """Serve only generated chunks named by the current build manifest."""

    url = f"{FRONTEND_ASSETS_URL}/{{filename}}"
    name = "api:houseplan:frontend-asset"
    requires_auth = False

    async def get(self, request: web.Request, filename: str) -> web.StreamResponse:
        hass = request.app[KEY_HASS]
        path = await hass.async_add_executor_job(
            resolve_frontend_asset, _FRONTEND_ROOT, filename
        )
        if path is None:
            raise web.HTTPNotFound()
        # Chunk names are content-hashed, so a served body can never change
        # under its URL — immutable caching is safe and keeps a stale proxy
        # from re-serving an old graph after an update (#353 К4).
        return web.FileResponse(
            path,
            headers={
                "Cache-Control": ASSET_CACHE_CONTROL,
                "X-Content-Type-Options": "nosniff",
            },
        )
