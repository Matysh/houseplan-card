/** The same native consumer journey with an actually rotated isometric floor,
 * narrow viewport and 2x pixel profile. No second cache/test implementation. */
process.argv.push('--iso', '--narrow');
await import('./smoke_floor_persistent_cache.mjs');
