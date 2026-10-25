/** Decor is annotation, never an input to physical walls or light barriers.
 * Retain every other field, including unknown compatible structural inputs. */
export function structuralSpaceRecord(record: unknown, ...nonStructural: readonly string[]): unknown {
  return record && typeof record === 'object' && !Array.isArray(record)
    ? Object.fromEntries(Object.keys(record).filter(key => key !== 'decor' && !nonStructural.includes(key))
      .map(key => [key, (record as Record<string, unknown>)[key]])) : record;
}
