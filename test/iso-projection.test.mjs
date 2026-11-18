import test from 'node:test';
import assert from 'node:assert/strict';
import { isoLabYaw, isoLabCamera, isoLabOpeningAmount, isoLabOpeningPreview } from '../test-build/iso-lab-camera.js';
import {
  ISO_CAMERA, ISO_OVERLAY_VISUAL_OFFSET, ISO_RAISED_OVERLAY_HEIGHT,
  ISO_WALL_HEIGHT, applyIsoMatrix, clientToScenePoint, isoFloorMatrix,
  isoOverlayVisualHeight, isoPlaneMatrix, isoPlaneMatrixCss, projectPlanPoint,
  projectedFrame, unprojectFloorPoint, isoFloorLinearCss, isoTileDepthStyles,
} from '../test-build/iso-projection.js';

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('#1451 opening preview overrides all leaves without mutating saved state and is opt-in',()=>{
  const visual={mechanism:'swing',direction:'end',side:'negative',unsupported:false,
    leaves:[{id:'a',hinge:'start',amount:.3,unknown:false,sensorDriven:true},
      {id:'b',hinge:'end',amount:0,unknown:true,sensorDriven:false}]};
  const before=structuredClone(visual);
  for(const [mode,amount] of [['closed',0],['half',.5],['open',1]]) {
    assert.equal(isoLabOpeningAmount(false,'?sashes1451='+mode),null);
    const forced=isoLabOpeningAmount(true,'?sashes1451='+mode);
    assert.equal(forced,amount);
    assert.deepEqual(isoLabOpeningPreview(visual,forced).leaves.map(l=>l.amount),[amount,amount]);
    assert.deepEqual(visual,before);
  }
  for(const mode of ['', 'saved','junk'])assert.equal(isoLabOpeningAmount(true,'?sashes1451='+mode),null);
  assert.equal(isoLabOpeningPreview(visual,null),visual);
});

test('#1451 solid tile edge remains vertically down through camera turns', () => {
  for (const turn of [0,90,180,270]) {
    const camera={...ISO_CAMERA,rotDeg:35+turn,tiltDeg:55,floorScaleY:Math.sin(35*Math.PI/180)};
    const [a,b,c,d]=isoFloorMatrix(camera),styles=isoTileDepthStyles(camera);
    const dx=Number(styles['--hp-iso-edge-unit-x']),dy=Number(styles['--hp-iso-edge-unit-y']);
    close(a*dx+c*dy,0); close(b*dx+d*dy,.22);
  }
});

test('#1451 marker-local corners follow the floor and inverse preserves the screen hit target', () => {
  for (const turn of [0,90,180,270]) {
    const camera = {...ISO_CAMERA,rotDeg:35+turn,tiltDeg:55,floorScaleY:Math.sin(35*Math.PI/180)};
    const parse = css => css.slice(7,-1).split(',').map(Number);
    const linear = parse(isoFloorLinearCss(camera));
    const inverse = parse(isoFloorLinearCss(camera,true));
    const anchor = [180,720], projected = projectPlanPoint(anchor,0,camera);
    for(const offset of [[-22,-22],[22,-22],[22,22],[-22,22]]) {
      const relative = applyIsoMatrix(offset,linear);
      const floorCorner = projectPlanPoint([anchor[0]+offset[0],anchor[1]+offset[1]],0,camera);
      close(projected[0]+relative[0],floorCorner[0]);
      close(projected[1]+relative[1],floorCorner[1]);
      const hit = applyIsoMatrix(applyIsoMatrix(offset,inverse),linear);
      close(hit[0],offset[0]); close(hit[1],offset[1]);
    }
  }
});

test('#1451 camera is opt-in and accepts only the comparison presets', () => {
  assert.equal(isoLabYaw(false, '?view1451=angle&angle1451=45'), 0);
  assert.equal(isoLabYaw(true, ''), 35);
  assert.deepEqual(isoLabCamera(true, ''), { yaw:35, floorScaleY:Math.sin(40*Math.PI/180), tiltDeg:50 });
  assert.equal(isoLabYaw(true, '?view1451=dev&angle1451=45'), 0);
  for (const angle of [25, 35, 45]) assert.equal(isoLabYaw(true, `?view1451=angle&angle1451=${angle}`), angle);
  for (const angle of ['', 'NaN', 'Infinity', '-25', '360']) assert.equal(isoLabYaw(true, `?view1451=angle&angle1451=${angle}`), 35);
});

