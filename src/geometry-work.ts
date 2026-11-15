/** Redacted producer witnesses, per JS realm. No geometry/content is exposed.
 * Unlike cache-hit counters these count actual algorithm entry, including
 * hidden downstream fallbacks after a supposedly successful hydration. */
const counts = { wallBodiesGeometry: 0, floorFootprintGeometry: 0, directStructure: 0, recut: 0, directRecut: 0 };
export function geometryWork(name: keyof typeof counts): void { counts[name]++; }
export function geometryWorkSnapshot() { return { ...counts }; }
