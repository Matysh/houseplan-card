"""Single-entry config flow with an explicit previous-installation choice."""
from __future__ import annotations

import logging
from datetime import UTC, datetime

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers.translation import async_get_translations

from .const import CONF_ADMIN_ONLY, DOMAIN
from .previous_data import ArchiveError, archive_previous_data, inspect_previous_data

_LOGGER = logging.getLogger(__name__)


class HouseplanConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Restore or archive only after the final user confirmation."""

    VERSION = 1

    def __init__(self):
        self._previous_checked = False
        self._start_fresh = False

    async def async_step_user(self, user_input=None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if self._async_in_progress(include_uninitialized=True):
            return self.async_abort(reason="already_in_progress")
        if not self._previous_checked:
            try:
                previous = await self.hass.async_add_executor_job(
                    inspect_previous_data, self.hass.config.config_dir
                )
            except OSError:
                _LOGGER.exception("Cannot inspect previous House Plan data")
                return self.async_abort(reason="previous_data_error")
            self._previous_checked = True
            if previous.found:
                self._previous = previous
                return await self.async_step_previous_data()
        if user_input is not None:
            if self._start_fresh:
                try:
                    await self.hass.async_add_executor_job(
                        archive_previous_data, self.hass.config.config_dir
                    )
                except ArchiveError:
                    return self.async_abort(reason="archive_failed")
            return self.async_create_entry(
                title="House Plan",
                data={},
                options=user_input,
                description="panel_ready",
            )
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({vol.Optional(CONF_ADMIN_ONLY, default=True): bool}),
        )

    async def async_step_previous_data(self, user_input=None):
        previous = self._previous
        translations = await async_get_translations(
            self.hass, self.hass.config.language, "config", {DOMAIN}
        )
        warning = ""
        if previous.spaces is None:
            warning = translations[f"component.{DOMAIN}.config.error.previous_data_unreadable"]
        return self.async_show_menu(
            step_id="previous_data",
            menu_options=["restore", "start_fresh"],
            description_placeholders={
                "spaces": str(previous.spaces) if previous.spaces is not None else "—",
                "files": str(previous.files),
                "modified": datetime.fromtimestamp(previous.modified, UTC).strftime(
                    "%Y-%m-%d %H:%M:%S UTC"
                ) if previous.modified is not None else "—",
                "warning": warning,
            },
        )

    async def async_step_restore(self, user_input=None):
        self._start_fresh = False
        return await self.async_step_user()

    async def async_step_start_fresh(self, user_input=None):
        self._start_fresh = True
        return await self.async_step_user()

    @staticmethod
    def async_get_options_flow(config_entry):
        return HouseplanOptionsFlow()


class HouseplanOptionsFlow(config_entries.OptionsFlow):
    """Option: layout editing by administrators only."""

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        # Match auth.may_write: missing key ⇒ admin-only (audit P0-4).
        current = self.config_entry.options.get(CONF_ADMIN_ONLY, True)
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({vol.Optional(CONF_ADMIN_ONLY, default=current): bool}),
        )
