"""One plan-only upload policy and transaction order for every host."""
from __future__ import annotations

from functools import partial

from .command_execution import begin_preparation
from .command_ports import CommandError
from .constants import CONTENT_URL
from .decor_assets import public_asset, validate_asset
from .input_policy import current_policy
from .portable_commands import environment
from .validation import MAX_PLAN_BYTES, PLAN_EXTENSIONS, valid_space_id


async def upload_plan(session, raw: bytes, space_id: str, extension: str) -> dict:
    session.authority.ensure()
    if not isinstance(space_id, str) or not valid_space_id(space_id):
        raise CommandError("invalid_space_id")
    if not isinstance(extension, str) or extension not in PLAN_EXTENSIONS:
        raise CommandError("bad_ext")
    if not isinstance(raw, bytes):
        raise CommandError("no_file")
    if len(raw) > MAX_PLAN_BYTES:
        raise CommandError("too_large")
    async with environment(session).content.transaction() as files:
        begin_preparation()
        if current_policy().strict:
            # Strict hosts require decoding/active SVG checks, while HA retains
            # its historical opaque backdrop upload (sandboxed at read time).
            await session.cpu.run(partial(validate_asset, raw, f"plan.{extension}", max_bytes=MAX_PLAN_BYTES))
        async with files.stage_plan(space_id, extension, raw) as stage:
            session.before_commit()
            result = await files.publish_upload(stage)
    return {"ok": True, "url": f"{CONTENT_URL}/plans/_/{result['name']}"}


async def upload_asset(session, raw: bytes, filename: str, mime: str | None) -> dict:
    session.authority.ensure()
    if not isinstance(raw, bytes) or not isinstance(filename, str) or not filename:
        raise CommandError("invalid_format")
    async with environment(session).content.transaction() as files:
        begin_preparation()
        # Decode under the same bounded-content lock as quota and promotion.
        validated = await session.cpu.run(validate_asset, raw, filename, mime)
        async with files.stage_asset(validated, filename) as stage:
            session.before_commit()
            result = await files.publish_upload(stage)
    return {"ok": True, "reused": result["reused"], "asset": public_asset(result["asset"])}
