"""Coherent preview capture/build lifecycle, separate from WS dispatch (#942)."""

from __future__ import annotations

import asyncio
import copy

from .auth import may_write
from .const import DEFAULT_CONFIG
from .store import get_data
from .support_builds import SupportBuildPool
from .support_package import PACKAGE_VERSIONS, SupportPackageError
from .support_snapshot import capture_snapshot, scope_readable
from .support_wire_schema import WireRejected, validate_client


async def async_build_preview(
    hass,
    connection,
    rt,
    msg,
    *,
    builder,
    config_schema,
    layout_schema,
    repairs,
    build,
    integration_version,
    ha_version,
):
    version = msg.get("package_version", 1)
    if (
        type(version) is not int
        or version not in PACKAGE_VERSIONS
        or (version == 1 and "diagnostics" in msg)
    ):
        raise SupportPackageError("support_rejected")
    client = msg.get("diagnostics")
    if client is not None:
        try:
            validate_client(client)
        except WireRejected as error:
            raise SupportPackageError("support_rejected") from error
    owner, draft = connection.user.id, msg["draft_id"]
    pool = hass.data.setdefault("houseplan_support_builds", SupportBuildPool())
    token = pool.acquire(owner, draft)
    if token is None:
        raise SupportPackageError("support_rate_limited")
    started = False
    deadline = asyncio.get_running_loop().time() + 10
    try:
        async with asyncio.timeout_at(deadline), rt.write_lock:
            config_data = await rt.config_store.async_load() or {}
            layout_data = await rt.store.async_load() or {}
            config = copy.deepcopy(
                {**DEFAULT_CONFIG, **(config_data.get("config") or {})}
            )
            layout = copy.deepcopy(layout_data.get("layout") or {})
            config_rev, layout_rev = (
                int(config_data.get("rev", 0)),
                int(layout_data.get("rev", 0)),
            )
            # Until the executor handoff there is no further await. Runtime
            # references are copied in one bounded cut, not read from a worker.
            snapshot, scope = (
                capture_snapshot(hass, connection.user, config, client)
                if version == 2
                else (None, ())
            )

        def project():
            config_schema(copy.deepcopy(config))
            layout_schema(copy.deepcopy(layout))
            return builder(
                config,
                layout,
                config_rev=config_rev,
                layout_rev=layout_rev,
                card_version=msg["card_version"],
                integration_version=integration_version,
                home_assistant_version=ha_version,
                runtime={
                    key: msg[key]
                    for key in (
                        "browser_family",
                        "browser_major",
                        "language",
                        "coarse_pointer",
                        "hover_capable",
                        "registry_access",
                        "registry_age_bucket",
                    )
                },
                repairs=repairs,
                build=build,
                package_version=version,
                diagnostics=client,
                server_snapshot=snapshot,
            )

        if asyncio.get_running_loop().time() >= deadline:
            raise TimeoutError
        future = hass.async_add_executor_job(project)
        started = True
        raw, preview = await pool.await_physical(
            owner,
            draft,
            token,
            future,
            timeout=max(0, deadline - asyncio.get_running_loop().time()),
        )
        if get_data(hass) is not rt:
            raise SupportPackageError("support_unavailable")
        if not may_write(hass, connection.user) or not scope_readable(
            connection.user, scope
        ):
            raise SupportPackageError("unauthorized")
        return raw, preview, scope
    except TimeoutError as error:
        raise SupportPackageError("support_unavailable") from error
    finally:
        if not started:
            pool.release(owner, draft, token)
