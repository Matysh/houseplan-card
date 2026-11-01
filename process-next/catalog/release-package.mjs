import { packageCandidate } from '../lib/package.mjs';
console.log(JSON.stringify(packageCandidate({ root: process.cwd() }), null, 2));
