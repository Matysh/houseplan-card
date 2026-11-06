/** Saved content, independent of camera bounds and presentation visibility. */
export function spaceHasContent(
  space: Record<string, unknown>,
  devices: readonly { space: string }[],
  markers: readonly { space?: string | null; removed?: boolean }[],
): boolean {
  if (space.plan_url) return true;
  const collections = ['rooms', 'wall_segments', 'partitions', 'wall_columns',
    'openings', 'open_spans', 'decor', 'stairs', 'led_strips'];
  if (collections.some((key) => Array.isArray(space[key]) && space[key].length > 0)) return true;
  const graph = space.plan_graph as { edges?: unknown[]; rooms?: unknown[] } | undefined;
  if (graph?.edges?.length || graph?.rooms?.length) return true;
  return devices.some((device) => device.space === space.id)
    || markers.some((marker) => !marker.removed && marker.space === space.id);
}
