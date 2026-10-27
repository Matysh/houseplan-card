// #1093: mandatory task timing core; the shared gate owns browser/error cleanup.
import { runSelectiveInvalidationGate } from './benchmark_selective_invalidation.mjs';
import { reportPageErrors } from './serve.mjs';
await runSelectiveInvalidationGate({ profile: 'inactive', output: 'artifacts/browser-selected/1093/inactive.json' });
if (await reportPageErrors()) process.exit(1);
