/** HA data that can change the painted House Plan frame. */
export interface HassRenderDependencies {
  readonly entityIds: Iterable<string>;
}

export type HassRenderChange = 'none' | 'state' | 'structural';

const scalarChanged = (before: any, after: any, path: readonly string[]): boolean => {
  let a = before, b = after;
  for (const part of path) {
    a = a?.[part];
    b = b?.[part];
  }
  return a !== b;
};

/**
 * Classify one HA assignment without walking the complete `hass.states` map.
 *
 * Home Assistant keeps unchanged state rows by identity. Comparing only the
 * dependency rows therefore catches state, attribute and availability changes
 * while making an unrelated tick O(number of plan dependencies), not
 * O(number of HA entities). Structural values deliberately fail open: they are
 * rare and can alter formatting, registry resolution, permissions or actions.
 */
export function classifyHassRenderChange(
  before: any,
  after: any,
  dependencies: HassRenderDependencies | null,
): HassRenderChange {
  if (before === after) return 'none';
  if (!before || !after || !dependencies) return 'structural';

  if (before.connection !== after.connection
      || before.entities !== after.entities
      || before.devices !== after.devices
      || before.areas !== after.areas
      || before.themes !== after.themes
      || before.user !== after.user
      || before.config !== after.config
      || before.floors !== after.floors
      || before.services !== after.services
      || before.panels !== after.panels
      || before.language !== after.language
      || scalarChanged(before, after, ['locale', 'language'])
      || scalarChanged(before, after, ['locale', 'number_format'])
      || scalarChanged(before, after, ['locale', 'time_format'])
      || scalarChanged(before, after, ['locale', 'date_format'])) {
    return 'structural';
  }

  // `states` is the only top-level collection for which this classifier can
  // prove irrelevance from the dependency projection. A newly introduced HA
  // capability must therefore fail open until it receives an explicit rule;
  // otherwise a frontend release could silently leave that UI stale.
  const compared = new Set([
    'states', 'connection', 'entities', 'devices', 'areas', 'themes', 'user',
    'config', 'floors', 'services', 'panels', 'language', 'locale',
  ]);
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!compared.has(key) && before[key] !== after[key]) return 'structural';
  }

  for (const entityId of dependencies.entityIds) {
    if (before.states?.[entityId] !== after.states?.[entityId]) return 'state';
  }
  return 'none';
}
