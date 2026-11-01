import { html, type TemplateResult } from 'lit';
import type { I18nKey } from './i18n';

/** Shared direct actions; responsive placement belongs to the intrinsic header. */
export function renderHiddenDevicesToggle(t: (key: I18nKey) => string, shown: boolean, run: () => void): TemplateResult {
  return html`<button class="btn hpf-icon-action header-action hidden-devices-button ${shown ? 'on' : ''}" data-hp="hidden-devices"
    data-hp-tooltip=${t('hidden_devices.show')} aria-label=${t('hidden_devices.show')} aria-pressed=${String(shown)} @click=${run}>
    <ha-icon icon=${shown ? 'mdi:eye-outline' : 'mdi:eye-off-outline'}></ha-icon></button>`;
}

export function renderHeaderActions(
  t: (key: I18nKey) => string, open: { settings(): void; pdf(): void; support(): void },
): TemplateResult {
  return html`<button class="btn hpf-icon-action header-action settings-button" data-hp="settings" @click=${open.settings} data-hp-tooltip=${t('title.general_settings')} aria-label=${t('title.general_settings')}>
      <ha-icon icon="mdi:cog-outline"></ha-icon>
    </button>
    <button class="btn hpf-icon-action header-action pdf-button" data-hp="pdf" @click=${open.pdf}
      data-hp-tooltip=${t('title.export_pdf')} aria-label=${t('title.export_pdf')}>
      <ha-icon icon="mdi:printer-outline"></ha-icon>
    </button>
    <button class="btn hpf-icon-action header-action support-button" data-hp="support" @click=${open.support}
      data-hp-tooltip=${t('support.title')} aria-label=${t('support.title')}>
      <ha-icon icon="mdi:help-circle-outline"></ha-icon>
    </button>`;
}
