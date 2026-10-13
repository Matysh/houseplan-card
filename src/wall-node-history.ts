/**
 * #843: Undo/Redo of a node move is one atomic server operation inside the
 * shared geometry history. It is applied from any Plan/Background tool, after
 * this tab's own write queue, and the cursor moves only after acceptance.
 */
import type { NamedCommand } from './command-stack';
import type { ServerConfig } from './types';
import type { NodeMoveHistory } from './wall-node-editor';
import { nodeFloorFingerprint, type NodeWriteBasis } from './wall-node-write';

export interface NodeHistoryStack<T> {
  peekUndo(): NamedCommand<T> | null;
  peekRedo(): NamedCommand<T> | null;
  confirmUndo(command: NamedCommand<T>): boolean;
  confirmRedo(command: NamedCommand<T>): boolean;
  removeWhere(predicate: (command: NamedCommand<T>) => boolean): number;
}
export interface NodeHistoryPort<T extends { nodeMove?: NodeMoveHistory }> {
  /** A Plan/Background writer; neither a tool nor a loaded Select is required. */
  enabled(): boolean;
  api(): boolean;
  epoch(): number;
  stack(): NodeHistoryStack<T>;
  /** The result floor can be shown (not another fixed `floor`). */
  canShow(space: string): boolean;
  /** Show it the way ordinary history does, keeping the editor and its tool. */
  show(space: string): void;
  write(history: NodeMoveHistory, basis: NodeWriteBasis): Promise<ServerConfig>;
  text(key: string, params?: Record<string, string>): string;
  toast(text: string): void;
}

export type NodeHistoryRefusal = 'conflict' | 'outdated' | 'unavailable';
/** Refusals the person can tell apart. Only `outdated` makes the command unfit. */
export function nodeHistoryRefusal(error: unknown, foreign: boolean): NodeHistoryRefusal {
  const code = String((error as { code?: unknown } | null)?.code ?? (error as Error | null)?.message ?? '');
  if (foreign || code === 'conflict') return 'conflict';
  return code === 'stale-node-snapshot'
    || /^(?:node_move_|junction_limit_|invalid_passage_|invalid_partition_opening_)/.test(code)
    ? 'outdated' : 'unavailable';
}

export async function runNodeHistory<T extends { nodeMove?: NodeMoveHistory }>(
  port: NodeHistoryPort<T>, direction: 'undo' | 'redo',
): Promise<void> {
  if (!port.enabled()) return;
  const undo = direction === 'undo', stack = port.stack();
  const command = undo ? stack.peekUndo() : stack.peekRedo();
  const history = command && (undo ? command.before : command.after).nodeMove;
  if (!command || !history) return;
  if (!port.api()) { port.toast(port.text('node_move_update_required')); return; }
  const space = history.beforeSpace.id, epoch = port.epoch();
  // Refused before anything is sent; the active floor and the history stay.
  if (!port.canShow(space)) { port.toast(port.text('history.space_unavailable')); return; }
  let config: ServerConfig;
  try {
    // Undo expects the accepted move's floor, Redo the accepted Undo's floor.
    config = await port.write(history, { epoch, space, floor: history.floor || '' });
  } catch (error) {
    const refusal = nodeHistoryRefusal(error, port.epoch() !== epoch);
    // Only the unfit command leaves; its neighbours and the cursor stay.
    if (refusal === 'outdated') stack.removeWhere(item => item === command);
    port.toast(port.text(refusal === 'outdated'
      ? undo ? 'history.node_outdated_undo' : 'history.node_outdated_redo'
      : refusal === 'conflict' ? 'history.conflict' : 'history.unavailable'));
    return;
  }
  if (!(undo ? stack.confirmUndo(command) : stack.confirmRedo(command))) stack.removeWhere(item => item === command);
  // The opposite direction now expects exactly the floor the server accepted.
  const opposite = (undo ? command.after : command.before).nodeMove;
  if (opposite) opposite.floor = nodeFloorFingerprint(config.spaces.find(item => item.id === space));
  port.show(space);
  port.toast(port.text(undo ? 'history.undone' : 'history.redone', { name: command.name }));
}
