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

export class CommandStack<T> {
  private readonly _limit: number;
  private _undo: NamedCommand<T>[] = [];
  private _redo: NamedCommand<T>[] = [];

  public constructor(limit = 50) {
    // UX-04 promises a useful 30–50-step history. Fifty is the product
    // default; the floor prevents a future caller from silently weakening it.
    this._limit = Math.max(30, Math.floor(limit));
  }

  public get canUndo(): boolean { return this._undo.length > 0; }
  public get canRedo(): boolean { return this._redo.length > 0; }
  public get undoName(): string | null { return this._undo[this._undo.length - 1]?.name ?? null; }
  public get redoName(): string | null { return this._redo[this._redo.length - 1]?.name ?? null; }
  public get size(): number { return this._undo.length; }

  public push(command: NamedCommand<T>): void {
    this._undo.push(command);
    if (this._undo.length > this._limit) this._undo.splice(0, this._undo.length - this._limit);
    // A new branch makes every previously redoable command stale.
    this._redo = [];
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

  public clear(): void {
    this._undo = [];
    this._redo = [];
  }
}
