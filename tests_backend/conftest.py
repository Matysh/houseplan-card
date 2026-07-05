"""Shared fixtures. HA-harness tests are skipped when homeassistant is not installed
(the local sandbox has Python 3.10; CI runs them on 3.13 with
pytest-homeassistant-custom-component)."""
import pytest

try:
    import homeassistant  # noqa: F401
    HAS_HA = True
except ImportError:
    HAS_HA = False

collect_ignore_glob = [] if HAS_HA else ["test_ha_*.py"]


if HAS_HA:
    @pytest.fixture(autouse=True)
    def auto_enable_custom_integrations(enable_custom_integrations):
        """Allow loading custom_components in the test hass."""
        yield
