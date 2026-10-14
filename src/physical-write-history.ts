/** #891: a rejected own physical batch owns command objects, not names/floors. */
import type { NamedCommand, CommandStack, CommandPosition } from './command-stack';
import type { SpaceGeometryState } from './geometry-history-state';
import { contentFingerprint } from './visual-continuity';

const PHYSICAL = ['rooms', 'openings', 'walls', 'wall_segments', 'open_spans',
  'partitions', 'wall_columns'] as const;
const fingerprint = (state: SpaceGeometryState): string =>
  contentFingerprint(PHYSICAL.map(key => state[key] ?? []));
export const physicalHistoryChanged = (before: SpaceGeometryState, after: SpaceGeometryState): boolean =>
  fingerprint(before) !== fingerprint(after);

/** Keep independent Background/decor/stair fields while restoring the rejected physical carrier. */
export function physicalRollbackState(live: SpaceGeometryState, baseline: SpaceGeometryState): SpaceGeometryState {
  const restored = { ...live };
  for (const key of PHYSICAL) {
    delete restored[key];
    if (baseline[key] !== undefined) Object.assign(restored, { [key]: JSON.parse(JSON.stringify(baseline[key])) });
  }
  if (baseline.roomReferences) restored.roomReferences = baseline.roomReferences;
  return restored;
}

type Entry = { command: NamedCommand<SpaceGeometryState>; position?: CommandPosition<SpaceGeometryState>; presentation?: true };

export class PhysicalWriteHistory {
  private readonly batches = new WeakMap<SpaceGeometryState, Set<Entry>>();
  public record(baseline: SpaceGeometryState, command: NamedCommand<SpaceGeometryState>,
    position?: CommandPosition<SpaceGeometryState>): void {
    const batch = this.batches.get(baseline) || new Set<Entry>();
    // New provisional commands are disposable; previously accepted cursor steps
    // are not. Keep each step token so accepting an older send cannot retire a
    // later Undo/Redo of the same command while that send was in flight.
    batch.add({ command, position }); this.batches.set(baseline, batch);
  }
  public recordPresentation(baseline: SpaceGeometryState, command: NamedCommand<SpaceGeometryState>): void {
    const batch = this.batches.get(baseline) || new Set<Entry>();
    batch.add({ command, presentation: true }); this.batches.set(baseline, batch);
  }
  public capture(baseline: SpaceGeometryState): ReadonlySet<Entry> {
    return new Set(this.batches.get(baseline));
  }
  public accept(baseline: SpaceGeometryState, accepted: ReadonlySet<Entry>): void {
    const batch = this.batches.get(baseline);
    for (const command of accepted) batch?.delete(command);
    if (!batch?.size) this.batches.delete(baseline);
  }
  public reject(stack: CommandStack<SpaceGeometryState>, baseline: SpaceGeometryState, proof = false): void {
    const batch = [...(this.batches.get(baseline) || [])];
    const rejected = new Set(batch.flatMap(({ command }) => [fingerprint(command.before), fingerprint(command.after)]));
    const disposable = new Set(batch.filter(entry => !entry.presentation && (!entry.position || proof)).map(entry => entry.command));
    stack.removeWhere(command => disposable.has(command));
    for (const entry of batch.reverse()) {
      if (entry.position && !disposable.has(entry.command)) stack.restorePosition(entry.command, entry.position);
    }
    // An independent presentation command may contain the rejected walls in its
    // whole-space snapshots. Rebase that carrier, not its own before/after delta;
    // otherwise its later Undo could resurrect a refused physical write.
    const surviving = new Set(stack.commands());
    for (const { command, presentation } of batch) {
      if (!presentation || !surviving.has(command)) continue;
      for (const direction of ['before', 'after'] as const) {
        if (rejected.has(fingerprint(command[direction])))
          command[direction] = physicalRollbackState(command[direction], baseline);
      }
    }
    this.batches.delete(baseline);
  }
}
