// Same native consumer journey: actual quarter-turn, narrow viewport and 2x DPR.
process.argv.push('--iso');
process.argv.push('--narrow');
await import('./smoke_floor_persistent_cache.mjs');
