import { html, nothing, type TemplateResult } from 'lit';
import { field, sourcePicker } from './form-kit';
import type { MarkerDialogDraft } from './marker-form-state';
import type { DevItem } from '../types';
import type { SettingsI18nKey } from '../i18n/settings';
import { moreInfoEntityCandidates, resolveDeviceMoreInfoTarget, type MoreInfoHass } from '../device-more-info';

export function renderMarkerMoreInfo(options: {
  draft: MarkerDialogDraft; device: DevItem | null; hass: MoreInfoHass; registry: MoreInfoHass;
  t: (key: SettingsI18nKey) => string; emptyText: string;
  error?: string; change: (draft: MarkerDialogDraft) => void;
}): TemplateResult {
  const { draft: d, device, hass, registry, t, change } = options;
  const disabled = !device || d.binding === 'virtual';
  const name = (id: string) => String(registry.entities?.[id]?.name || hass.states?.[id]?.attributes?.friendly_name || id);
  const rows = device ? moreInfoEntityCandidates(device, registry).map(id => ({ value: id, label: name(id), sub: id })) : [];
  const automatic = device ? resolveDeviceMoreInfoTarget(hass, registry, {
    ...device, marker: { ...device.marker!, more_info_entity: null },
  }).entityId : undefined;
  const auto = { value: '', label: t('marker.more_info_auto'),
    sub: automatic ? `${name(automatic)} · ${automatic}` : t('marker.more_info_none') };
  const selected = typeof d.moreInfoEntity === 'string' ? d.moreInfoEntity : '';
  const missing = !!selected && (!rows.some(row => row.value === selected) || !hass.states?.[selected]);
  const current = selected ? rows.find(row => row.value === selected)
    ?? { value: selected, label: selected, sub: t('marker.more_info_missing') } : auto;
  const query = (d.moreInfoFilter || '').trim().toLocaleLowerCase();
  return html`<div data-more-info-target>
    ${field({ label: t('marker.more_info_entity'), htmlFor: 'marker-more-info-entity', error: options.error,
      help: html`<hp-help instant data-help-key="marker.more_info_help" .text=${t('marker.more_info_help')}
        .ariaLabel=${t('marker.more_info_help.aria')}></hp-help>`,
      hint: disabled ? t('marker.more_info_virtual') : undefined,
      control: sourcePicker({ id: 'marker-more-info-entity', open: !disabled && d.moreInfoOpen === true,
        current, disabled, ariaLabel: t('marker.more_info_entity'), placeholder: auto.label,
        filter: d.moreInfoFilter || '', filterPlaceholder: t('marker.more_info_search'), emptyText: options.emptyText,
        candidates: [auto, ...rows.filter(row => !query || `${row.label} ${row.value}`.toLocaleLowerCase().includes(query))],
        selected, onToggle: () => change({ ...d, moreInfoOpen: !d.moreInfoOpen }),
        onClose: () => change({ ...d, moreInfoOpen: false }),
        onFilter: value => change({ ...d, moreInfoFilter: value }),
        onPick: value => change(value === selected
          ? { ...d, moreInfoOpen: false }
          : { ...d, moreInfoEntity: value || null, moreInfoTouched: true, moreInfoOpen: false }),
      }),
    })}
    ${missing ? html`<p class="hpf-note hpf-note-warning" role="status">${t('marker.more_info_missing')}</p>` : nothing}
  </div>`;
}
