import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIsoOpeningBasis, isoOpeningMasonry, projectIsoOpeningStructure, projectIsoOpening } from '../test-build/iso-openings.js';
import { projectPlanPoint } from '../test-build/iso-projection.js';
import { isoMarkerBehindWall } from '../test-build/iso-marker-context.js';
import { planFaceMesh } from '../test-build/plan-3d-mesh.js';
import { plan3dCladWallSides, plan3dWallInk, plan3dWallShell, plan3dWallSideFaces } from '../test-build/plan-3d-wall-shell.js';

const opening = (patch={}) => ({id:'one',sourceIndex:0,type:'window',x:100,y:80,angle:0,length:120,
  flipH:false,flipV:false,face:{ox:0,oy:5,cm:20,side:1},...patch});
const camera = yaw => ({rotDeg:yaw,tiltDeg:50,xyScale:1,zScale:1,origin:[0,0],floorScaleY:Math.sin(40*Math.PI/180)});

test('taller section scales all opening heights while preserving plan anchors and profile thickness', () => {
  const cases = [
    {type:'door'}, {type:'window'}, {type:'gate'}, {type:'passage'},
    {type:'gate', opening_features:{version:1, mechanism:'slide', slide_direction:'end'}},
    {type:'window', opening_features:{version:1, side:'positive', leaves:[{hinge:'top'}, {hinge:'end'}]}},
  ];
  const checkHeight = (value, original) => assert.ok(Math.abs(value - original * 1.25) < 1e-10);
  for (const features of cases) {
    const input = opening(features);
    const current = buildIsoOpeningBasis(input, 84);
    const tall = buildIsoOpeningBasis(input, 105, undefined, 84);
    assert.deepEqual(tall.axis, current.axis);
    assert.equal(tall.leafThickness, current.leafThickness);
    assert.equal(tall.frameThickness, current.frameThickness);
    if (tall.windowProfile) {
      for (const field of ['frameBottom','frameTop','sashBottom','sashTop','glassBottom','glassTop'])
        checkHeight(tall.windowProfile[field], current.windowProfile[field]);
      assert.equal(tall.windowProfile.member, current.windowProfile.member);
      assert.equal(tall.windowProfile.frameTop, tall.wallHeight);
    }
    for (const [i, leaf] of tall.leaves.entries()) {
      const {top, bottom, ...rest} = leaf;
      const {top: oldTop, bottom: oldBottom, ...original} = current.leaves[i];
      assert.deepEqual(rest, original);
      checkHeight(top, oldTop);
      checkHeight(bottom, oldBottom);
    }
    const surfaces = projectIsoOpeningStructure(tall, camera(35), true);
    if (input.type === 'window' || input.type === 'gate') {
      assert.ok(!surfaces.some(surface => surface.kind.startsWith('opening-lintel')));
    }
  }
});

test('#1451 opening volumes preserve canonical inputs and all leaf poses in every quarter view',()=>{
  for(const type of ['window','door','passage','gate']) for(const angle of [0,90,27]) {
    const a=angle*Math.PI/180;
    const input=opening({type,angle,face:{ox:-Math.sin(a)*5,oy:Math.cos(a)*5,cm:20,side:1}});
    const saved=JSON.stringify(input),basis=buildIsoOpeningBasis(input,84),before=JSON.stringify(basis);
    const poses=[0,.4,1].map(amount=>projectIsoOpening(basis,amount));
    for(const yaw of [35,125,215,305]) {
      const surfaces=projectIsoOpeningStructure(basis,camera(yaw),true);
      assert.ok(surfaces.every(s=>!/(NaN|Infinity)/.test(s.d)));
      if(type==='gate') assert.ok(!surfaces.some(s=>s.kind.includes('lintel')));
      else {
        const volume=isoOpeningMasonry(basis);
        assert.deepEqual(volume.ring,[basis.face.selectedStart,basis.face.selectedEnd,basis.face.oppositeEnd,basis.face.oppositeStart]);
        assert.equal(volume.bottom,type==='window'?0:84*.92);
        assert.equal(volume.top,type==='window'?84*.38-84*.05*.4:84);
        const top=surfaces.find(s=>s.kind===(type==='window'?'window-apron-top':'opening-lintel-top'));
        for(const point of volume.ring) {
          const [x,y]=projectPlanPoint(point,volume.top,camera(yaw)).map(v=>Number(v.toFixed(4)));
          assert.ok(top.d.includes(`${x} ${y}`),'surface meets the physical jamb without a screen-space offset');
        }
      }
    }
    assert.equal(JSON.stringify(input),saved);
    assert.equal(JSON.stringify(basis),before);
    assert.deepEqual([0,.4,1].map(amount=>projectIsoOpening(basis,amount)),poses);
  }
});

