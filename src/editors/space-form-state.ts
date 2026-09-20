/**
 * #600 К10: «Сохранить» только при изменениях и вопрос при закрытии.
 *
 * Dirty считается сравнением нормализованного черновика со снимком, сделанным
 * при открытии диалога. Ничего не персистится: снимок живёт в памяти рантайма и
 * привязан к хосту — `SpaceDialogState` не получает ни одного нового ключа
 * (ТЗ: состояние диалога не меняется).
 *
 * Модуль лежит в `editors/`, а не в `space-dialog.ts`: тот входит в стартовый
 * граф, а эта логика нужна только открытому диалогу (К8).
 */
import type { SpaceDialogState } from '../space-dialog';
import { dialogDirty, forgetDialogBaseline, rememberDialogBaseline, stableKey } from './dialog-baseline';

/**
 * Ключи, которые не являются настройками: транзиентные поля пикера файлов,
 * занятость, сырой ввод масштаба, копирование, блокировка удаления.
 */
const SPACE_DIALOG_TRANSIENT_KEYS: ReadonlySet<string> = new Set([
  'busy', 'pickSaved', 'saved', 'savedBusy', 'savedAspect', 'cellCmInput',
  'cellCmTouched', 'displayTouched', 'deleteBlockers', 'copy',
]);

/** Нормализованный отпечаток черновика: только настройки, ключи по алфавиту. */
export function spaceDialogDraftKey(d: SpaceDialogState): string {
  return stableKey(
    { ...d, planFile: d.planFile ? d.planFile.name : null },
    SPACE_DIALOG_TRANSIENT_KEYS,
  );
}

/** Запомнить состояние на момент открытия: вызывается тем, кто открыл диалог. */
export function rememberSpaceDialogBaseline(host: object, d: SpaceDialogState): void {
  rememberDialogBaseline(host, 'space', spaceDialogDraftKey(d));
}

export function forgetSpaceDialogBaseline(host: object): void {
  forgetDialogBaseline(host, 'space');
}

/** Есть ли несохранённые изменения (см. `dialog-baseline.ts` о поведении без снимка). */
export function spaceDialogDirty(host: object, d: SpaceDialogState): boolean {
  return dialogDirty(host, 'space', spaceDialogDraftKey(d));
}

export interface SpaceDialogProblem {
  /** `id` контрола, к которому ведёт «Review N fields». */
  field: string;
  /** Ключ i18n сообщения. */
  message: 'space.error_title' | 'space.error_plan' | 'space.error_temp_range' | 'space.error_north';
}

/**
 * Ошибки валидации черновика (К10, §4.3 SPEC.md). Порядок — порядок полей в
 * форме, чтобы «Review N fields» вёл к первому сверху.
 */
export function spaceDialogProblems(d: SpaceDialogState, idPrefix: string): SpaceDialogProblem[] {
  const problems: SpaceDialogProblem[] = [];
  if (!d.title.trim()) problems.push({ field: `${idPrefix}-title`, message: 'space.error_title' });
  if (d.source === 'file' && !(d.planFile || d.planUrl)) {
    problems.push({ field: `${idPrefix}-plan`, message: 'space.error_plan' });
  }
  if (d.fillMode === 'temp' && !(Number.isFinite(d.tempMin) && Number.isFinite(d.tempMax) && d.tempMin < d.tempMax)) {
    problems.push({ field: `${idPrefix}-temp-max`, message: 'space.error_temp_range' });
  }
  if (d.northDeg !== null && !(Number.isInteger(d.northDeg) && d.northDeg >= 0 && d.northDeg <= 359)) {
    problems.push({ field: `${idPrefix}-north-deg`, message: 'space.error_north' });
  }
  return problems;
}
