"""Config flow tests (run in CI with pytest-homeassistant-custom-component)."""
import pytest


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom_components in the test hass."""
    yield

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType

from custom_components.houseplan.const import CONF_ADMIN_ONLY, DOMAIN


async def test_user_flow_creates_entry(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], user_input={CONF_ADMIN_ONLY: True}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "House Plan"
    assert result["options"] == {CONF_ADMIN_ONLY: True}


async def test_single_instance(hass: HomeAssistant) -> None:
    """manifest single_config_entry must prevent a second entry."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    await hass.config_entries.flow.async_configure(result["flow_id"], user_input={})
    result2 = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result2["type"] is FlowResultType.ABORT
    assert result2["reason"] == "single_instance_allowed"


async def test_options_flow(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    result = await hass.config_entries.flow.async_configure(result["flow_id"], user_input={})
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    await hass.async_block_till_done()  # entry is auto-set-up after the flow

    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], user_input={CONF_ADMIN_ONLY: True}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options == {CONF_ADMIN_ONLY: True}
