/**
 * #600 К10 для «Общих настроек»: снимок при открытии, dirty, валидация.
 * Состояние `_settingsDialog` не получает новых ключей — снимок живёт здесь.
 */
import type { HouseplanEditorHostPort } from '../houseplan-editor-runtime';
import { dialogDirty, forgetDialogBaseline, rememberDialogBaseline, stableKey } from './dialog-baseline';

export type GeneralSettingsDraft = NonNullable<HouseplanEditorHostPort['_settingsDialog']>;

const TRANSIENT: ReadonlySet<string> = new Set(['busy']);

export function generalDraftKey(d: GeneralSettingsDraft): string {
  return stableKey(d as unknown as Record<string, unknown>, TRANSIENT);
}

export function rememberGeneralBaseline(host: object, d: GeneralSettingsDraft): void {
  rememberDialogBaseline(host, 'settings', generalDraftKey(d));
}

export function forgetGeneralBaseline(host: object): void {
  forgetDialogBaseline(host, 'settings');
}

export function generalDirty(host: object, d: GeneralSettingsDraft): boolean {
  return dialogDirty(host, 'settings', generalDraftKey(d));
}

export interface GeneralProblem {
  field: string;
  message: 'gs.error_glow_radius' | 'gs.error_north';
}

/** Ошибки черновика в порядке полей формы. */
export function generalProblems(d: GeneralSettingsDraft): GeneralProblem[] {
  const problems: GeneralProblem[] = [];
  if (!(Number.isFinite(d.glowRadius) && d.glowRadius > 0)) problems.push({ field: 'gs-glow-radius', message: 'gs.error_glow_radius' });
  if (d.northDeg !== null && !(Number.isInteger(d.northDeg) && d.northDeg >= 0 && d.northDeg <= 359)) {
    problems.push({ field: 'gs-north', message: 'gs.error_north' });
  }
  return problems;
}
