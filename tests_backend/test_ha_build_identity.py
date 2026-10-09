"""#836: build identity — dev label, frontend fingerprint, HA loader version."""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path

import pytest
from homeassistant import loader
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

import custom_components
import custom_components.houseplan as houseplan
from custom_components.houseplan import build_identity
from custom_components.houseplan.build_identity import (
    UNKNOWN_BUILD,
    BuildIdentity,
    read_build_identity,
)
from custom_components.houseplan.const import (
    DOMAIN,
    FRONTEND_URL,
    PANEL_FRONTEND_URL,
    VERSION,
)
from custom_components.houseplan.frontend_registration import (
    get_frontend_registration_state,
)
from custom_components.houseplan.panel_registration import get_panel_registration_state


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom_components in the test hass."""
    yield


SOURCE = "024b6595" + "1" * 32
FINGERPRINT = "c0ffee00" + "2" * 56
LABEL = {"schema": 1, "channel": "dev", "source": SOURCE}
ASSETS = {"schema": 1, "fingerprint": FINGERPRINT, "files": []}


def _tree(root: Path, *, label: object = LABEL, assets: object = ASSETS) -> Path:
    """An integration directory with the two identity files (or raw text)."""
    (root / "frontend").mkdir(parents=True, exist_ok=True)
    for path, value in ((root / "BUILD.json", label), (root / "frontend" / "houseplan-assets.json", assets)):
        if value is None:
            continue
        path.write_text(value if isinstance(value, str) else json.dumps(value), encoding="utf-8")
    return root


def test_issue_836_valid_label_and_fingerprint_are_read(tmp_path: Path) -> None:
    identity = read_build_identity(_tree(tmp_path))
    assert identity == BuildIdentity(fingerprint=FINGERPRINT, source=SOURCE)
    assert identity.build == {"channel": "dev", "source": SOURCE}


@pytest.mark.parametrize(
    "label",
    [
        None,  # a release, a beta, the dev tree: no file at all
        "{not json",
        "",
        json.dumps([LABEL]),
        json.dumps({**LABEL, "channel": "beta"}),
        json.dumps({**LABEL, "source": SOURCE[:8]}),
        json.dumps({**LABEL, "source": SOURCE.upper()}),
        json.dumps({**LABEL, "source": SOURCE + "\n"}),
        json.dumps({**LABEL, "schema": 2}),
        json.dumps({**LABEL, "schema": True}),
        json.dumps({"channel": "dev", "source": SOURCE}),
        "\udcff",
    ],
    ids=[
        "missing", "broken", "empty", "array", "channel", "short-source", "upper-source",
        "newline-source", "schema-2", "schema-bool", "no-schema", "undecodable",
    ],
)
def test_issue_836_invalid_or_missing_label_is_no_label(tmp_path: Path, label) -> None:
    root = _tree(tmp_path, label=None)
    if label == "\udcff":
        (root / "BUILD.json").write_bytes(b"\xff\xfe\x00")
    elif label is not None:
        (root / "BUILD.json").write_text(label, encoding="utf-8")
    identity = read_build_identity(root)
    assert identity.source is None
    assert identity.build is None
    assert identity.fingerprint == FINGERPRINT, "a bad label does not hide the fingerprint"


@pytest.mark.parametrize(
    "assets",
    [
        None,
        "{",
        {**ASSETS, "schema": 2},
        {**ASSETS, "schema": True},
        {**ASSETS, "fingerprint": FINGERPRINT[:63]},
        {**ASSETS, "fingerprint": FINGERPRINT.upper()},
        {**ASSETS, "fingerprint": None},
        [ASSETS],
    ],
    ids=["missing", "broken", "schema-2", "schema-bool", "short", "upper", "null", "array"],
)
def test_issue_836_invalid_asset_manifest_is_no_fingerprint(tmp_path: Path, assets) -> None:
    identity = read_build_identity(_tree(tmp_path, assets=assets))
    assert identity.fingerprint is None
    assert identity.build == {"channel": "dev", "source": SOURCE}


def test_issue_836_unreadable_files_never_raise(tmp_path: Path, monkeypatch) -> None:
    root = _tree(tmp_path)
    (root / "BUILD.json").unlink()
    (root / "BUILD.json").mkdir()  # IsADirectoryError on read
    assert read_build_identity(root) == BuildIdentity(fingerprint=FINGERPRINT)

    def explode(_path):
        raise RuntimeError("unexpected")

    monkeypatch.setattr(build_identity, "_read_json", explode)
    assert read_build_identity(root) is UNKNOWN_BUILD
    assert read_build_identity(tmp_path / "absent") == UNKNOWN_BUILD


def test_issue_836_shipped_tree_has_no_label_and_a_fingerprint() -> None:
    """The dev tree, betas and releases carry no BUILD.json (К1)."""
    identity = read_build_identity()
    assert identity.build is None
    assert identity.fingerprint is not None and len(identity.fingerprint) == 64


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_issue_836_setup_reads_identity_once_off_the_loop_and_registers_urls(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, tmp_path: Path, monkeypatch,
) -> None:
    monkeypatch.setattr(build_identity, "INTEGRATION_ROOT", _tree(tmp_path))
    reads: list[int] = []

    def counted(root=None):
        reads.append(threading.get_ident())
        return read_build_identity(root)

    monkeypatch.setattr(houseplan, "read_build_identity", counted)
    await _setup(hass)
    client = await hass_ws_client(hass)
    for _ in range(2):
        await client.send_json_auto_id({"type": "houseplan/config/get"})
        response = await client.receive_json()
        assert response["success"], response
        assert response["result"]["build"] == {"channel": "dev", "source": SOURCE}
        assert response["result"]["frontend_fingerprint"] == FINGERPRINT

    assert len(reads) == 1, "read once per entry setup, not per config/get"
    assert reads[0] != threading.get_ident(), "read in the executor"
    query = f"?v={VERSION}&b={FINGERPRINT[:8]}&dev={SOURCE}"
    assert get_frontend_registration_state(hass).module_url == f"{FRONTEND_URL}{query}"
    assert get_panel_registration_state(hass).panel_module_url == f"{PANEL_FRONTEND_URL}{query}"


def _labelled_copy(root: Path, version: str) -> Path:
    """The real integration in a temporary custom_components with a dev manifest."""
    real = Path(houseplan.__file__).resolve().parent
    target = root / "custom_components" / DOMAIN
    target.mkdir(parents=True)
    for entry in real.iterdir():
        if entry.name in {"manifest.json", "BUILD.json", "__pycache__"}:
            continue
        os.symlink(entry, target / entry.name)
    manifest = json.loads((real / "manifest.json").read_text(encoding="utf-8"))
    (target / "manifest.json").write_text(
        json.dumps({**manifest, "version": version}, indent=2) + "\n", encoding="utf-8"
    )
    (target / "BUILD.json").write_text(json.dumps(LABEL), encoding="utf-8")
    return target


@pytest.mark.parametrize(
    "version",
    [f"1.80.1+dev.{SOURCE[:8]}", f"1.80.1-beta.1+dev.{SOURCE[:8]}"],
)
async def test_issue_836_ha_loader_accepts_and_sets_up_a_dev_version(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, tmp_path: Path,
    monkeypatch, version: str,
) -> None:
    """AC4: the pinned HA loader itself validates the version — no regex copy."""
    target = _labelled_copy(tmp_path, version)
    monkeypatch.setattr(custom_components, "__path__", [str(target.parent)])
    monkeypatch.setattr(build_identity, "INTEGRATION_ROOT", target)
    hass.data.pop(loader.DATA_CUSTOM_COMPONENTS, None)
    hass.data[loader.DATA_INTEGRATIONS].pop(DOMAIN, None)

    integration = await loader.async_get_integration(hass, DOMAIN)

    assert Path(integration.file_path) == target
    assert str(integration.version) == version
    assert integration.manifest["version"] == version
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    response = await client.receive_json()
    assert response["success"], response
    assert response["result"]["integration_version"] == VERSION, "const.VERSION is unchanged"
    assert response["result"]["build"] == {"channel": "dev", "source": SOURCE}


async def test_issue_836_ha_loader_rejects_a_doubled_build_suffix(
    hass: HomeAssistant, tmp_path: Path, monkeypatch, caplog,
) -> None:
    """Negative control: the same loader path does refuse an invalid version."""
    version = f"1.80.1+dev.{SOURCE[:8]}+dev.{SOURCE[:8]}"
    target = _labelled_copy(tmp_path, version)
    monkeypatch.setattr(custom_components, "__path__", [str(target.parent)])
    hass.data.pop(loader.DATA_CUSTOM_COMPONENTS, None)
    hass.data[loader.DATA_INTEGRATIONS].pop(DOMAIN, None)

    with pytest.raises(loader.IntegrationNotFound):
        await loader.async_get_integration(hass, DOMAIN)
    assert f"does not have a valid version key ({version})" in caplog.text
