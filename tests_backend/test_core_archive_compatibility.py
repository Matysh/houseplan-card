"""Historical native archive reader conformance uses frozen stable producers."""
import hashlib
import shutil
from pathlib import Path

import pytest

from custom_components.houseplan.core.archive_conformance import run_archives
from custom_components.houseplan.core.conformance import run_archives as public_run_archives

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "demo/fixtures/core-compatibility"


def test_stable_plan_transfer_and_full_backup_are_read_by_current_core():
    completed = public_run_archives()
    assert len(completed) == 4
    assert all(version in " ".join(completed) for version in ("v1.86.0", "v1.86.1"))


def test_changed_historical_archive_fails_before_reader(tmp_path):
    shutil.copytree(FIXTURES, tmp_path / "fixtures")
    archive = tmp_path / "fixtures/v1.86.1/plan-transfer.zip"
    original = archive.read_bytes()
    archive.write_bytes(original[:-1] + bytes([original[-1] ^ 1]))
    assert hashlib.sha256(archive.read_bytes()).digest() != hashlib.sha256(original).digest()
    with pytest.raises(AssertionError):
        run_archives(tmp_path / "fixtures")
