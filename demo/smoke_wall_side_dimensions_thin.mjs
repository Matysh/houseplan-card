// #1381: the same real four-consumer/lifecycle proof at 1cm wall thickness.
// In particular, a 12px first row must not cover the visible Resize arrows.
process.argv.push('--thin-walls');
await import('./smoke_wall_side_dimensions.mjs');
