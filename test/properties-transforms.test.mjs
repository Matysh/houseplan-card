import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchDecorProperties, decorPropertiesBox, patchStairProperties, patchBackdropProperties } from '../test-build/editors/properties/transforms.js';
import { planRect } from '../test-build/space-geometry.js';

test('#931 geometry adapters change only the declared keys, preserving off-grid axes and legacy/null fields', () => {
  const text = { id: 'text', kind: 'text', x: .2, y: .2222222222, text: 'Legacy {}', entity: 'sensor.t', unit: 'custom', size: 's', scale: 1.6, color: '#123456', future: null };
  assert.deepEqual(patchDecorProperties(text, 'x', 360, 5), { ...text, x: .3 });
  assert.deepEqual(patchDecorProperties(text, 'angle', 360, 5), { ...text, angle: 0 });
  assert.equal(patchDecorProperties(text, 'w', 30, 5), null);
});

test('#931 image ratio lock is atomic and all resizes preserve centre, angle, flips and unknown siblings', () => {
  const image = { id: 'im', kind: 'image', x: .2, y: .3, w: .2, h: .4, angle: 23, flip_h: true, asset_id: 'asset', future: 'keep' };
  const locked = patchDecorProperties(image, 'w', 120, 5, .5);
  assert.equal(locked.w, .1); assert.equal(locked.h, .2);
  const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-12);
  near(decorPropertiesBox(locked).x, decorPropertiesBox(image).x);
  near(decorPropertiesBox(locked).y, decorPropertiesBox(image).y);
  assert.equal(locked.angle, 23); assert.equal(locked.flip_h, true); assert.equal(locked.future, 'keep');
  const free = patchDecorProperties(locked, 'w', 240, 5);
  assert.equal(free.h, .2);
  assert.equal(patchDecorProperties(image, 'h', -1, 5, .5), null);
  assert.equal(patchDecorProperties(image, 'w', 25001, 5), null);
});

test('#931 rect size uses the native size lattice without re-snapping its fixed centre', () => {
  const shape = { id: 'r', kind: 'rect', x: .111, y: .222, w: .2, h: .1, color: '#123456', fill: false };
  const result = patchDecorProperties(shape, 'w', 121, 5);
  assert.equal(result.w, .1);
  assert.ok(Math.abs(decorPropertiesBox(shape).x - decorPropertiesBox(result).x) < 1e-12);
  assert.equal(result.y, shape.y); assert.equal(result.h, shape.h); assert.equal(result.fill, false);
  assert.equal(patchDecorProperties(shape, 'w', 1, 5), null);
});

test('#931 stair edits are continuous and never erase target routing or visual fields', () => {
  const stair = { id: 's', kind: 'straight', x: .1, y: .123456, length: .2, width: .1, angle: 21, direction: 'backward', target_space_id: 'floor2', opacity: .8 };
  assert.deepEqual(patchStairProperties(stair, 'length', 234.56, 5), { ...stair, length: 234.56 / 1200 });
  assert.equal(patchStairProperties(stair, 'length', 29.99, 5), null);
  assert.equal(patchStairProperties(stair, 'radius', 50, 5), null);
});

test('#931 backdrop numeric coordinates are transformed centre, size preserves centre, no default alpha migration', () => {
  const plan = { plan_aspect: 2, plan_scale: 1.5, plan_angle: -12, plan_opacity: .3 };
  const before = planRect(plan);
  const changed = { ...plan, ...patchBackdropProperties(plan, 'w', 1200, 5) };
  const after = planRect(changed);
  assert.ok(Math.abs(before.x + before.w/2 - after.x - after.w/2) < 1e-9);
  assert.equal(after.h, before.h); assert.equal(after.angle, -12); assert.equal(after.opacity, .3);
  const position = { ...plan, ...patchBackdropProperties(plan, 'x', 720, 5) };
  const rect = planRect(position);
  assert.equal(rect.x + rect.w/2, 600);
  assert.equal(Object.hasOwn(patchBackdropProperties({}, 'x', 720, 5), 'plan_opacity'), false);
  assert.equal(patchBackdropProperties(plan, 'w', 1, 5), null);
  assert.equal(patchBackdropProperties(plan, 'opacity', 1.01, 5), null);
  assert.equal(planRect({ plan_opacity: 0 }).opacity, 0);
  assert.equal(Object.hasOwn(planRect({}), 'opacity'), false);
});

test('#931 infinite-canvas limits are normalized units, not a new 5000-render-unit border',()=>{
  const text={id:'t',kind:'text',x:0,y:0,text:'Text'};
  assert.equal(patchDecorProperties(text,'x',12000,5).x,10);
  assert.equal(patchDecorProperties(text,'x',6000001,5),null);
  const stair={id:'s',kind:'straight',x:0,y:0,length:.2,width:.1,angle:0,direction:'forward'};
  assert.equal(patchStairProperties(stair,'y',-12000,5).y,-10);
  assert.equal(patchStairProperties(stair,'y',-6000001,5),null);
  assert.ok(patchBackdropProperties({},'x',12000,5));
});

test('#931 line numeric transforms canonicalize their vector without moving the legacy centre',()=>{
  const line={id:'l',kind:'line',x1:.123,y1:.234,x2:.323,y2:.234};
  const changed=patchDecorProperties(line,'angle',45,5);
  const before=decorPropertiesBox(line),after=decorPropertiesBox(changed);
  assert.ok(Math.abs(before.x-after.x)<1e-12);assert.ok(Math.abs(before.y-after.y)<1e-12);
  assert.ok(Math.abs((changed.x2-changed.x1)*240-Math.round((changed.x2-changed.x1)*240))<1e-9);
  assert.ok(Math.abs((changed.y2-changed.y1)*240-Math.round((changed.y2-changed.y1)*240))<1e-9);
});
