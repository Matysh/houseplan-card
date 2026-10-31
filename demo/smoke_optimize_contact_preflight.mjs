// #1166: selected CI executes the original absolute/relative preflight budget.
// This is a pure performance witness, without browser or GPU acceptance claims.
import {spawnSync} from 'node:child_process';
import {check,finish} from './serve.mjs';

const commands=[['node_modules/typescript/bin/tsc','-p','tsconfig.test.json'],
  ['scripts/fix-test-build.mjs'],['demo/benchmark_optimize_geometry_preflight.mjs']];
let ok=true;
for(const args of commands){
  const run=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:4*1024*1024});
  process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');
  if(run.error)console.error(run.error);
  if(run.status!==0||run.error){ok=false;break;}
}
check('Optimize preflight retains250ms and original relative budget',ok);
await finish(undefined,{preflight:ok});
