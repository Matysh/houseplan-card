/** Compatibility projection for a session token written by the old toolbar. */
export function normalizeUnifiedWallTool(value: unknown): unknown {
  return value === 'partition' ? 'draw' : value;
}
