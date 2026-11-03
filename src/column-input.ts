/** Validate the authored numeric carrier before JSON cloning can turn NaN into null. */
export function assertFiniteColumnInputs(space: { wall_columns?: unknown }): void {
  if (space.wall_columns === undefined) return;
  if (!Array.isArray(space.wall_columns)) throw new TypeError('invalid-column-geometry');
  for (const column of space.wall_columns) {
    if (!column || !Array.isArray(column.center) || column.center.length !== 2
        || !column.center.every(Number.isFinite) || !Number.isFinite(column.cm)
        || (column.angle !== undefined && !Number.isFinite(column.angle))) {
      throw new TypeError('invalid-column-geometry');
    }
  }
}
