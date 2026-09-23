/**
 * #600 К10: снимок состояния диалога на момент открытия.
 *
 * «Сохранить» активен только при изменениях, и изменение считается сравнением
 * нормализованного черновика с этим снимком. Ничего не персистится: снимки
 * живут в памяти рантайма, привязаны к хосту и различаются по виду диалога, а
 * состояния самих диалогов не получают новых ключей (ТЗ: не в скоупе).
 *
 * Без снимка (диалог открыт путём, который его не сделал) ответ `true`:
 * прежнее поведение — Save доступен — безопаснее заблокированной кнопки.
 */
export type DialogKind = 'space' | 'settings' | 'room' | 'marker';

const baselines = new WeakMap<object, Map<DialogKind, string>>();

export function rememberDialogBaseline(host: object, kind: DialogKind, key: string): void {
  const map = baselines.get(host) ?? new Map<DialogKind, string>();
  map.set(kind, key);
  baselines.set(host, map);
}

export function forgetDialogBaseline(host: object, kind: DialogKind): void {
  baselines.get(host)?.delete(kind);
}

/** Read-only transfer hook for a warm remount. The key is still page-memory only. */
export function dialogBaseline(host: object, kind: DialogKind): string | undefined {
  return baselines.get(host)?.get(kind);
}

/** Install a baseline carried by a warm snapshot onto its replacement host. */
export function restoreDialogBaseline(host: object, kind: DialogKind, key: string | undefined): void {
  if (key === undefined) {
    forgetDialogBaseline(host, kind);
    return;
  }
  rememberDialogBaseline(host, kind, key);
}

const warmBaselineKind = (kind: string): DialogKind | null =>
  kind === 'space' || kind === 'marker' || kind === 'settings' || kind === 'room' ? kind : null;

export function warmDialogBaseline(host: object, kind: string): string | undefined {
  const baselineKind = warmBaselineKind(kind);
  return baselineKind ? dialogBaseline(host, baselineKind) : undefined;
}

export function restoreWarmDialogBaseline(host: object, kind: string, key: string | undefined): void {
  const baselineKind = warmBaselineKind(kind);
  if (baselineKind) restoreDialogBaseline(host, baselineKind, key);
}

export function dialogDirty(host: object, kind: DialogKind, key: string): boolean {
  const baseline = baselines.get(host)?.get(kind);
  if (baseline === undefined) return true;
  return baseline !== key;
}

/** Устойчивый отпечаток объекта: ключи по алфавиту, без транзиентных. */
export function stableKey(value: Record<string, unknown>, transient: ReadonlySet<string> = new Set()): string {
  const entries = Object.entries(value)
    .filter(([k]) => !transient.has(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(entries);
}
