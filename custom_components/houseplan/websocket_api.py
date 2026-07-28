"""House Plan WS commands: layout, space configuration, plan uploads."""
from __future__ import annotations

import logging

import base64
import binascii
import json
import secrets
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import (
    CONF_ADMIN_ONLY, DEFAULT_CONFIG,
    CONTENT_URL, FILES_DIR, MAX_PLANS_BYTES, MAX_PLANS_FILES, MAX_PLANS_LISTED,
    MAX_SIGN_PATHS,
    PLANS_DIR, PLANS_URL,
)
from .auth import may_write
from .plans import (
    QuotaError, check_quota, collect_attachments, collect_plans, is_plan_file,
    plan_basename, plan_refs, reserve_filename,
)
from .store import HouseplanData, get_data, get_entry
from .validation import (
    CONFIG_SCHEMA, LAYOUT_SCHEMA, MAX_CONFIG_BYTES, MAX_PLAN_BYTES,
    PLAN_EXTENSIONS, POS_SCHEMA, sanitize_filename, valid_space_id,
)


_LOGGER = logging.getLogger(__name__)


@callback
def async_register(hass: HomeAssistant) -> None:
    """Register the WS commands."""
    websocket_api.async_register_command(hass, ws_layout_get)
    websocket_api.async_register_command(hass, ws_layout_set)
    websocket_api.async_register_command(hass, ws_layout_update)
    websocket_api.async_register_command(hass, ws_layout_delete)
    websocket_api.async_register_command(hass, ws_config_get)
    websocket_api.async_register_command(hass, ws_config_set)
    websocket_api.async_register_command(hass, ws_plan_set)
    websocket_api.async_register_command(hass, ws_plans_list)
    websocket_api.async_register_command(hass, ws_plans_delete)
    websocket_api.async_register_command(hass, ws_files_migrate)
    websocket_api.async_register_command(hass, ws_files_cleanup)
    websocket_api.async_register_command(hass, ws_content_sign)


def _runtime(hass: HomeAssistant, connection, msg_id: int) -> HouseplanData | None:
    """Runtime data of the loaded entry; answers `not_ready` when not set up.

    The write_lock inside serializes every load→modify→save cycle of both
    stores: without it parallel WS calls lose changes (last-writer-wins)
    and the expected_rev check is not atomic.
    """
    data = get_data(hass)
    if data is None:
        connection.send_error(msg_id, "not_ready", "House Plan is not set up")
    return data


def _check_write(hass: HomeAssistant, connection) -> bool:
    """May this connection write? Thin wrapper over the shared policy."""
    return may_write(hass, getattr(connection, "user", None))


# ---------------- layout ----------------


