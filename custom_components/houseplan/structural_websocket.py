"""Transport wrapper preserving each ordinary command's original schema."""
from __future__ import annotations

import inspect
from functools import wraps

import voluptuous as vol
from homeassistant.components import websocket_api

from .auth import may_write
from .core.command_ports import CommandError
from .store import get_data
from .structural_upload import CONTROL_KEYS, UploadError


def structural_websocket_command(schema):
    """Accept a compact token OR the unchanged inline command, never a mix.

Existing callers retain @async_response. Its wraps() exposes the coroutine;
we schedule a single wrapper that resolves, validates and then awaits it.
No access to HA's command registry or global websocket size is needed.
"""
    def decorate(function):
        tagged = websocket_api.websocket_command(schema)(function)
        original_schema = tagged._ws_schema
        command = tagged._ws_command
        inner = inspect.unwrap(function)
        compact_schema = vol.Schema({
            vol.Required("id"): int, vol.Required("type"): command,
            vol.Required("upload_token"): vol.All(str, vol.Length(min=16, max=100)),
            vol.Required("upload_sha256"): vol.All(str, vol.Match(r"^[a-f0-9]{64}$")),
            **{vol.Optional(key): object for key in CONTROL_KEYS},
        })

        @wraps(inner)
        async def resolve_and_call(hass, connection, message):
            if "upload_token" not in message:
                return await inner(hass, connection, message)
            runtime = get_data(hass)
            user = getattr(connection, "user", None)
            if runtime is None:
                connection.send_error(message["id"], "not_ready", "House Plan is not set up")
                return
            if not may_write(hass, user):
                connection.send_error(message["id"], "unauthorized", "Editing permission required")
                return
            try:
                from .command_adapter import plan_commands

                expanded = await plan_commands(hass, connection, runtime).resolve_structural(message, original_schema)
            except (UploadError, CommandError, vol.Invalid) as err:
                connection.send_error(message["id"], getattr(err, "code", "invalid_format"), "Large write could not be accepted; reload and retry")
                return
            return await inner(hass, connection, expanded)

        result = websocket_api.async_response(resolve_and_call)
        result._ws_command = command
        result._ws_schema = vol.Any(original_schema, compact_schema)
        return result
    return decorate
