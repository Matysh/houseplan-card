/** #1097: native opening input-to-settled latency, no millisecond threshold. */
import { measureOpeningDrag } from './performance/opening-drag.mjs';
const baseline = process.argv.includes('--baseline'), profiles = [];
for (const scale of [1, 2])
    profiles.push(await measureOpeningDrag(scale, 7));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const report = { issue: 1097, baseline, profile: 'large-house-opening-drag-v2-canonical', measurement: 'Node wall-clock trusted pointermove through awaited live/host settle; IPC included',
    profiles: profiles.map(p => ({ ...p, medianFrameMs: median(p.samples.map(s => median(s.frames))), medianGestureMs: median(p.samples.map(s => s.frames.reduce((a, b) => a + b, 0))) })) };
console.log(JSON.stringify(report, null, 2));
if (!baseline && profiles.some(p => p.samples.some(s => !s.checks.AC1 || !s.checks.AC3 || !s.checks.nativeDrag)))
    process.exitCode = 1;
