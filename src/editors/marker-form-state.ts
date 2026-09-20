/**
 * #600 К10 для «Устройства на плане»: снимок при открытии, dirty, валидация.
 *
 * Черновик — объект `_markerDialog`; транзиентные ключи (раскрытие и фильтры
 * списков, busy, объявление подсказки, presentation-only autoIcon, id загрузки)
 * в отпечаток не входят. Флаги `*Touched` и `original*` входят: они меняются
 * только действием человека, и это тоже изменение.
 */
import { strictNumber } from '../space-dialog';
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
  message: 'marker.error_binding' | 'marker.error_glow_radius';
}

/** Радиус: пусто (общий радиус) либо положительное число — тем же парсером, что и запись. */
export function glowRadiusValid(raw: string): boolean {
  if (!raw.trim()) return true;
  const n = strictNumber(raw);
  return n !== null && n > 0;
}

/**
 * Ошибки черновика (§7 референса): привязка обязательна в режиме HA (прежнее
 * условие Save, теперь названное словами), радиус свечения — положительное число
 * либо пусто (общий радиус).
 */
export function markerProblems(d: MarkerDialogDraft): MarkerProblem[] {
  const problems: MarkerProblem[] = [];
  if (d.bindingMode === 'ha' && (!d.binding || d.binding === 'virtual')) {
    problems.push({ field: 'marker-binding', message: 'marker.error_binding' });
  }
  if (!glowRadiusValid(d.glowRadius)) {
    problems.push({ field: 'marker-glow-radius', message: 'marker.error_glow_radius' });
  }
  return problems;
}
