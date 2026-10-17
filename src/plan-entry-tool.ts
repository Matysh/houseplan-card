import type { SpaceModel } from './types';

type PlanGeometry = Partial<Pick<SpaceModel,
  'rooms' | 'wall_segments' | 'partitions' | 'wall_columns' | 'stairs'>>;

/** Ordinary Plan entry only. Explicit onboarding/copy and warm sessions own their tools. */
export function planEntryTool(
  space: PlanGeometry, openings?: readonly unknown[] | null,
): 'select' | 'draw' {
  return space.rooms?.length || space.wall_segments?.length || space.partitions?.length
    || space.wall_columns?.length || space.stairs?.length || openings?.length
    ? 'select' : 'draw';
}
