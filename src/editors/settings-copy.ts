/**
 * #600: строки ленивого словаря `i18n/settings` для форм диалогов — текст и «?».
 *
 * Новые строки диалогов настроек не попадают в первый кадр (К8): они живут в
 * ленивом словаре, и форма читает их через `st`, а справку «?» — через `shelp`,
 * который, как и `_help`, требует и текст, и aria-подпись.
 */
import { html, nothing, type TemplateResult } from 'lit';

import { langOf } from '../i18n';
import { hasSettingsTranslation, settingsT, type SettingsI18nKey } from '../i18n/settings';
import type { HouseplanEditorHostPort } from '../houseplan-editor-runtime';

export interface SettingsCopy {
  st(key: SettingsI18nKey, vars?: Record<string, string | number>): string;
  /** «?» из ленивого словаря: текст и aria-подпись обязаны быть оба. */
  shelp(key: SettingsI18nKey): TemplateResult | typeof nothing;
}

export function settingsCopy(host: Pick<HouseplanEditorHostPort, 'hass' | '_config'>): SettingsCopy {
  const lang = langOf(host.hass, host._config?.language);
  return {
    st: (key, vars) => settingsT(lang, key, vars),
    shelp: (key) => {
      const ariaKey = `${key}.aria`;
      if (!hasSettingsTranslation(lang, key) || !hasSettingsTranslation(lang, ariaKey)) return nothing;
      return html`<hp-help data-help-key=${key} .text=${settingsT(lang, key)} .ariaLabel=${settingsT(lang, ariaKey)}></hp-help>`;
    },
  };
}
