import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStaticWallOpeningsFixture } from '../demo/fixtures/static-wall-openings.mjs';
import { spaceModels,GRID_STEP_N,GRID_PITCH,NORM_W } from '../test-build/space-geometry.js';
import { geometryOpenings,geometryRoomOpeningInputs,geometryPartitionOpeningCuts } from '../test-build/plan-geometry-preflight.js';
import { renderSpaceStatic } from '../test-build/space-render.js';

function templates(value,found=[]) {
  if(Array.isArray(value))for(const item of value)templates(item,found);
  else if(value&&Array.isArray(value.values)) {
    if(value.strings)found.push(value);
    for(const item of value.values)templates(item,found);
  }
  return found;
}
function render(cfg,{fit='house',states={}}={}) {
  const value=renderSpaceStatic({cfg,hass:{states,entities:{},devices:{},areas:{}},
    layout:{},spaceId:'f1',lang:'en',fit,devices:[],stageWidth:360});
  const all=templates(value);
  const stage=all.find(t=>t.strings.some(s=>s.includes('viewBox="')));
  const at=stage.strings.findIndex(s=>s.endsWith('viewBox="'));
  const wallPaths=all.filter(t=>t.strings.some(s=>s.includes('data-hp="wall"')))
    .flatMap(t=>t.values.filter(v=>typeof v==='string'&&/^M/.test(v)));
  return {frame:stage.values.slice(at,at+4),wallPaths};
}

test('#1171 shared projection includes all supported hosts and refuses an unresolved partition',()=>{
  const cfg=makeStaticWallOpeningsFixture(),s=cfg.spaces[0];
  s.openings.push({id:'orphan',type:'door',length:.08,host:{kind:'partition',id:'absent',t:.5}});
  const before=JSON.stringify(cfg),model=spaceModels(cfg)[0];
  const openings=geometryOpenings(s,model,5,GRID_PITCH,NORM_W);
  assert.deepEqual(openings.map(o=>o.id),s.openings.slice(0,-1).map(o=>o.id));
  assert.deepEqual(openings.find(o=>o.id==='wall-door'),{...s.openings[0],rx:375,ry:187.5,rlen:125});
  const partition=openings.find(o=>o.id==='partition-door');
  assert.equal(partition.rx,375);assert.equal(partition.ry,562.5);assert.equal(partition.rlen,75);
  assert.equal(geometryPartitionOpeningCuts(openings).length,1);
  const roomInputs=geometryRoomOpeningInputs(openings,model,s.walls,[],GRID_STEP_N,5,GRID_PITCH,NORM_W);
  assert.equal(roomInputs.length,5,'ordinary partition must not punch a nearby room wall');
  assert.equal(JSON.stringify(cfg),before,'projection never repairs/rewrites saved hosts or coordinates');
});

test('#1171 actual Static renderer invalidates in-place cuts, retains contact geometry and reads without writes',()=>{
  const cfg=makeStaticWallOpeningsFixture(),s=cfg.spaces[0],door=s.openings[0];
  door.contact='cover.synthetic';
  const before=JSON.stringify(cfg),initial=render(cfg);
  assert.ok(initial.wallPaths.length,'native masonry templates must be exercised');
  assert.equal(JSON.stringify(cfg),before);
  const live=render(cfg,{states:{'cover.synthetic':{state:'open',attributes:{current_position:50}}}});
  assert.deepEqual(live,initial,'contact ticks preserve frame and actual cut paths');
  door.x=.45;door.length=.08;door.host.t=.65;
  const moved=render(cfg);
  assert.notDeepEqual(moved.wallPaths,initial.wallPaths,'same cfg identity must not return old cuts');
  s.openings.shift();
  assert.notDeepEqual(render(cfg).wallPaths,moved.wallPaths,'delete restores the former opening span');
});

test('#1171 content and house frame include an exterior leaf maximum, independent of state and hidden with borders',()=>{
  for(const fit of ['content','house']) {
    const cfg=makeStaticWallOpeningsFixture();
    const [x,y,w,h]=render(cfg,{fit}).frame;
    assert.ok([x,y,w,h].every(Number.isFinite));
    assert.ok(y<65,'north opening sweep extends well beyond the room contour at187.5');
    assert.ok(x+w>=975&&y+h>=812.5);
    cfg.spaces[0].settings.show_borders=false;
    const hidden=render(cfg,{fit}).frame;
    assert.ok(hidden[1]>y,'hidden symbols and masonry cannot keep expanding the frame');
  }
});
