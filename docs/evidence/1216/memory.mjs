/** Separate precise heap series; ordinary performance.memory is quantized. */
import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
const launch=chromium.launch.bind(chromium);
chromium.launch=options=>launch({...options,args:[...(options?.args||[]),'--enable-precise-memory-info']});
await import('../../../demo/benchmark_direct_wall_geometry.mjs');
const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9);
const report=JSON.parse(readFileSync(output));
report.preciseMemoryFlag=true;
report.driver='docs/evidence/1216/memory.mjs';
report.scope='Heap only: three series, five warmups, one sampled whole journey per series, same fixtures and frame sampler. Timing evidence uses the separate 3x20 reports.';
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
