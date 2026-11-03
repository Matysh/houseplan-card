/** Validate the authored numeric carrier before JSON cloning can turn NaN into null. */
const finiteNumeric = (value: unknown): boolean => Number.isFinite(value)
  || typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));

export function assertFiniteColumnInputs(space: { wall_columns?: unknown }): void {
  if (space.wall_columns === undefined) return;
  if (!Array.isArray(space.wall_columns)) throw new TypeError('invalid-column-geometry');
  for (const column of space.wall_columns) {
    if (!column || !Array.isArray(column.center) || column.center.length !== 2
        || !finiteNumeric(column.center[0]) || !finiteNumeric(column.center[1])
        // #842 permits old numeric strings and absent/null defaults. Their
        // existing write normalization still owns the conversion; coordinates
        // never get the Number(null) / Number('') shortcut to zero.
        || (column.cm != null && !finiteNumeric(column.cm))
        || (column.angle != null && !finiteNumeric(column.angle))) {
      throw new TypeError('invalid-column-geometry');
    }
  }
}
