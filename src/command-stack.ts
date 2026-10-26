/**
 * Session-local, named undo/redo history.
 *
 * The stack deliberately knows nothing about Houseplan geometry. Callers own
 * immutable before/after values and decide how to apply them. Keeping the
 * history generic gives every geometry tool one transaction model instead of
 * another private undo implementation.
 */
export interface NamedCommand<T> {
  name: string;
  before: T;
  after: T;
}

/** Identity anchors captured before an optimistic cursor step, never a stack replacement. */
export interface CommandPosition<T> {
  lane: 'undo' | 'redo';
  index: number;
  anchors: readonly NamedCommand<T>[];
  epoch: number;
}

export class CommandStack<T> {
  private readonly _limit: number;
  private _undo: NamedCommand<T>[] = [];
  private _redo: NamedCommand<T>[] = [];
  private _epoch = 0;
  private _baselinePins = 0;

  public constructor(limit = 50, private readonly changed?: () => void, public readonly revalidateOnBaseline = false) {
    // UX-04 promises a useful 30–50-step history. Fifty is the product
    // default; the floor prevents a future caller from silently weakening it.
    this._limit = Math.max(30, Math.floor(limit));
  }

  public get canUndo(): boolean { return this._undo.length > 0; }
  public get canRedo(): boolean { return this._redo.length > 0; }
  public get undoName(): string | null { return this._undo[this._undo.length - 1]?.name ?? null; }
  public get redoName(): string | null { return this._redo[this._redo.length - 1]?.name ?? null; }
  public get size(): number { return this._undo.length; }
  public get baselinePinned(): boolean { return this._baselinePins > 0; }
  public pinBaseline(): () => void {
    this._baselinePins++;
    let active = true;
    return () => { if (active) { active = false; this._baselinePins--; } };
  }


  /** Bounded identity snapshot; inspecting it never moves either cursor. */
  public commands(): readonly NamedCommand<T>[] { return [...this._undo, ...this._redo]; }

  public positionOf(command: NamedCommand<T>): CommandPosition<T> | null {
    for (const lane of ['undo', 'redo'] as const) {
      const anchors = lane === 'undo' ? this._undo : this._redo;
      const index = anchors.indexOf(command);
      if (index >= 0) return { lane, index, anchors: [...anchors], epoch: this._epoch };
    }
    return null;
  }

  /** Roll back only this cursor identity; newer commands and the opposite lane stay. */
  public restorePosition(command: NamedCommand<T>, position: CommandPosition<T>): void {
    if (position.epoch !== this._epoch) return; // an authoritative clear is irreversible here
    // A full newer branch already displaced this absent old identity. Restoring
    // it must neither exceed capacity nor evict one of those newer commands.
    if (!this._undo.includes(command) && !this._redo.includes(command)
        && this._undo.length + this._redo.length >= this._limit) return;
    this._undo = this._undo.filter(item => item !== command);
    this._redo = this._redo.filter(item => item !== command);
    const lane = position.lane === 'undo' ? this._undo : this._redo;
    let index = -1;
    for (const anchor of position.anchors.slice(position.index + 1)) {
      index = lane.indexOf(anchor);
      if (index >= 0) break;
    }
    if (index < 0) {
      for (const anchor of position.anchors.slice(0, position.index).reverse()) {
        const found = lane.indexOf(anchor);
        if (found >= 0) { index = found + 1; break; }
      }
    }
    lane.splice(index < 0 ? Math.min(position.index, lane.length) : index, 0, command);
    if (lane.length > this._limit) lane.splice(0, lane.length - this._limit);
  }

  public push(command: NamedCommand<T>): void {
    this._undo.push(command);
    if (this._undo.length > this._limit) this._undo.splice(0, this._undo.length - this._limit);
    // A new branch makes every previously redoable command stale.
    this._redo = [];
    this.changed?.();
  }

  public undo(): NamedCommand<T> | null {
    const command = this._undo.pop() ?? null;
    if (command) this._redo.push(command);
    return command;
  }

  public redo(): NamedCommand<T> | null {
    const command = this._redo.pop() ?? null;
    if (command) this._undo.push(command);
    return command;
  }

  /** The command `undo()`/`redo()` would return, without moving the cursor. */
  public peekUndo(): NamedCommand<T> | null { return this._undo[this._undo.length - 1] ?? null; }
  public peekRedo(): NamedCommand<T> | null { return this._redo[this._redo.length - 1] ?? null; }

  /**
   * #843: a server-applied command moves the cursor only after acceptance, and
   * only while it is still the next one. A newer command is never displaced.
   */
  public confirmUndo(command: NamedCommand<T>): boolean {
    return this.peekUndo() === command && this.undo() === command;
  }
  public confirmRedo(command: NamedCommand<T>): boolean {
    return this.peekRedo() === command && this.redo() === command;
  }

  /** Remove commands invalidated by an external change while preserving unrelated history. */
  public removeWhere(predicate: (command: NamedCommand<T>) => boolean): number {
    const undoSize = this._undo.length;
    const redoSize = this._redo.length;
    this._undo = this._undo.filter((command) => !predicate(command));
    this._redo = this._redo.filter((command) => !predicate(command));
    this.changed?.();
    return undoSize + redoSize - this._undo.length - this._redo.length;
  }

  public clear(): void {
    this._epoch++;
    this._undo = [];
    this._redo = [];
    this.changed?.();
  }
}