@websocket_api.websocket_command({vol.Required("type"): "houseplan/layout/get"})
@websocket_api.async_response
async def ws_layout_get(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Return the saved layout."""
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    data = await rt.store.async_load() or {}
    connection.send_result(
        msg["id"], {"layout": data.get("layout", {}), "rev": int(data.get("rev", 0))}
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/layout/set",
        vol.Required("layout"): LAYOUT_SCHEMA,
        vol.Optional("expected_rev"): int,
    }
)
@websocket_api.async_response
async def ws_layout_set(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Replace the layout entirely, with optimistic locking (audit B3).

    Wholesale layout writes used to have no revision check at all, so two
    clients silently overwrote each other. `expected_rev` is optional for
    backwards compatibility with older cards, but when supplied it is enforced
    exactly like the config store does.
    """
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may edit the layout")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    async with rt.write_lock:
        data = await rt.store.async_load() or {}
        current_rev = int(data.get("rev", 0))
        if "expected_rev" in msg and msg["expected_rev"] != current_rev:
            connection.send_error(
                msg["id"], "conflict", f"Layout changed elsewhere (rev {current_rev})"
            )
            return
        new_rev = current_rev + 1
        await rt.store.async_save({"layout": msg["layout"], "rev": new_rev})
    hass.bus.async_fire("houseplan_layout_updated", {"rev": new_rev})
    connection.send_result(msg["id"], {"ok": True, "rev": new_rev})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/layout/update",
        vol.Required("device_id"): str,
        vol.Required("pos"): POS_SCHEMA,
    }
)
@websocket_api.async_response
async def ws_layout_update(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Update the position of a single device."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may edit the layout")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    async with rt.write_lock:
        data = await rt.store.async_load() or {}
        layout = data.get("layout", {})
        layout[msg["device_id"]] = msg["pos"]
        # keep the revision: a point-wise write used to drop it, which made the
        # optimistic locking on layout/set meaningless — every drag reset the
        # counter to 0 (HP-1454-08)
        new_rev = int(data.get("rev", 0)) + 1
        await rt.store.async_save({"layout": layout, "rev": new_rev})
    hass.bus.async_fire("houseplan_layout_updated", {"rev": new_rev})
    connection.send_result(msg["id"], {"ok": True, "rev": new_rev})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/files/migrate",
        vol.Required("from_id"): str,
        vol.Required("to_id"): str,
    }
)
@websocket_api.async_response
async def ws_files_migrate(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """COPY a marker's uploaded files to its new id and report the exact mapping.

    Rebinding changes the marker id, so the files must follow (that is how the
    owner lost a set of manuals, 2026-07-26). This used to MOVE them before the
    revision-checked config save: when that save was rejected, the server kept
    the old urls while the files had already left the old folder — a permanent
    broken link (review CR-2, 2026-07-27).

    Now it copies, never overwrites, and returns {src: dst} for every file so
    the client can rewrite EXACTLY the urls that made it (review CR-3). The old
    folder is removed later by houseplan/files/cleanup, once the config is
    safely committed.
    """
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may edit files")
        return
    import shutil
    from pathlib import Path

    from .const import FILES_DIR
    from .validation import sanitize_marker_id

    src_id = sanitize_marker_id(msg["from_id"])
    dst_id = sanitize_marker_id(msg["to_id"])
    if not src_id or not dst_id or src_id == dst_id:
        connection.send_result(msg["id"], {"ok": True, "mapping": {}, "copied": 0})
        return
    base = Path(hass.config.path(FILES_DIR))
    src = base / src_id
    dst = base / dst_id

    def _copy() -> dict[str, str]:
        if not src.is_dir():
            return {}
        dst.mkdir(parents=True, exist_ok=True)
        mapping: dict[str, str] = {}
        for f in sorted(src.iterdir()):
            if not f.is_file():
                continue
            # a different file may already own this name — do NOT silently point
            # the url at it. The shared helper CLAIMS a free one atomically, so
            # a concurrent migrate or upload cannot pick the same one, and the
            # name it returns is one the content view accepts back in a request.
            name = reserve_filename(dst, f.name)
            target = dst / name
            try:
                shutil.copy2(str(f), str(target))
            except OSError:
                target.unlink(missing_ok=True)  # never leave an empty placeholder
                raise
            mapping[f.name] = name
        return mapping

    try:
        mapping = await hass.async_add_executor_job(_copy)
    except OSError as err:
        connection.send_error(msg["id"], "io_error", f"Could not copy marker files: {err}")
        return
    connection.send_result(msg["id"], {"ok": True, "mapping": mapping, "copied": len(mapping)})


@websocket_api.websocket_command({vol.Required("type"): "houseplan/plans/list"})
@websocket_api.async_response
async def ws_plans_list(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Plan images on the server, with what still uses them.

    Files are never removed for being unreferenced (docs/SCOPE.md), which only
    works as a policy if the user can see them: detaching a plan keeps the
    image, and this is how it gets picked up again — or deleted on purpose.
    """
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    stored = await rt.config_store.async_load() or {}
    cfg = stored.get("config") or {}
    used: dict[str, list[str]] = {}
    for space in cfg.get("spaces") or []:
        name = plan_basename(space.get("plan_url"))
        if name:
            used.setdefault(name, []).append(space.get("title") or space.get("id") or "?")

    plans_dir = Path(hass.config.path(PLANS_DIR))

    def _scan() -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        if not plans_dir.is_dir():
            return out
        for item in sorted(plans_dir.iterdir()):
            if not item.is_file() or not is_plan_file(item.name):
                continue
            try:
                st = item.stat()
            except OSError:
                continue
            out.append({
                "name": item.name,
                "url": f"{CONTENT_URL}/plans/_/{item.name}",
                "size": st.st_size,
                "modified": int(st.st_mtime),
                "used_by": used.get(item.name, []),
            })
        out.sort(key=lambda x: -x["modified"])
        return out

    plans = await hass.async_add_executor_job(_scan)
    # newest first and capped: a folder with thousands of files would otherwise
    # become one huge message, one huge list and a signing request per row
    connection.send_result(
        msg["id"], {"plans": plans[:MAX_PLANS_LISTED], "total": len(plans)}
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/plans/delete",
        vol.Required("name"): str,
    }
)
@websocket_api.async_response
async def ws_plans_delete(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Delete a plan image because the user asked — the only way one goes.

    Refuses while a space still references it: the answer to "can I delete this"
    is the stored configuration's, not the client's.
    """
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may delete plans")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    name = sanitize_filename(msg["name"])
    if not is_plan_file(name):
        connection.send_error(msg["id"], "invalid_name", "Not a plan file")
        return

    async with rt.write_lock:
        stored = await rt.config_store.async_load() or {}
        cfg = stored.get("config") or {}
        if name in plan_refs(cfg):
            connection.send_error(
                msg["id"], "in_use", "A space still uses this plan — detach it first"
            )
            return
        path = Path(hass.config.path(PLANS_DIR)) / name

        def _rm() -> bool:
            try:
                path.unlink()
                return True
            except FileNotFoundError:
                return False
            except OSError as err:
                _LOGGER.warning("House Plan: could not delete %s: %s", path, err)
                return False

        removed = await hass.async_add_executor_job(_rm)
    connection.send_result(msg["id"], {"ok": True, "removed": removed})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/content/sign",
        vol.Required("paths"): [str],
    }
)
@websocket_api.async_response
async def ws_content_sign(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Sign content paths so the BROWSER can fetch them.

    Home Assistant authenticates HTTP requests by a Bearer header or an
    `authSig` signed path — there is no cookie auth. An <image href> inside SVG
    and a plain <a href> can send neither, so after the content endpoint became
    `requires_auth` the plan backgrounds and PDF links returned 401 (audit
    follow-up B1 regression, 2026-07-27 — reproduced live).

    The card asks for signatures and uses the signed urls for display.
    """
    from datetime import timedelta

    from homeassistant.components.http.auth import async_sign_path

    out: dict[str, str] = {}
    token_id = getattr(connection, "refresh_token_id", None)
    for path in msg["paths"][:MAX_SIGN_PATHS]:
        if not isinstance(path, str) or not path.startswith(CONTENT_URL + "/"):
            continue  # only ever sign our own content endpoint
        clean = path.split("?", 1)[0]
        try:
            try:
                signed = async_sign_path(hass, clean, timedelta(hours=24), refresh_token_id=token_id)
            except TypeError:  # older HA signature: (hass, refresh_token_id, path, expiration)
                signed = async_sign_path(hass, token_id, clean, timedelta(hours=24))
        except Exception as err:  # noqa: BLE001 — signing must never break the card
            _LOGGER.warning("House Plan: could not sign %s: %s", clean, err)
            continue
        out[path] = signed
    connection.send_result(msg["id"], {"urls": out})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/files/cleanup",
        vol.Required("marker_id"): str,
    }
)
@websocket_api.async_response
async def ws_files_cleanup(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Drop a marker folder's leftovers after its files moved elsewhere.

    Called after a rebind: the files were copied to the new marker id and the
    config that references them is committed, so the source folder is spent.

    It used to `rmtree` the folder on the client's word alone. Two ways that
    ends badly: a partial copy leaves some urls still pointing INTO this folder
    (the migration deliberately does not rewrite those), and a wrong or stale
    id from any client deletes a live marker's attachments outright. So the
    server checks for itself — under the config lock — and removes only files
    the stored configuration does not reference. Same principle as the
    collector: a client may say what it no longer needs, never what may go.
    """
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may edit files")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    from .const import FILES_DIR
    from .plans import attachment_refs
    from .validation import sanitize_marker_id

    mid = sanitize_marker_id(msg["marker_id"])
    base = Path(hass.config.path(FILES_DIR)).resolve()
    target = (base / mid).resolve() if mid else base
    if not mid or not str(target).startswith(str(base)) or target == base:
        connection.send_result(msg["id"], {"ok": True, "removed": 0, "kept": 0})
        return

    async with rt.write_lock:
        stored = await rt.config_store.async_load() or {}
        refs = attachment_refs(stored.get("config") or {})

        def _rm() -> tuple[int, int]:
            if not target.is_dir():
                return 0, 0
            removed = kept = 0
            for item in sorted(target.iterdir()):
                if not item.is_file():
                    continue
                if f"{mid}/{item.name}" in refs:
                    kept += 1
                    continue
                try:
                    item.unlink()
                    removed += 1
                except OSError as err:
                    _LOGGER.warning("House Plan: could not remove %s: %s", item, err)
            if not kept:
                try:
                    target.rmdir()
                except OSError:
                    pass
            return removed, kept

        removed, kept = await hass.async_add_executor_job(_rm)
    if kept:
        _LOGGER.info(
            "House Plan: kept %s file(s) in %s — the configuration still references them", kept, mid
        )
    connection.send_result(msg["id"], {"ok": True, "removed": removed, "kept": kept})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/layout/delete",
        vol.Required("device_id"): str,
    }
)
@websocket_api.async_response
async def ws_layout_delete(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Delete the position of a single device (cleanup when a marker is removed)."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may edit the layout")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    new_rev: int | None = None
    async with rt.write_lock:
        data = await rt.store.async_load() or {}
        layout = data.get("layout", {})
        if msg["device_id"] in layout:
            del layout[msg["device_id"]]
            new_rev = int(data.get("rev", 0)) + 1
            await rt.store.async_save({"layout": layout, "rev": new_rev})
    if new_rev is not None:
        hass.bus.async_fire("houseplan_layout_updated", {"rev": new_rev})
    connection.send_result(msg["id"], {"ok": True, "rev": new_rev})


