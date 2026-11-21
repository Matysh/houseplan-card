/**
 * #600 К10 для «Устройства на плане»: снимок при открытии, dirty, валидация.
 *
 * Черновик — объект `_markerDialog`; транзиентные ключи (раскрытие и фильтры
 * списков, busy, объявление подсказки, presentation-only autoIcon, id загрузки)
 * в отпечаток не входят. Флаги `*Touched` и `original*` входят: они меняются
 * только действием человека, и это тоже изменение.
 */
import type { HouseplanEditorHostPort } from '../houseplan-editor-runtime';
import { dialogDirty, dialogSession, forgetDialogBaseline, rememberDialogBaseline, stableKey } from './dialog-baseline';
import { strictNumber } from '../space-dialog';
import { normalizeMarkerStateSource } from '../marker-state-source';

export type MarkerDialogDraft = NonNullable<HouseplanEditorHostPort['_markerDialog']>;

// UI-only undo state: never add a removal snapshot to the saved marker/draft.
const radarRemovals = new WeakMap<object, {
  owner: object | undefined;
  radar: MarkerDialogDraft['radar'];
  touched: boolean;
}>();

export function rememberMarkerRadarRemoval(host: object, d: MarkerDialogDraft): void {
  radarRemovals.set(host, { owner: dialogSession(host, 'marker'), radar: d.radar, touched: d.radarTouched });
}

export function restoreMarkerRadarRemoval(host: object, d: MarkerDialogDraft): MarkerDialogDraft {
  const saved = radarRemovals.get(host);
  radarRemovals.delete(host);
  return {
    ...d,
    radarRemove: false,
    // Preserve edits made before removal. An untouched opaque future profile
    // has no editable draft: restoring it must keep the raw saved configuration.
    radarTouched: saved && saved.owner === dialogSession(host, 'marker') && saved.radar === d.radar
      ? saved.touched : d.radar ? d.radarTouched : false,
  };
}

export const MARKER_DIALOG_TRANSIENT_KEYS: ReadonlySet<string> = new Set([
  'bindingOpen', 'bindingFilter', 'moreInfoOpen', 'moreInfoFilter', 'stateSourceOpen', 'stateSourceFilter', 'runFilter', 'controlsFilter', 'busy', 'tapHintAnnouncement', 'uploadId', 'autoIcon',
]);

export function markerDraftKey(d: MarkerDialogDraft): string {
  return stableKey(d as unknown as Record<string, unknown>, MARKER_DIALOG_TRANSIENT_KEYS);
}

export function rememberMarkerBaseline(host: object, d: MarkerDialogDraft): void {
  radarRemovals.delete(host);
  rememberDialogBaseline(host, 'marker', markerDraftKey(d));
}

export function forgetMarkerBaseline(host: object): void {
  radarRemovals.delete(host);
  forgetDialogBaseline(host, 'marker');
}

export function markerDirty(host: object, d: MarkerDialogDraft): boolean {
  return dialogDirty(host, 'marker', markerDraftKey(d));
}

export interface MarkerProblem {
  field: string;
  message: 'marker.error_binding' | 'marker.error_virtual_name'
    | 'marker.error_text_length' | 'marker.error_link_length' | 'marker.error_description_length'
    | 'marker.error_glow_radius' | 'marker.error_numeric_range' | 'marker.more_info_invalid' | 'marker.error_run_target' | 'marker.error_value_badge_source' | 'marker.state_source_states_invalid';
}

/** Validate the complete draft, including fields in inactive settings sections. */
export function markerProblems(d: MarkerDialogDraft, effectiveTapAction = d.tapAction, moreInfoInvalid = false, imperial = false): MarkerProblem[] {
  const problems: MarkerProblem[] = [];
  if (moreInfoInvalid) problems.push({ field: 'marker-more-info-entity', message: 'marker.more_info_invalid' });
  if (d.stateSourceTouched && d.stateSource != null && !normalizeMarkerStateSource(d.stateSource)) {
    problems.push({ field: 'marker-state-source-states', message: 'marker.state_source_states_invalid' });
  }
  if (d.binding === 'virtual' && !d.name.trim()) {
    problems.push({ field: 'marker-name', message: 'marker.error_virtual_name' });
  }
  if (d.bindingMode === 'ha' && (!d.binding || d.binding === 'virtual')) {
    problems.push({ field: 'marker-binding', message: 'marker.error_binding' });
  }
  if (effectiveTapAction === 'run' && !d.tapTarget) {
    problems.push({ field: 'marker-run-target', message: 'marker.error_run_target' });
  }
  if (d.valueBadgeTouched && d.valueBadgeEnabled && !d.valueBadgeSource) {
    problems.push({ field: 'marker-value-badge-source', message: 'marker.error_value_badge_source' });
  }
  for (const [field, value, limit, message] of [
    ['marker-name', d.name, 500, 'marker.error_text_length'],
    ['marker-icon', d.icon, 500, 'marker.error_text_length'],
    ['marker-model', d.model, 500, 'marker.error_text_length'],
    ['marker-link', d.link, 2000, 'marker.error_link_length'],
    ['marker-description', d.description, 4000, 'marker.error_description_length'],
  ] as const) if (typeof value === 'string' && Array.from(field === 'marker-icon' ? value : value.trim()).length > limit)
    problems.push({ field, message });
  const radius = (d.glowRadius || '').trim(), n = strictNumber(radius);
  const cm = n == null ? null : Math.round(n * (imperial ? 30.48 : 100));
  if (d.glowRadiusBadInput || radius && (cm == null || cm < 10 || cm > 10000))
    problems.push({ field: 'marker-glow-radius', message: 'marker.error_glow_radius' });
  for (const [field, value, min, max] of [
    ['marker-size', d.size, .2, 6], ['marker-ripple-size', d.rippleSize, 1, 20], ['marker-angle', d.angle, -360, 360],
  ] as const) if (value !== undefined && (!Number.isFinite(value) || value < min || value > max))
    problems.push({ field, message: 'marker.error_numeric_range' });
  return problems;
}
