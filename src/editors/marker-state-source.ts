import { html, nothing, type TemplateResult } from 'lit';
import { field, sourcePicker } from './form-kit';
import type { MarkerDialogDraft } from './marker-form-state';
import { markerStateSourceCandidates, normalizeMarkerStateSource, type StateSourceHass } from '../marker-state-source';
import type { SettingsI18nKey } from '../i18n/settings';

/** A form only: source semantics and diagnostics come from the shared resolver. */
export function renderMarkerStateSource(options: {
  draft: MarkerDialogDraft;
  registry: StateSourceHass;
  hass: StateSourceHass;
  protectedFace: boolean;
  t: (key: SettingsI18nKey) => string;
  searchPlaceholder: string;
  emptyText: string;
  change: (draft: MarkerDialogDraft) => void;
}): TemplateResult {
  const { draft: d, registry, hass, protectedFace, t, change, searchPlaceholder, emptyText } = options;
  const source = d.stateSource;
  const eid = typeof source?.entity_id === 'string' ? source.entity_id : '';
  const candidates = markerStateSourceCandidates(d.binding, registry);
  const disabled = d.binding === 'virtual' || protectedFace;
  // Build rows only from proven eligible IDs; stale saved IDs never read HA state.
  const rows = disabled ? [] : candidates.map(id => {
    const entity = hass.states?.[id];
    return { value: id, label: String(registry.entities?.[id]?.name || entity?.attributes?.friendly_name || id),
      sub: `${id} · ${String(entity?.state ?? '—')}` };
  });
  const auto = { value: '', label: t('marker.state_source_auto'), sub: '' };
  const query = (d.stateSourceFilter ?? '').trim().toLocaleLowerCase();
  const open = !disabled && d.stateSourceOpen === true;
  const current = disabled || source == null ? auto : rows.find(row => row.value === eid)
    ?? { label: eid || t('marker.state_source_invalid'), sub: '' };
  const explicit = source?.active_states !== undefined;
  const state = Array.isArray(source?.active_states) ? source.active_states[0] ?? '' : '';
  return html`<div data-state-source>
    ${field({ label: t('marker.state_source'), htmlFor: 'marker-state-source',
      hint: t(disabled ? protectedFace ? 'marker.state_source_special' : 'marker.state_source_virtual' : 'marker.state_source_help'),
      control: sourcePicker({
        id: 'marker-state-source', open, current, disabled,
        placeholder: auto.label, ariaLabel: t('marker.state_source'),
        filter: d.stateSourceFilter ?? '', filterPlaceholder: searchPlaceholder, emptyText,
        candidates: [auto, ...rows.filter(row => !query || `${row.label} ${row.value}`.toLocaleLowerCase().includes(query))],
        selected: disabled || source == null ? '' : eid || '__invalid__',
        onToggle: () => change({ ...d, stateSourceOpen: !open }),
        onClose: () => change({ ...d, stateSourceOpen: false }),
        onFilter: value => change({ ...d, stateSourceFilter: value }),
        onPick: value => change(value === eid && (value !== '' || source == null)
          ? { ...d, stateSourceOpen: false }
          : { ...d, stateSourceOpen: false, stateSource: value ? { entity_id: value } : null, stateSourceTouched: true }),
      }),
    })}
    ${!disabled && source != null ? html`
      ${field({ label: t('marker.state_source_active_when'), htmlFor: 'marker-state-source-mode',
        help: html`<hp-help instant data-help-key="marker.state_source_mode_help"
          .text=${t('marker.state_source_mode_help')} .ariaLabel=${t('marker.state_source_mode_help.aria')}></hp-help>`,
        control: html`<hp-settings-select><select id="marker-state-source-mode"
          @change=${(e: Event) => {
            const next = { ...source, entity_id: eid }; delete next.active_states;
            if ((e.target as HTMLSelectElement).value === 'states') next.active_states = [];
            change({ ...d, stateSource: next, stateSourceTouched: true });
          }}>
          <option value="standard" ?selected=${!explicit}>${t('marker.state_source_standard')}</option>
          <option value="states" ?selected=${explicit}>${t('marker.state_source_manual')}</option>
        </select></hp-settings-select>`,
      })}
      ${explicit ? html`<div class="hpf-field" id="marker-state-source-states">
        <input class="hpf-input" aria-label=${t('marker.state_source_active_when')} .value=${state}
          @input=${(e: Event) => change({ ...d, stateSource: { ...source, entity_id: eid,
            active_states: [(e.target as HTMLInputElement).value] }, stateSourceTouched: true })}>
      </div>` : nothing}
      ${!normalizeMarkerStateSource(source) ? html`<p class="hpf-note hpf-note-warning" role="alert">${t('marker.state_source_states_invalid')}</p>` : nothing}
    ` : nothing}
  </div>`;
}
