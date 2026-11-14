/** Same real editor/contract sequence as full-host, with the limited catalog. */
process.argv.push('--plan-only');
await import('./smoke_plan_host.mjs');
