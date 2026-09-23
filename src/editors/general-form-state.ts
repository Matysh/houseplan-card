/**
 * #600 К10 для «Общих настроек»: снимок при открытии, dirty, валидация.
 * Состояние `_settingsDialog` не получает новых ключей — снимок живёт здесь.
 */
import type { HouseplanEditorHostPort } from '../houseplan-editor-runtime';
import { strictNumber } from '../space-dialog';
import { dialogDirty, forgetDialogBaseline, rememberDialogBaseline, stableKey } from './dialog-baseline';

export type GeneralSettingsDraft = NonNullable<HouseplanEditorHostPort['_settingsDialog']>;

const TRANSIENT: ReadonlySet<string> = new Set(['busy', 'glowRadiusInput', 'northDegInput']);

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
  const glow = strictNumber(d.glowRadiusInput);
  if (!(glow !== null && glow > 0)) problems.push({ field: 'gs-glow-radius', message: 'gs.error_glow_radius' });
  const northRaw = d.northDegInput.trim();
  const north = northRaw === '' ? null : strictNumber(northRaw);
  if (northRaw !== '' && !(north !== null && Number.isInteger(north) && north >= 0 && north <= 359)) {
    problems.push({ field: 'gs-north', message: 'gs.error_north' });
  }
  return problems;
}
