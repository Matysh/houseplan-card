"""Repair issues for House Plan.

The check runs at entry setup AND after every config save (ws_config_set),
so a plan file that goes missing — or gets re-uploaded — is reflected in the
Repairs UI without waiting for a restart.
"""
from __future__ import annotations

from pathlib import Path

from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir

from .const import DOMAIN, PLANS_DIR, PLANS_URL
from .store import HouseplanConfigEntry


async def async_check_plan_files(hass: HomeAssistant, entry: HouseplanConfigEntry) -> None:
    """Raise an issue for every space whose plan file is missing on disk."""
    cfg_raw = await entry.runtime_data.config_store.async_load() or {}
    spaces = cfg_raw.get("config", {}).get("spaces", [])
    plans_dir = Path(hass.config.path(PLANS_DIR))

    def _missing() -> list[tuple[str, str]]:
        res = []
        for sp in spaces:
            url = sp.get("plan_url") or ""
            if not url.startswith(PLANS_URL + "/"):
                continue  # external/legacy URL — not ours to verify
            fname = url[len(PLANS_URL) + 1 :].split("?", 1)[0]
            if not (plans_dir / fname).is_file():
                res.append((sp.get("id", "?"), fname))
        return res

    missing = await hass.async_add_executor_job(_missing)
    broken = set()
    for space_id, fname in missing:
        broken.add(space_id)
        ir.async_create_issue(
            hass,
            DOMAIN,
            f"broken_plan_{space_id}",
            is_fixable=False,
            severity=ir.IssueSeverity.WARNING,
            translation_key="broken_plan",
            translation_placeholders={"space": space_id, "file": fname},
        )
    # clear stale issues for spaces that are fine again (or gone)
    for sp in spaces:
        sid = sp.get("id", "?")
        if sid not in broken:
            ir.async_delete_issue(hass, DOMAIN, f"broken_plan_{sid}")
