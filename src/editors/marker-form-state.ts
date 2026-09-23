/**
 * #600 К10 для «Устройства на плане»: снимок при открытии, dirty, валидация.
 *
 * Черновик — объект `_markerDialog`; транзиентные ключи (раскрытие и фильтры
 * списков, busy, объявление подсказки, presentation-only autoIcon, id загрузки)
 * в отпечаток не входят. Флаги `*Touched` и `original*` входят: они меняются
 * только действием человека, и это тоже изменение.
 */
import type { HouseplanEditorHostPort } from '../houseplan-editor-runtime';
import { dialogDirty, forgetDialogBaseline, rememberDialogBaseline, stableKey } from './dialog-baseline';

export type MarkerDialogDraft = NonNullable<HouseplanEditorHostPort['_markerDialog']>;

export const MARKER_DIALOG_TRANSIENT_KEYS: ReadonlySet<string> = new Set([
  'bindingOpen', 'bindingFilter', 'runFilter', 'controlsFilter', 'busy', 'tapHintAnnouncement', 'uploadId', 'autoIcon',
]);

export function markerDraftKey(d: MarkerDialogDraft): string {
  return stableKey(d as unknown as Record<string, unknown>, MARKER_DIALOG_TRANSIENT_KEYS);
}

export function rememberMarkerBaseline(host: object, d: MarkerDialogDraft): void {
  rememberDialogBaseline(host, 'marker', markerDraftKey(d));
}

export function forgetMarkerBaseline(host: object): void {
  forgetDialogBaseline(host, 'marker');
}

export function markerDirty(host: object, d: MarkerDialogDraft): boolean {
  return dialogDirty(host, 'marker', markerDraftKey(d));
}

export interface MarkerProblem {
  field: string;
  message: 'marker.error_binding' | 'marker.error_virtual_name'
    | 'marker.error_run_target' | 'marker.error_value_badge_source';
}

/**
 * Ошибки черновика: привязка обязательна в режиме HA — прежнее условие Save,
 * теперь названное словами под полем. Радиус свечения ошибкой **не является**
 * (ревью #600 r1, M2): как и на `dev`, непустое нечисло или неположительное
 * значение при сохранении молча становится «общим радиусом» (`null`), и К10
 * закрытым списком других условий не называет.
 */
export function markerProblems(d: MarkerDialogDraft, effectiveTapAction = d.tapAction): MarkerProblem[] {
  const problems: MarkerProblem[] = [];
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
  return problems;
}