test('#1451 reference camera compresses floor depth and raises height with one orthographic elevation', () => {
  assert.deepEqual(isoLabCamera(false, '?view1451=depth'), { yaw:0, floorScaleY:1, tiltDeg:20 });
  assert.deepEqual(isoLabCamera(true, '?view1451=angle&angle1451=25'), { yaw:25, floorScaleY:1, tiltDeg:20 });
  for (const elevation of [30,35,40]) for (const yaw of [25,35,45]) for (const turn of [0,90,180,270]) {
    const profile = isoLabCamera(true, `?view1451=depth&angle1451=${yaw}&elevation1451=${elevation}`);
    const camera = { ...ISO_CAMERA, ...profile, rotDeg: profile.yaw+turn };
    const sin = Math.sin(elevation*Math.PI/180), cos = Math.cos(elevation*Math.PI/180);
    close(profile.floorScaleY,sin);
    for (const p of [[0,0],[1000,1000],[-5000,3000],[219,739]]) {
      const projected = projectPlanPoint(p,0,camera), plain = projectPlanPoint(p,0,{...camera,floorScaleY:1});
      close(projected[0],plain[0]); close(projected[1]-500,(plain[1]-500)*sin);
      assert.deepEqual(applyIsoMatrix(p,isoFloorMatrix(camera)),projected);
      const back = unprojectFloorPoint(projected,camera);
      close(back[0],p[0]); close(back[1],p[1]);
      close(projectPlanPoint(p,84,camera)[1],projected[1]-84*cos);
    }
  }
  for (const floorScaleY of [0,-1,NaN,Infinity]) {
    assert.throws(()=>isoFloorMatrix({...ISO_CAMERA,floorScaleY}));
    assert.throws(()=>unprojectFloorPoint([500,500],{...ISO_CAMERA,floorScaleY}));
  }
});

test('#1451 angled floor, anchors and pointer inverse share one projection on every side', () => {
  for (const yaw of [25, 35, 45]) for (const turn of [0, 90, 180, 270]) {
    const camera = { ...ISO_CAMERA, rotDeg: yaw + turn };
    const matrix = isoFloorMatrix(camera);
    const stage = { left: 29, top: 117, width: 1280, height: 760 };
    const rect = { x: -200, y: -100, w: 1600, h: 1300 };
    const view = projectedFrame({ rect, wallHeight: ISO_WALL_HEIGHT }, camera);
    for (const point of [[-200, -100], [1400, 1200], [500, 500], [107, 803]]) {
      const floor = projectPlanPoint(point, 0, camera);
      assert.deepEqual(applyIsoMatrix(point, matrix), floor);
      const client = [stage.left + (floor[0] - view.x) / view.w * stage.width,
        stage.top + (floor[1] - view.y) / view.h * stage.height];
      const hit = unprojectFloorPoint(clientToScenePoint(client, stage, view), camera);
      close(hit[0], point[0]); close(hit[1], point[1]);
      const raised = projectPlanPoint(point, 4, camera);
      close(raised[0], floor[0]); close(raised[1], floor[1] - 4 * Math.sin(20 * Math.PI / 180));
      for (const z of [0, ISO_WALL_HEIGHT]) {
        const p = projectPlanPoint(point, z, camera);
        assert.ok(p[0] >= view.x - 1e-8 && p[0] <= view.x + view.w + 1e-8);
        assert.ok(p[1] >= view.y - 1e-8 && p[1] <= view.y + view.h + 1e-8);
      }
    }
    for (const end of [[600, 500], [500, 600]]) {
      assert.ok(Math.abs(projectPlanPoint(end, 0, camera)[0] - 500) > 40,
        'both wall directions have a visible face instead of collapsing to a line');
    }
  }
});

test('Stage 4 camera is the exact fixed zero-yaw camera with the 20° wall rise', () => {
  assert.equal(ISO_CAMERA.rotDeg, 0);
  assert.equal(ISO_CAMERA.tiltDeg, 20);
  const origin = projectPlanPoint([500, 500], 0);
  assert.deepEqual(origin, [500, 500]);
  assert.equal(ISO_WALL_HEIGHT, 84);
  assert.equal(ISO_OVERLAY_VISUAL_OFFSET, 4);
  assert.equal(ISO_RAISED_OVERLAY_HEIGHT, 4);
});

test('#713 AC1: the 2.5D floor is the Flat plane and height rises straight up', () => {
  const s = Math.sin(20 * Math.PI / 180);
  assert.deepEqual(isoPlaneMatrix(0).map((value) => value + 0), [1, 0, 0, 1, 0, 0],
    'the floor matrix is the identity: no cos 20° foreshortening');
  for (const point of [[0, 0], [250, 750], [-3000, 4000], [1000, 1000]]) {
    assert.deepEqual(projectPlanPoint(point, 0), point, 'floor points keep their Flat position');
    assert.deepEqual(unprojectFloorPoint(point), point, 'floor hit testing is the identity too');
    for (const z of [ISO_WALL_HEIGHT, 7, 168]) {
      const lifted = projectPlanPoint(point, z);
      close(lifted[0], point[0]);
      close(lifted[1], point[1] - z * s);
    }
  }
  const wall = [300, 400];
  close(projectPlanPoint(wall, 0)[1] - projectPlanPoint(wall, ISO_WALL_HEIGHT)[1],
    ISO_WALL_HEIGHT * 0.3420201433256687, 1e-12);
  close(ISO_WALL_HEIGHT * s, 28.729692039353627, 1e-9);
});

