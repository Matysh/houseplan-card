/** UI-059 using the shared form controls, with no persistence or global lab state. */
import { html, nothing, type TemplateResult } from 'lit';
import { selectControl } from '../settings-select-control';
import { helpLabel } from './form-kit';
import { draftWindowFeatures, type OpeningDialogDraft } from '../opening-dialog-model';
import { openingSlideDirection, resolveOpeningPosition, type OpeningStateReader } from '../opening-features';
import type { MotionOpeningFeatures, OpeningLeaf, OpeningManualPosition } from '../types';

export interface OpeningFeatureFieldOptions {
  sensors?: boolean;
  part?: 'all' | 'mechanism' | 'position';
  draft: OpeningDialogDraft;
  setDraft(value: OpeningDialogDraft): void;
  t(key: string, params?: Record<string, string | number>): string;
  read: OpeningStateReader;
  contacts: readonly { value: string; label: string }[];
  shadeContacts: readonly { value: string; label: string }[];
  directionOptions: readonly { value: 'negative' | 'positive'; label: string }[];
  sourceName(entity: string): string;
  bool(value: boolean, change: (value: boolean) => void, disabled: boolean, field: string): TemplateResult;
  preview?: TemplateResult;
  disabled: boolean;
  confirmRemove(leaf: OpeningLeaf, index: number): Promise<boolean>;
}

