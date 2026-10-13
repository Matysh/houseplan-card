/**
 * #883: one press of ordinary geometry Undo/Redo is one attempt on the exact
 * command the toolbar names. The cursor moves only after its snapshot was
 * applied, and a refusal never clears the history: a temporary one (`retry`,
 * a `floor` pinned elsewhere — owner decision Q1) keeps the command where it
 * is; an unfit one (its space is gone, its snapshot cannot be restored, the
 * geometry/wall model explicitly refuses it) removes exactly that command
 * object — never a neighbour with the same name or floor, never a newer top.
 * Node commands (#843) are not ordinary: `wall-node-history.ts` owns them.
 */
import type { NamedCommand } from './command-stack';

/** `true`, or why the snapshot was not applied; geometry, effects and floor stay as before. */
export type HistoryApply = true | 'retry' | 'pinned' | HistoryUnfit;
/** The command can never apply again; the reason is named to the person. */
export type HistoryUnfit = 'space' | 'state' | 'geometry';

const REASON: Record<HistoryUnfit, string> = {
  space: 'history.reason_space', state: 'history.reason_state', geometry: 'history.reason_geometry',
};

export const historyUnfit = (outcome: HistoryApply | null): outcome is HistoryUnfit =>
  outcome === 'space' || outcome === 'state' || outcome === 'geometry';

export interface OrdinaryHistoryStack<T> {
  peekUndo(): NamedCommand<T> | null;
  peekRedo(): NamedCommand<T> | null;
  confirmUndo(command: NamedCommand<T>): boolean;
  confirmRedo(command: NamedCommand<T>): boolean;
  removeWhere(predicate: (command: NamedCommand<T>) => boolean): number;
}

export interface OrdinaryHistoryPort<T> {
  stack: OrdinaryHistoryStack<T>;
  apply(state: T): HistoryApply;
  text(key: string, params?: Record<string, string>): string;
  toast(text: string): void;
}

/** One attempt and one toast; `null` when there is nothing to undo/redo. */
export function runOrdinaryHistory<T>(port: OrdinaryHistoryPort<T>, direction: 'undo' | 'redo'): HistoryApply | null {
  const undo = direction === 'undo', { stack } = port;
  const command = undo ? stack.peekUndo() : stack.peekRedo();
  if (!command) return null;
  let outcome: HistoryApply;
  // An unexpected exception is no proof of unfitness: the command stays.
  try { outcome = port.apply(undo ? command.before : command.after); } catch { outcome = 'retry'; }
  const name = command.name, mine = (item: NamedCommand<T>): boolean => item === command;
  if (outcome === true) {
    // Identity, not position: a command that is no longer next leaves; a newer top stays.
    if (!(undo ? stack.confirmUndo(command) : stack.confirmRedo(command))) stack.removeWhere(mine);
    port.toast(port.text(undo ? 'history.undone' : 'history.redone', { name }));
  } else if (historyUnfit(outcome)) {
    // Out of the direction it is in, never into the opposite one; the order of the rest is kept.
    stack.removeWhere(mine);
    port.toast(port.text(undo ? 'history.removed_undo' : 'history.removed_redo',
      { name, reason: port.text(REASON[outcome]) }));
  } else port.toast(port.text(outcome === 'pinned' ? 'history.space_pinned' : 'history.unavailable'));
  return outcome;
}
