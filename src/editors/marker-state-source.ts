import { html, nothing, type TemplateResult } from 'lit';
import { field } from './form-kit';
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
  change: (draft: MarkerDialogDraft) => void;
}): TemplateResult {
  const { draft: d, registry, hass, protectedFace, t, change } = options;
  const source = d.stateSource;
  const eid = typeof source?.entity_id === 'string' ? source.entity_id : '';
  const candidates = markerStateSourceCandidates(d.binding, registry);
  const disabled = d.binding === 'virtual' || protectedFace;
  const explicit = source?.active_states !== undefined;
  const states = Array.isArray(source?.active_states) ? source.active_states : [];
  const filter = (d.stateSourceFilter || '').toLowerCase();
  const setStates = (values: string[]) => change({ ...d, stateSource: { ...source, entity_id: eid, active_states: values }, stateSourceTouched: true });
  const current = hass.states?.[eid]?.state;
  return html`<div data-state-source>
    ${field({ label: t('marker.state_source'), htmlFor: 'marker-state-source',
      hint: t(disabled ? protectedFace ? 'marker.state_source_special' : 'marker.state_source_virtual' : 'marker.state_source_help'),
      control: html`<hp-settings-select><select id="marker-state-source" ?disabled=${disabled}
        @change=${(e: Event) => change({ ...d, stateSource: (e.target as HTMLSelectElement).value
          ? { entity_id: (e.target as HTMLSelectElement).value } : null, stateSourceTouched: true })}>
        <option value="" ?selected=${disabled || source == null}>${t('marker.state_source_auto')}</option>
        ${!disabled && source != null && !candidates.includes(eid) ? html`<option selected value=${eid || '__invalid__'}>${eid || t('marker.state_source_invalid')}</option>` : nothing}
        ${candidates.filter(id => !filter || id === eid || `${id} ${registry.entities?.[id]?.name || ''} ${hass.states?.[id]?.attributes?.friendly_name || ''}`.toLowerCase().includes(filter))
          .map(id => html`<option value=${id} ?selected=${!disabled && id === eid}>
            ${String(registry.entities?.[id]?.name || hass.states?.[id]?.attributes?.friendly_name || id)} · ${id} · ${String(hass.states?.[id]?.state ?? '—')}
          </option>`)}
      </select></hp-settings-select>`,
    })}
    ${!disabled && candidates.length > 8 ? field({ label: t('marker.state_source_own_only'), htmlFor: 'marker-state-source-filter',
      control: html`<input id="marker-state-source-filter" class="hpf-input" type="search" .value=${d.stateSourceFilter || ''}
        @input=${(e: Event) => change({ ...d, stateSourceFilter: (e.target as HTMLInputElement).value })}>`,
    }) : nothing}
    ${!disabled && source != null ? html`
      ${field({ label: t('marker.state_source_active_when'), htmlFor: 'marker-state-source-mode',
        control: html`<hp-settings-select><select id="marker-state-source-mode"
          @change=${(e: Event) => {
            const next = { ...source, entity_id: eid }; delete next.active_states;
            if ((e.target as HTMLSelectElement).value === 'states') next.active_states = [];
            change({ ...d, stateSource: next, stateSourceTouched: true });
          }}>
          <option value="standard" ?selected=${!explicit}>${t('marker.state_source_standard')}</option>
          <option value="states" ?selected=${explicit}>${t('marker.state_source_active_when')}</option>
        </select></hp-settings-select>`,
      })}
      ${explicit ? html`<div class="hpf-field" id="marker-state-source-states">
        <p class="hpf-hint">${t('marker.state_source_states_help')} <code>${String(current ?? '—')}</code></p>
        ${states.map((state, index) => html`<div class="hpf-inline">
          <input class="hpf-input" aria-label=${t('marker.state_source_active_when')} .value=${state}
            @input=${(e: Event) => setStates(states.map((old, i) => i === index ? (e.target as HTMLInputElement).value : old))}>
          <button type="button" class="btn ghost" aria-label=${t('marker.state_source_state_remove')}
            @click=${() => setStates(states.filter((_, i) => i !== index))}>×</button>
        </div>`)}
        <button type="button" class="btn ghost" @click=${() => setStates([...states, ''])}>${t('marker.state_source_state_add')}</button>
      </div>` : nothing}
      ${!normalizeMarkerStateSource(source) ? html`<p class="hpf-note hpf-note-warning" role="alert">${t('marker.state_source_states_invalid')}</p>` : nothing}
    ` : nothing}
  </div>`;
}
