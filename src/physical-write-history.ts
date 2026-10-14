/** #891: a rejected own physical batch owns command objects, not names/floors. */
import type { NamedCommand, CommandStack } from './command-stack';
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

export class PhysicalWriteHistory {
  private readonly batches = new WeakMap<SpaceGeometryState, Set<NamedCommand<SpaceGeometryState>>>();
  public record(baseline: SpaceGeometryState, command: NamedCommand<SpaceGeometryState>): void {
    const batch = this.batches.get(baseline) || new Set();
    batch.add(command); this.batches.set(baseline, batch);
  }
  public capture(baseline: SpaceGeometryState): ReadonlySet<NamedCommand<SpaceGeometryState>> {
    return new Set(this.batches.get(baseline));
  }
  public accept(baseline: SpaceGeometryState, accepted: ReadonlySet<NamedCommand<SpaceGeometryState>>): void {
    const batch = this.batches.get(baseline);
    for (const command of accepted) batch?.delete(command);
    if (!batch?.size) this.batches.delete(baseline);
  }
  public reject(stack: CommandStack<SpaceGeometryState>, baseline: SpaceGeometryState): void {
    const batch = this.batches.get(baseline) || new Set<NamedCommand<SpaceGeometryState>>();
    const rejected = new Set([...batch].flatMap(command => [fingerprint(command.before), fingerprint(command.after)]));
    stack.removeWhere(command => batch.has(command));
    // An independent presentation command may contain the rejected walls in its
    // whole-space snapshots. Rebase that carrier, not its own before/after delta;
    // otherwise its later Undo could resurrect a refused physical write.
    for (const command of stack.commands()) {
      if (command.before.spaceId !== baseline.spaceId || physicalHistoryChanged(command.before, command.after)) continue;
      for (const direction of ['before', 'after'] as const) {
        if (rejected.has(fingerprint(command[direction])))
          command[direction] = physicalRollbackState(command[direction], baseline);
      }
    }
    this.batches.delete(baseline);
  }
}
