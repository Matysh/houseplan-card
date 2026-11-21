"""Compatibility exports for the canonical plan core; no copied algorithms."""
from __future__ import annotations

import asyncio

from .core.backup_files import (
    _DEST as _DEST,
)
from .core.backup_files import (
    _SESSION as _SESSION,
)
from .core.backup_files import (
    ASSETS_DIR as ASSETS_DIR,
)
from .core.backup_files import (
    CONTENT_URL as CONTENT_URL,
)
from .core.backup_files import (
    FILES_DIR as FILES_DIR,
)
from .core.backup_files import (
    MAX_DECOR_ASSETS_BYTES as MAX_DECOR_ASSETS_BYTES,
)
from .core.backup_files import (
    MAX_DECOR_ASSETS_COUNT as MAX_DECOR_ASSETS_COUNT,
)
from .core.backup_files import (
    MAX_FILES_BYTES as MAX_FILES_BYTES,
)
from .core.backup_files import (
    MAX_FILES_COUNT as MAX_FILES_COUNT,
)
from .core.backup_files import (
    MAX_PLANS_BYTES as MAX_PLANS_BYTES,
)
from .core.backup_files import (
    MAX_PLANS_FILES as MAX_PLANS_FILES,
)
from .core.backup_files import (
    MIN_FREE_BYTES as MIN_FREE_BYTES,
)
from .core.backup_files import (
    PLANS_DIR as PLANS_DIR,
)
from .core.backup_files import (
    STAGING_DIR as STAGING_DIR,
)
from .core.backup_files import (
    Any as Any,
)
from .core.backup_files import (
    ArchivePayload as ArchivePayload,
)
from .core.backup_files import (
    Path as Path,
)
from .core.backup_files import (
    check_files as check_files,
)
from .core.backup_files import (
    cleanup_stage as cleanup_stage,
)
from .core.backup_files import (
    content_manifest as content_manifest,
)
from .core.backup_files import (
    digest as digest,
)
from .core.backup_files import (
    dir_usage as dir_usage,
)
from .core.backup_files import (
    directory_fd as directory_fd,
)
from .core.backup_files import (
    fail as fail,
)
from .core.backup_files import (
    image_refs as image_refs,
)
from .core.backup_files import (
    json as json,
)
from .core.backup_files import (
    json_bytes as json_bytes,
)
from .core.backup_files import (
    new_stage as new_stage,
)
from .core.backup_files import (
    os as os,
)
from .core.backup_files import (
    physical_asset_usage as physical_asset_usage,
)
from .core.backup_files import (
    plan_files as plan_files,
)
from .core.backup_files import (
    re as re,
)
from .core.backup_files import (
    ref_key as ref_key,
)
from .core.backup_files import (
    rollback_files as rollback_files,
)
from .core.backup_files import (
    safe_read as safe_read,
)
from .core.backup_files import (
    sanitize_marker_id as sanitize_marker_id,
)
from .core.backup_files import (
    shutil as shutil,
)
from .core.backup_files import (
    stage_folder as stage_folder,
)
from .core.backup_files import (
    stat as stat,
)
from .core.backup_files import (
    validate_asset as validate_asset,
)


async def durable_file_job(hass, callback, *args):
    """Never release transaction locks while its filesystem worker still writes."""
    future = hass.async_add_executor_job(callback, *args)
    try:
        return await asyncio.shield(future)
    except asyncio.CancelledError:
        try:
            await asyncio.shield(future)
        except Exception:  # noqa: BLE001 - retain cancellation, after own work ended
            pass
        raise
