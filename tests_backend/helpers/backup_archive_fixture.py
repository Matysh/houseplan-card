"""Regenerate the synthetic native ZIP wire fixture through the actual HA service.

Run explicitly with pytest -s; stdout is JSON data, not an acceptance verdict.
Browser CI consumes the checked-in synthetic bytes and needs no HA/Pillow install.
"""
import base64
import json

import pytest

from custom_components.houseplan.backup_archive import build_archive, read_archive
from custom_components.houseplan.backup_service import get_backup_service
from custom_components.houseplan.import_export import get_candidate
from tests_backend.test_ha_backup_archive import Content, portable_preview


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    yield


async def test_emit_native_wire(hass, tmp_path):
    _, runtime, response, png, _, _ = await portable_preview(hass, tmp_path)
    candidate = get_candidate(runtime, response["token"], "backup-owner")
    response["token"] = "synthetic-backup-preview"
    response["expires_at"] = "2099-01-01T00:00:00Z"
    payload = {"provenance": "Synthetic output of House Plan ZIP builder and HA preview service (#936)",
               "zip": base64.b64encode((tmp_path / "source.zip").read_bytes()).decode(),
               "png": base64.b64encode(png).decode(), "response": response,
               "config": candidate["target_config"], "layout": candidate["target_layout"]}
    service = get_backup_service(hass, runtime)
    await service.release(service.candidate_session(candidate, "backup-owner"))
    verify = tmp_path / "verify"
    verify.mkdir()
    parsed = read_archive(tmp_path / "source.zip", verify)
    (tmp_path / "source/houseplan/plans/a.copy.png").unlink()
    incomplete = tmp_path / "incomplete.zip"
    build_archive(incomplete, parsed.document, tmp_path / "source", parsed.topics)
    second = await service.upload("backup-owner", Content(incomplete.read_bytes()), incomplete.stat().st_size)
    candidate = get_candidate(runtime, second["token"], "backup-owner")
    second["token"] = "synthetic-incomplete-preview"
    second["expires_at"] = "2099-01-01T00:00:00Z"
    payload["incomplete"] = {"zip": base64.b64encode(incomplete.read_bytes()).decode(),
                             "response": second, "config": candidate["target_config"], "layout": candidate["target_layout"]}
    print("HP_BACKUP_FIXTURE " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