export function openingFeatureFields(o: OpeningFeatureFieldOptions): TemplateResult {
  const { draft: d, t } = o;
  if (d.openingFeatures && d.openingFeatures.version !== 1) {
    return html`<div class="rhint" role="status">${t('opening.features.unavailable')}</div>`;
  }
  const help = (key: string) => html`<hp-help .ariaLabel=${t(`opening.features.${key}`)} .text=${t(`opening.features.help_${key}`)}></hp-help>`;
  const caption = (key: string) => helpLabel(t(`opening.features.${key}`), help(key));
  const label = (key: string) => html`<label>${caption(key)}</label>`;
  const positionLabel = (amount: number | null) => t(`opening.features.${amount === null ? 'unknown'
    : amount === 0 ? 'closed' : amount === 1 ? 'open' : 'partial'}`);
  const shadeStatus = (leaf: OpeningLeaf) => {
    const amount = resolveOpeningPosition(leaf.shade || {}, 'open', o.read).amount;
    return { icon: amount === null ? 'mdi:help-circle-outline' : amount === 0 ? 'mdi:weather-sunny-off' : 'mdi:weather-sunny',
      text: t(`opening.features.${amount === null ? 'shade_unknown' : amount === 0 ? 'light_blocked' : 'light_passes'}`) };
  };
  const manualField = (config: { manual?: OpeningManualPosition; contact?: string | null; invert?: boolean },
    fallback: OpeningManualPosition, field: string, change: (value: OpeningManualPosition) => void) => {
    const state = resolveOpeningPosition(config, fallback, o.read);
    const value = state.amount === null ? 'unknown' : state.amount === 0 ? 'closed' : state.amount === 1 ? 'open' : 'partial';
    const options = ['open', 'closed', ...(value === 'unknown' || value === 'partial' ? [value] : [])]
      .map(item => ({ value: item, label: t(`opening.features.${item}`) }));
    const key = field === 'opening-leaf-position' ? 'leaf_position' : field === 'opening-shade-position' ? 'shade_position' : 'position';
    return html`<div class="opening-leaf-field">${label(key)}${selectControl({ name: field, value, options,
      disabled: o.disabled || !!config.contact, onChange: next => change(next as OpeningManualPosition) })}
      </div>
      ${config.contact ? html`<div class="rhint">${t('opening.features.source_reason', {
        source: o.sourceName(config.contact), state: positionLabel(state.amount),
      })}</div>` : nothing}`;
  };
  if (d.type === 'door' || d.type === 'gate') {
    const features: MotionOpeningFeatures = { version: 1, ...d.openingFeatures };
    const change = (patch: Partial<MotionOpeningFeatures>) => o.setDraft({ ...d,
      openingFeatures: { ...features, ...patch }, featuresTouched: true });
    if (o.part === 'position') return html`${manualField({ contact:d.contact, invert:d.invert, manual:features.manual },
      'open', 'opening-position', manual=>change({manual}))}`;
    return html`${label('mechanism')}${selectControl({ name: 'opening-mechanism', value: features.mechanism || 'swing',
      options: ['swing', 'slide'].map(value => ({ value, label: t(`opening.features.${value}`) })),
      disabled: o.disabled, onChange: mechanism => change({ mechanism: mechanism as 'swing' | 'slide' }) })}
      ${features.mechanism === 'slide' ? html`${label('slide_direction')}${selectControl({
        name: 'opening-slide-direction', value: openingSlideDirection(features),
        options: ['start', 'end'].map(value => ({ value, label: t(`opening.features.${value}`) })),
        disabled: o.disabled, onChange: direction => change({ slide_direction: direction as 'start' | 'end' }),
      })}` : nothing}
      ${o.part === 'mechanism' ? nothing : manualField({ contact: d.contact, invert: d.invert, manual: features.manual }, 'open', 'opening-position', manual => change({ manual }))}`;
  }
  if (d.type !== 'window') return html``;
  const features = draftWindowFeatures(d), edit = d.editingLeaf;
  const publish = () => o.setDraft({ ...d, openingFeatures: features, featuresTouched: true });
  if (!edit) return html`
    ${label('direction')}${selectControl({ name: 'opening-window-side', value: features.side,
      options: [...o.directionOptions], disabled: o.disabled,
      onChange: side => { features.side = side; publish(); } })}
    <section class="opening-leaf-list-section">
      <div class="opening-leaf-heading"><strong>${t('opening.features.leaves')}</strong>
        <span class="hpf-action-help"><button type="button" class="btn ghost hpf-action-icon"
          data-hp="action" data-action="opening-leaf-add" aria-label=${t('opening.features.add')}
          ?disabled=${o.disabled || features.leaves.length >= 4} @click=${() => {
            // HA is also served on LAN HTTP, where randomUUID is unavailable.
            const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
            features.leaves.push({ id: `leaf-${id}`, hinge: 'start', manual: 'closed' }); publish();
          }}><ha-icon icon="mdi:plus"></ha-icon></button>
          <hp-help .ariaLabel=${t('opening.features.add')} .text=${t('opening.features.help_leaves')}></hp-help></span>
      </div>
      <div class="opening-leaf-list">${features.leaves.map((leaf, index) => {
        const state = resolveOpeningPosition(leaf, 'closed', o.read);
        return html`<div class="opening-leaf-row">
          <button type="button" class="btn ghost hpf-action-option opening-leaf-open" data-hp="action"
            data-action="opening-leaf-edit" data-leaf-id=${leaf.id} ?disabled=${o.disabled}
            @click=${() => o.setDraft({ ...d, editingLeaf: { id: leaf.id, value: structuredClone(leaf), dirty: false } })}>
            <ha-icon icon=${state.amount ? 'mdi:window-open-variant' : 'mdi:window-closed-variant'}></ha-icon>
            <span class="opening-leaf-copy"><strong>${t('opening.features.leaf', { number: index + 1 })}</strong>
              <small>${positionLabel(state.amount)} · ${leaf.contact ? o.sourceName(leaf.contact) : t('opening.features.manual')}</small></span>
            ${leaf.shade?.enabled ? html`<ha-icon icon=${shadeStatus(leaf).icon}
              data-hp-tooltip=${shadeStatus(leaf).text} aria-label=${shadeStatus(leaf).text}></ha-icon>` : nothing}
            <ha-icon icon="mdi:chevron-right"></ha-icon>
          </button>
          <span class="hpf-action-help"><button type="button" class="btn ghost hpf-action-icon" data-hp="action"
            data-action="opening-leaf-remove" data-leaf-id=${leaf.id} aria-label=${t('opening.features.remove')}
            ?disabled=${o.disabled || features.leaves.length <= 1} @click=${async () => {
              if (await o.confirmRemove(leaf, index)) { features.leaves.splice(index, 1); publish(); }
            }}><ha-icon icon="mdi:minus"></ha-icon></button>
            <hp-help .ariaLabel=${t('opening.features.remove')} .text=${t('opening.features.help_leaves')}></hp-help></span>
        </div>`;
      })}</div>
      ${features.leaves.length === 4 ? html`<p class="rhint opening-leaf-limit">${t('opening.features.limit')}</p>` : nothing}
    </section>`;
  const leaf = edit.value;
  const change = (patch: Partial<OpeningLeaf>) => o.setDraft({ ...d,
    editingLeaf: { ...edit, value: { ...leaf, ...patch }, dirty: true } });
  const shade = leaf.shade || { enabled: false, manual: 'open' as const };
  const choose = (key: string, value: string, options: readonly { value: string; label: string }[], onChange: (value: string) => void) =>
    html`<div class="opening-leaf-field">${label(key)}${selectControl({ name: `opening-leaf-${key}`, value,
      options: [{ value: '', label: t('opening.none') }, ...options,
        ...(value && !options.some(item => item.value === value) ? [{ value, label: o.sourceName(value) }] : [])],
      disabled: o.disabled, onChange })}</div>`;
  return html`<div class="opening-leaf-form" data-kind="window-leaf">${o.preview || nothing}
    <div class="opening-leaf-group">
      ${o.sensors === false ? nothing : choose('contact', leaf.contact || '', o.contacts, contact => change({ contact: contact || null }))}
      ${o.sensors !== false && leaf.contact ? html`<label class="hpf-check hpf-check-wrap srcrow">${o.bool(!!leaf.invert,
        invert => change({ invert }), o.disabled, 'opening-leaf-invert')}<span>${caption('invert')}</span></label>` : nothing}
      ${manualField(leaf, 'closed', 'opening-leaf-position', manual => change({ manual }))}
      <div class="opening-leaf-field">${label('hinge')}${selectControl({ name: 'opening-leaf-hinge', value: leaf.hinge,
        options: ['start', 'end', 'top'].map(value => ({ value, label: t(`opening.features.hinge_${value}`) })),
        disabled: o.disabled, onChange: hinge => change({ hinge: hinge as OpeningLeaf['hinge'] }) })}</div>
    </div>
    <div class="opening-leaf-group">
      <label class="hpf-check hpf-check-wrap srcrow">${o.bool(shade.enabled, enabled => change({ shade: { ...shade, enabled } }),
        o.disabled, 'opening-leaf-shade')}<span>${caption('shade')}</span></label>
      ${shade.enabled ? html`
        ${o.sensors === false ? nothing : choose('shade_contact', shade.contact || '', o.shadeContacts, contact => change({ shade: { ...shade, contact: contact || null } }))}
        ${o.sensors !== false && shade.contact ? html`<label class="hpf-check hpf-check-wrap srcrow">${o.bool(!!shade.invert,
          invert => change({ shade: { ...shade, invert } }), o.disabled, 'opening-shade-invert')}<span>${caption('invert')}</span></label>` : nothing}
        ${manualField(shade, 'open', 'opening-shade-position', manual => change({ shade: { ...shade, manual } }))}
        <div class="opening-leaf-status"><ha-icon icon=${shadeStatus(leaf).icon}></ha-icon><span>${shadeStatus(leaf).text}</span></div>
        <div class="rhint">${t('opening.features.shade_hint')}</div>` : nothing}
    </div>
  </div>`;
}
