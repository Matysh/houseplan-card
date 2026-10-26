/** Decor is annotation, never an input to physical walls or light barriers.
 * Retain every other field, including unknown compatible structural inputs. */
export function structuralSpaceRecord(record: unknown, ...nonStructural: readonly string[]): unknown {
  return record && typeof record === 'object' && !Array.isArray(record)
    ? Object.fromEntries(Object.keys(record).filter(key => key !== 'decor' && !nonStructural.includes(key))
      .map(key => [key, (record as Record<string, unknown>)[key]])) : record;
}

/** Solar-only room settings cannot invalidate walls or artificial-light bodies.
 * History still uses structuralSpaceRecord: the saved flag remains significant. */
export function physicalSpaceRecord(record: unknown, ...nonStructural: readonly string[]): unknown {
  const structural = structuralSpaceRecord(record, ...nonStructural) as Record<string, unknown> | null;
  if (!structural || !Array.isArray(structural.rooms)) return structural;
  return { ...structural, rooms: structural.rooms.map(room => {
    const settings = room?.settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return room;
    const keys = Object.keys(settings);
    if (keys.length && !Object.prototype.hasOwnProperty.call(settings, 'sun_transparent')) return room;
    const retained = Object.fromEntries(keys.filter(key => key !== 'sun_transparent').map(key => [key, settings[key]]));
    const projected = { ...room };
    if (Object.keys(retained).length) projected.settings = retained; else delete projected.settings;
    return projected;
  }) };
}