test('floor projection round-trips across the infinite canvas contract', () => {
  for (const point of [[-5000, -5000], [0, 0], [500, 500], [5000, 5000], [-1234.5, 4321.25]]) {
    const roundTrip = unprojectFloorPoint(projectPlanPoint(point, 0));
    close(roundTrip[0], point[0]);
    close(roundTrip[1], point[1]);
  }
});

test('floor matrix is identical to point projection', () => {
  const [a, b, c, d, e, f] = isoFloorMatrix();
  for (const point of [[0, 0], [250, 750], [-3000, 4000]]) {
    const projected = projectPlanPoint(point, 0);
    close(a * point[0] + c * point[1] + e, projected[0]);
    close(b * point[0] + d * point[1] + f, projected[1]);
  }
});

test('one canonical affine helper projects floor and raised planes', () => {
  for (const z of [0, ISO_WALL_HEIGHT, ISO_RAISED_OVERLAY_HEIGHT]) {
    const matrix = isoPlaneMatrix(z);
    for (const point of [[0, 0], [250, 750], [-3000, 4000]]) {
      const projected = projectPlanPoint(point, z);
      const affine = applyIsoMatrix(point, matrix);
      close(affine[0], projected[0]);
      close(affine[1], projected[1]);
    }
    assert.match(isoPlaneMatrixCss(z), /^matrix\([-0-9.e ]+\)$/);
  }
  assert.deepEqual(isoPlaneMatrix(0), isoFloorMatrix());
  assert.equal(isoOverlayVisualHeight(4), 4);
});

test('projected frame includes raised wall tops and is view-state independent', () => {
  const rect = { x: 100, y: 200, w: 400, h: 300 };
  const frame = projectedFrame({ rect, wallHeight: ISO_WALL_HEIGHT });
  const floorOnly = projectedFrame({ rect, wallHeight: 0 });
  assert.ok(frame.y < floorOnly.y);
  assert.ok(frame.h > floorOnly.h);
  assert.deepEqual(projectedFrame({ rect, wallHeight: ISO_WALL_HEIGHT }), frame);
});

test('Stage 2 frame includes opening tops and the structural floor edge, not blur', () => {
  const rect = { x: 100, y: 200, w: 400, h: 300 };
  const stage1 = projectedFrame({ rect, wallHeight: ISO_WALL_HEIGHT });
  const stage2 = projectedFrame({
    rect, wallHeight: ISO_WALL_HEIGHT, openingHeight: ISO_WALL_HEIGHT + 5, floorDepth: 10,
  });
  assert.ok(stage2.y < stage1.y);
  assert.ok(stage2.h > stage1.h);
  assert.deepEqual(Object.keys(stage2).sort(), ['h', 'w', 'x', 'y']);
});

test('Stage 4 frame already contains the low overlay plane at zero yaw', () => {
  const rect = { x: 100, y: 200, w: 400, h: 300 };
  const wallFrame = projectedFrame({ rect, wallHeight: ISO_WALL_HEIGHT });
  const raisedFrame = projectedFrame({
    rect,
    wallHeight: ISO_WALL_HEIGHT,
    raisedHeight: ISO_RAISED_OVERLAY_HEIGHT,
  });
  assert.deepEqual(raisedFrame, wallFrame, 'the wall top encloses the low overlay plane');
  const projectedFloor = [
    [rect.x, rect.y], [rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y + rect.h], [rect.x, rect.y + rect.h],
  ].map((point) => projectPlanPoint(point, 0));
  const projectedWidth = Math.max(...projectedFloor.map((point) => point[0]))
    - Math.min(...projectedFloor.map((point) => point[0]));
  close(projectedWidth, rect.w);
});

test('client coordinates map through the current scene view', () => {
  const scene = clientToScenePoint([250, 175], { left: 50, top: 25, width: 400, height: 300 },
    { x: 100, y: 200, w: 800, h: 600 });
  assert.deepEqual(scene, [500, 500]);
});

test('degenerate cameras and frames throw instead of mixing projections', () => {
  assert.throws(() => projectPlanPoint([0, 0], 0, { ...ISO_CAMERA, xyScale: 0 }));
  assert.throws(() => unprojectFloorPoint([0, 0], { ...ISO_CAMERA, xyScale: 0 }));
  assert.throws(() => unprojectFloorPoint([Number.NaN, 0]));
  assert.throws(() => clientToScenePoint([0, 0], { left: 0, top: 0, width: 0, height: 1 },
    { x: 0, y: 0, w: 1, h: 1 }));
  assert.throws(() => isoOverlayVisualHeight(-1));
  assert.throws(() => projectedFrame({
    rect: { x: 0, y: 0, w: 1, h: 1 }, wallHeight: 64, raisedHeight: -1,
  }));
});