# ---------------- space configuration ----------------


@websocket_api.websocket_command({vol.Required("type"): "houseplan/config/get"})
@websocket_api.async_response
async def ws_config_get(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Return the configuration and its revision."""
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    data = await rt.config_store.async_load() or {}
    config = {**DEFAULT_CONFIG, **data.get("config", {})}
    connection.send_result(msg["id"], {"config": config, "rev": data.get("rev", 0)})



def _missing_internal_plans(plans_dir: Path, config: dict[str, Any]) -> set[str]:
    """Plan files a configuration names that are not on disk.

    Only OUR urls are checked — `/api/houseplan/content/plans/_/<name>` and the
    legacy static path. Anything else belongs to the user and may point wherever
    they like.
    """
    out: set[str] = set()
    for space in (config or {}).get("spaces") or []:
        url = space.get("plan_url")
        if not isinstance(url, str) or not url:
            continue
        if not (url.startswith(CONTENT_URL + "/plans/") or url.startswith(PLANS_URL + "/")):
            continue
        name = plan_basename(url)
        if name and not (plans_dir / name).is_file():
            out.add(name)
    return out


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/config/set",
        vol.Required("config"): CONFIG_SCHEMA,
        vol.Optional("expected_rev"): int,
    }
)
@websocket_api.async_response
async def ws_config_set(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Replace the configuration with optimistic locking (expected_rev).

    Protects against races between several open clients: if the config has changed since
    the client's last read — a conflict error is returned, and the client must
    re-read the config and re-apply its edit on top of the fresh version.
    """
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may edit the configuration")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    # Per-field limits bound each list; this bounds their product (HP-1454-05).
    # Everything below the caps can still add up to something no dashboard can
    # render, and the store writes it to disk on every save.
    size = len(json.dumps(msg["config"], separators=(",", ":")))
    if size > MAX_CONFIG_BYTES:
        connection.send_error(
            msg["id"], "too_large",
            f"Configuration is {size // 1024} KB, the limit is {MAX_CONFIG_BYTES // 1024} KB",
        )
        return
    async with rt.write_lock:
        data = await rt.config_store.async_load() or {}
        current_rev = data.get("rev", 0)
        if "expected_rev" not in msg and current_rev:
            # audit B4: expected_rev stays optional for old cards mid-upgrade,
            # but a blind overwrite of a non-empty store is worth a warning —
            # it is exactly how a stale client silently discards someone's work.
            _LOGGER.warning(
                "House Plan: config/set without expected_rev over rev %s — "
                "the client bypasses conflict detection (outdated card?)",
                current_rev,
            )
        if "expected_rev" in msg and msg["expected_rev"] != current_rev:
            connection.send_error(
                msg["id"], "conflict",
                f"Configuration was changed in another window (rev {current_rev} != {msg['expected_rev']})",
            )
            return
        # An internal plan url must name a file that exists. The card can pick a
        # plan and then delete it from the same dialog, and two clients can do
        # the same thing in either order — the lock serialises them but says
        # nothing about whether the file survived (HP-1470-02). External and
        # legacy urls are not ours to check and are left alone.
        missing = await hass.async_add_executor_job(
            _missing_internal_plans, Path(hass.config.path(PLANS_DIR)), msg["config"]
        )
        if missing:
            connection.send_error(
                msg["id"], "missing_plan",
                "Plan file no longer exists: " + ", ".join(sorted(missing)),
            )
            return
        new_rev = current_rev + 1
        await rt.config_store.async_save({"config": msg["config"], "rev": new_rev})
        # Still holding the lock: the file system is not part of the store's
        # transaction, so collection has to be pinned to this commit (R3-1).
        # It is best-effort housekeeping behind an already durable write — a
        # failure here must not withhold the event and the success response,
        # or the client retries an edit the server has already accepted and
        # gets a conflict for its trouble (R4-1).
        def _collect() -> None:
            collect_plans(Path(hass.config.path(PLANS_DIR)), data.get("config"), msg["config"])
            collect_attachments(Path(hass.config.path(FILES_DIR)), data.get("config"), msg["config"])

        try:
            await hass.async_add_executor_job(_collect)
        except Exception:  # noqa: BLE001 — see above: the commit stands regardless
            _LOGGER.exception("House Plan: collecting superseded files failed")
    hass.bus.async_fire("houseplan_config_updated", {"rev": new_rev})
    # refresh repair issues (broken plan references) without waiting for a restart
    entry = get_entry(hass)
    if entry is not None:
        from .repairs import async_check_plan_files

        hass.async_create_task(async_check_plan_files(hass, entry))
    connection.send_result(msg["id"], {"ok": True, "rev": new_rev})


# ---------------- plan uploads ----------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/plan/set",
        vol.Required("space_id"): str,
        vol.Required("ext"): vol.In(sorted(PLAN_EXTENSIONS)),
        vol.Required("data"): str,  # base64
    }
)
@websocket_api.async_response
async def ws_plan_set(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Save a space plan file; return the URL for the card."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may upload plans")
        return
    space_id = msg["space_id"]
    if not valid_space_id(space_id):
        connection.send_error(msg["id"], "invalid_space_id", "space_id: only [a-z0-9_-], up to 64 characters")
        return
    try:
        raw = base64.b64decode(msg["data"], validate=True)
    except (binascii.Error, ValueError):
        connection.send_error(msg["id"], "invalid_data", "data must be valid base64")
        return
    if len(raw) > MAX_PLAN_BYTES:
        connection.send_error(msg["id"], "too_large", f"Plan is larger than {MAX_PLAN_BYTES // 1024 // 1024} MB")
        return

    # Copy-on-write: a plan is written under a NEW unique name and nothing is
    # deleted here (review R2-1). The old name stays readable, so a config write
    # that is later rejected — revision conflict, validation, lost connection —
    # leaves the stored plan exactly as it was. The card calls
    # nothing here; the file a commit REPLACES is collected by `config/set`
    # itself, inside the write lock (review R3-1). An upload that never gets
    # committed is not collected at all — it is offered back in the space
    # dialog's "already uploaded" list, where the user can attach or delete it.
    # Every attempt to age these out ended in data loss or a race (v1.46.4-6).
    #
    # `.` separates the id from the token because a space id cannot contain one
    # (SPACE_ID_RE), so "<space>.<token>.<ext>" can never be confused with the
    # files of a differently named space.
    plans_dir = Path(hass.config.path(PLANS_DIR))
    try:
        await hass.async_add_executor_job(
            check_quota, plans_dir, len(raw), MAX_PLANS_BYTES, MAX_PLANS_FILES
        )
    except QuotaError as err:
        connection.send_error(msg["id"], err.reason, err.detail)
        return
    name = f"{space_id}.{secrets.token_hex(4)}.{msg['ext']}"
    path = plans_dir / name

    def _write() -> None:
        plans_dir.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)

    await hass.async_add_executor_job(_write)
    connection.send_result(msg["id"], {"ok": True, "url": f"{CONTENT_URL}/plans/_/{name}"})
