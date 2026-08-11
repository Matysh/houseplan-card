"""Shared test config. HA-harness tests (test_ha_*.py) are skipped when
homeassistant is not installed: the local sandbox has Python 3.10, CI runs them
on 3.13 with pytest-homeassistant-custom-component."""

try:
    import homeassistant  # noqa: F401
    HAS_HA = True
except ImportError:
    HAS_HA = False

collect_ignore_glob = [] if HAS_HA else ["test_ha_*.py"]

if HAS_HA:
    import shutil
    from pathlib import Path

    import pytest

    @pytest.fixture(autouse=True)
    def _clean_persistent_houseplan_test_files(request):
        """Do not let warm HA harness runs exhaust the shared file quota."""
        if "hass" in request.fixturenames:
            hass = request.getfixturevalue("hass")
            for relative in ("houseplan/plans", "houseplan/files"):
                shutil.rmtree(Path(hass.config.path(relative)), ignore_errors=True)
        yield
