import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [repo, input, output = new URL('./optimize-results.json', import.meta.url)] = process.argv.slice(2);
const fromBuild = name => import(pathToFileURL(path.join(repo, 'test-build', name + '.js')));
const { optimizePlans } = await fromBuild('plan-optimizer');
const { buildWallFaceGraph, findWallFaceAtPoint } = await fromBuild('wall-face-graph');
const { checkOptimizeGeometry } = await fromBuild('plan-geometry-preflight');
const { NORM_W, GRID_PITCH, spaceModels } = await fromBuild('space-geometry');
const { buildPlanSnapGeometry } = await fromBuild('plan-snap-overlay');
const exported = JSON.parse(fs.readFileSync(input, 'utf8'));
const config = structuredClone(exported.payload.config);
// The space export carries the model version on the envelope.
config.model_version = exported.model_version;
const layout = exported.payload.layout;
const before = JSON.stringify({config, layout});
const first = optimizePlans(config, layout);
const second = optimizePlans(first.config, first.layout);
function probe(cfg) {
  const space = cfg.spaces[0];
  const epsilon = GRID_PITCH * .0002;
  const structural = buildPlanSnapGeometry({space: spaceModels(cfg)[0], epsilon});
  const sources = structural.segments.map(s => ({a:s.a, b:s.b, key:`static:${s.key}`}));
  const graph = buildWallFaceGraph(sources, epsilon);
  return { sources, faces:graph.faces.length,
    top:!!findWallFaceAtPoint(graph, [.35*NORM_W,.4*NORM_W], epsilon),
    bottom:!!findWallFaceAtPoint(graph, [-.2*NORM_W,1.24*NORM_W], epsilon),
    physicalPreflight: checkOptimizeGeometry(cfg) };
}
const result = {sourceCommit:'cb2c71ab7b5943e607b83a4f052a734eb36b22f7', NORM_W, GRID_PITCH,
  inputUnchanged:before===JSON.stringify({config,layout}), originalConfig:config,
  original:probe(config), first:{changed:first.changed,report:first.report,config:first.config,layout:first.layout,probe:probe(first.config)},
  second:{changed:second.changed,report:second.report,probe:probe(second.config)}};
fs.writeFileSync(output, JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({NORM_W,GRID_PITCH,inputUnchanged:result.inputUnchanged,
  original: {faces:result.original.faces,top:result.original.top,bottom:result.original.bottom,preflight:result.original.physicalPreflight.ok},
  first:{changed:first.changed,faces:result.first.probe.faces,top:result.first.probe.top,bottom:result.first.probe.bottom,preflight:result.first.probe.physicalPreflight.ok,report:first.report},
  second:{changed:second.changed,faces:result.second.probe.faces,top:result.second.probe.top,bottom:result.second.probe.bottom}},null,2));