test('#1451 zero-depth hosts and external gates acquire no floating masonry',()=>{
  for(const type of ['window','door','passage','gate'])
    assert.equal(isoOpeningMasonry(buildIsoOpeningBasis(opening({type,face:{ox:0,oy:0,cm:0,side:1}}))),null);
  assert.equal(isoOpeningMasonry(buildIsoOpeningBasis(opening({type:'gate'}))),null);
  assert.deepEqual(projectIsoOpeningStructure(buildIsoOpeningBasis(opening({type:'passage'}))),[]);
});

test('#1566 translucent window aprons keep outside normals and omit only the host seams', () => {
  for (const side of [-1, 1]) {
    const basis = buildIsoOpeningBasis(opening({ face: { ox: 0, oy: side * 5, cm: 20, side } }), 84);
    const ring = isoOpeningMasonry(basis).ring;
    const center = ring.reduce(([x, y], [a, b]) => [x + a / 4, y + b / 4], [0, 0]);
    for (let yaw = 0; yaw < 360; yaw += 45) {
      const sides = projectIsoOpeningStructure(basis, camera(yaw), true).filter(s => s.kind === 'window-apron-side');
      assert.equal(sides.filter(s => s.masonrySide === 'join').length, 2);
      for (const face of sides.filter(s => s.masonrySide !== 'join')) {
        const [a, b] = face.points.map(({ point }) => point);
        const points = face.points.map(({ point: [x, y], z }) => [x, y, z]);
        if (face.masonrySide === 'reverse') points.reverse();
        const mesh = planFaceMesh([[points]]);
        const normal = mesh.getAttribute('normal');
        assert.ok(normal.getX(0) * (a[0] - center[0]) + normal.getZ(0) * (a[1] - center[1]) > 0);
        mesh.dispose();
      }
      for (const reveal of projectIsoOpeningStructure(basis, camera(yaw), true).filter(s => s.kind === 'jamb-reveal')) {
        const points = reveal.points.map(({ point: [x, y], z }) => [x, y, z]);
        if (reveal.masonrySide === 'reverse') points.reverse();
        const mesh = planFaceMesh([[points]]);
        const normal = mesh.getAttribute('normal');
        assert.ok(normal.getX(0) * (reveal.jamb === 0 ? 1 : -1) > .9);
        mesh.dispose();
      }
    }
  }
});

test('#1566 wall sides and ink have no joints behind an apron or lintel', () => {
  const rect = (x0, x1) => [[[x0, 5], [x1, 5], [x1, -5], [x0, -5], [x0, 5]]];
  for (const type of ['door', 'window', 'passage']) {
    const basis = buildIsoOpeningBasis(opening({type, y: 0}), 84);
    const shell = plan3dWallShell([rect(0, 40), rect(160, 200)], [basis], 84);
    const body = isoOpeningMasonry(basis);
    const expected = type === 'window' ? [body.top, 84] : [0, body.bottom];
    assert.equal(shell.joined, true);
    const faces = plan3dWallSideFaces(shell.bands);
    for (const x of [40, 160]) {
      const joins = faces.filter(face => face.every(vertex => vertex[0] === x));
      assert.equal(joins.length, 1, type);
      assert.deepEqual([...new Set(joins[0].map(vertex => vertex[2]))], expected, type);
      const actual = planFaceMesh([[joins[0]]]);
      assert.equal(actual.getAttribute('normal').getX(0), x === 40 ? 1 : -1);
      actual.dispose();
    }
    const { vertical } = plan3dWallInk(shell.bands);
    const segments = Array.from({ length: vertical.length / 6 }, (_, i) => vertical.slice(i * 6, i * 6 + 6));
    const atJambs = segments.filter(([x]) => x === 40 || x === 160);
    assert.equal(atJambs.length, 4, type);
    for (const [, low, , , high] of atJambs) assert.deepEqual([low, high], expected, type);
    assert.ok(segments.some(([x, low, , , high]) => x === 0 && low === 0 && high === 84), 'external corner is unbroken');
    const facade = faces.find(face => face.every(vertex => vertex[1] === -5));
    const mesh = planFaceMesh([[facade]]);
    assert.equal(mesh.getAttribute('normal').getZ(0), -1, 'outer faces point out of masonry');
    mesh.dispose();
  }
});

