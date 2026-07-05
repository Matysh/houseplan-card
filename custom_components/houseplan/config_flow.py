"""Config flow: a single entry with no parameters."""
from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries

from .const import CONF_ADMIN_ONLY, DOMAIN


class HouseplanConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """One-step setup."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="House Plan", data={}, options=user_input)
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({vol.Optional(CONF_ADMIN_ONLY, default=False): bool}),
        )

    @staticmethod
    def async_get_options_flow(config_entry):
        return HouseplanOptionsFlow()


class HouseplanOptionsFlow(config_entries.OptionsFlow):
    """Option: layout editing by administrators only."""

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        current = self.config_entry.options.get(CONF_ADMIN_ONLY, False)
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({vol.Optional(CONF_ADMIN_ONLY, default=current): bool}),
        )
