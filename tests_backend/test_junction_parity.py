"""Infrastructure contract of the fail-closed junction parity harness (#548)."""
from pathlib import Path
import os
import subprocess
import sys

import pytest

from junction_parity import DEFAULT_FIXTURE, frontend_rules, load_backend_validator, load_spaces


def test_module_entry_loads_canonical_backend_without_pythonpath():
    """The nightly command must work in a fresh interpreter, not pytest's path."""
    result = subprocess.run(
        [sys.executable, "-m", "tests_backend.junction_parity", "--help"],
        cwd=Path(__file__).resolve().parent.parent,
        env={key: value for key, value in os.environ.items() if key != "PYTHONPATH"},
        capture_output=True, text=True, check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "--build-dir" in result.stdout


def test_shared_fixture_is_nonempty_and_loads_every_named_scenario():
    spaces = load_spaces(DEFAULT_FIXTURE)
    assert len(spaces) == 15
    assert "angle-14" in spaces
    assert "distance-5-exact" in spaces
    assert "debris-node" in spaces


def test_missing_typescript_build_is_a_setup_failure_not_a_skip(tmp_path: Path):
    spaces = load_spaces(DEFAULT_FIXTURE, validator=load_backend_validator())
    with pytest.raises(FileNotFoundError, match="prerequisites are missing"):
        frontend_rules(spaces, build_dir=tmp_path / "missing-build")