test('#1451 a lintel occludes only its actual height interval, not the clear doorway',()=>{
  const cam=camera(0),wall=[[[[-10,20],[10,20],[10,25],[-10,25]]]];
  assert.equal(isoMarkerBehindWall([0,0],wall,84,cam),true);
  assert.equal(isoMarkerBehindWall([0,0],wall,84,cam,84*.92),false);
  assert.equal(isoMarkerBehindWall([0,-74],wall,84,cam,84*.92),true);
  assert.equal(isoMarkerBehindWall([0,0],wall,84*.36,cam),true);
});

test('#1569 opening finish owns the shared jamb region, preserving the uncoated thickness and height', () => {
  for (const angle of [0, 27, 90]) for (const type of ['window', 'door', 'passage', 'gate']) {
    const radians = angle * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
    const point = ([x, y]) => [x * cos - y * sin, x * sin + y * cos];
    const rect = (x0, x1) => [[[x0, 5], [x1, 5], [x1, -5], [x0, -5], [x0, 5]].map(point)];
    const [x, y] = point([100, 0]);
    const [ox, oy] = point([0, 5]);
    const basis = buildIsoOpeningBasis(opening({ type, x, y, angle, face: { ox, oy, cm: 20, side: 1 } }), 84);
    const surfaces = projectIsoOpeningStructure(basis, camera(35), true);
    const shell = plan3dWallShell([rect(0, 40), rect(160, 200)], [basis], 84);
    assert.equal(shell.joined, type !== 'gate');
    const boundary = plan3dWallSideFaces(shell.bands);
    const length = face => Math.hypot(face[1][0] - face[0][0], face[1][1] - face[0][1]);
    const area = face => length(face) * (face[2][2] - face[0][2]);
    const totalArea = faces => faces.reduce((total, face) => total + area(face), 0);
    const isJamb = (face, at) => face.every(([a, b]) => Math.abs(a * cos + b * sin - at) < 1e-6);
    const openings = surfaces.filter(surface => surface.kind === 'jamb-reveal');
    for (const [index, at] of [40, 160].entries()) {
      const reveal = openings[index];
      const a = reveal.points[0].point;
      const low = Math.min(...reveal.points.map(p => p.z)), high = Math.max(...reveal.points.map(p => p.z));
      const clippedReveal = { ...reveal, points: reveal.points.map(({ point: [px, py], z }) => ({
        point: [(px + a[0]) / 2, (py + a[1]) / 2], z: (z + (low + high) / 2) / 2,
      })) };
      const original = totalArea(boundary.filter(face => isJamb(face, at)));
      const remaining = totalArea(plan3dCladWallSides(shell.bands, [reveal]).filter(face => isJamb(face, at)));
      const partial = totalArea(plan3dCladWallSides(shell.bands, [clippedReveal]).filter(face => isJamb(face, at)));
      const owned = Math.max(...reveal.points.map(({ point: [px, py] }) => Math.hypot(px - a[0], py - a[1]))) * (high - low);
      assert.ok(Math.abs(original - remaining - owned) < 1e-4, `${type} ${angle} jamb ${index}: ${original}/${remaining}/${owned}`);
      assert.ok(Math.abs(original - partial - owned / 4) < 1e-4, 'partial finish removes area only at its junction');
      const detached = { ...reveal, points: reveal.points.map(({ point: [px, py], z }) => ({
        point: [px + .001 * cos, py + .001 * sin], z,
      })) };
      assert.deepEqual(plan3dCladWallSides(shell.bands, [detached]), boundary, 'a separate plane remains separate');
    }
  }
});
