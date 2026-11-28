"""Permissions, live ownership and replies for plan images and decor assets."""
from __future__ import annotations

from .command_execution import begin_preparation
from .command_ports import CommandError, CommandSession
from .constants import CONTENT_URL, MAX_PLANS_LISTED
from .decor_assets import ASSET_ID_RE, asset_refs, public_asset
from .plans import is_plan_file, plan_basename, plan_refs
from .portable_commands import environment
from .validation import sanitize_filename


async def execute(session: CommandSession, message: dict) -> dict:
    operation = message["type"]
    env = environment(session)
    if operation != "houseplan/assets/resolve":
        session.authority.ensure()
    if operation == "houseplan/plans/list":
        async with session.storage.transaction() as state:
            pair = await session.load(state)
            config = pair.config_data.get("config") or {}
        used = {}
        for space in config.get("spaces") or []:
            name = plan_basename(space.get("plan_url"))
            if name:
                used.setdefault(name, []).append(space.get("title") or space.get("id") or "?")
        rows = await env.content.plan_catalog()
        rows.sort(key=lambda row: (-row["modified"], row["name"]))
        return {"plans": [{"name": row["name"], "size": row["size"], "modified": row["modified"],
                           "url": f"{CONTENT_URL}/plans/_/{row['name']}", "used_by": used.get(row["name"], [])}
                          for row in rows[:MAX_PLANS_LISTED]], "total": len(rows)}
    if operation == "houseplan/plans/delete":
        if not isinstance(message.get("name"), str):
            raise CommandError("invalid_format")
        name = sanitize_filename(message["name"])
        if not is_plan_file(name):
            raise CommandError("invalid_name", "Not a plan file")
        async with session.storage.transaction() as state:
            pair = await session.load(state)
            if name in plan_refs(pair.config_data.get("config") or {}):
                raise CommandError("in_use", "A space still uses this plan — detach it first")
            async with env.content.transaction() as files:
                session.before_commit()
                removed = await files.delete_plan(name)
        return {"ok": True, "removed": removed}
    if operation == "houseplan/assets/list":
        async with session.storage.transaction() as state:
            pair = await session.load(state)
            refs = asset_refs(pair.config_data.get("config") or {})
            async with env.content.transaction() as files:
                rows = await files.asset_catalog()
        return {"assets": [public_asset(row, refs.get(row["asset_id"])) for row in rows]}
    if operation == "houseplan/assets/resolve":
        ids = message.get("asset_ids")
        if (not isinstance(ids, list) or len(ids) > 200
                or any(not isinstance(aid, str) or not ASSET_ID_RE.fullmatch(aid) for aid in ids)):
            raise CommandError("invalid_format", "Invalid asset ids")
        requested = set(ids)
        begin_preparation()
        allowed = requested
        if not session.authority.can_write:
            async with session.storage.transaction() as state:
                pair = await session.load(state)
                allowed = requested & set(asset_refs(pair.config_data.get("config") or {}))
        rows = await env.content.resolve_assets(allowed)
        found = {row["asset_id"] for row in rows}
        return {"assets": [public_asset(row) for row in rows], "missing": sorted(requested - found)}
    if operation == "houseplan/assets/delete":
        aid = message.get("asset_id")
        if not isinstance(aid, str) or not ASSET_ID_RE.fullmatch(aid):
            raise CommandError("invalid_format", "Invalid asset id")
        async with session.storage.transaction() as state:
            pair = await session.load(state)
            if asset_refs(pair.config_data.get("config") or {}).get(aid, []):
                raise CommandError("in_use", "A decor object still uses this image")
            async with env.content.transaction() as files:
                session.before_commit()
                removed = await files.delete_asset(aid)
        return {"ok": True, "removed": removed}
    raise CommandError("invalid_format", "Unknown content command")
