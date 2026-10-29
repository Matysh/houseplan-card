import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanRotationMotion } from '../test-build/plan-rotation-motion.js';

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function fixture() {
  const wrap = { style: { transform: '', transformOrigin: '', willChange: '' }, isConnected: true };
  const svg = { viewBox: { baseVal: { width: 1000, height: 500 } } };
  const stage = { style: { overflow: 'visible' }, inert: false, isConnected: true, clientWidth: 800, clientHeight: 600,
    querySelector: selector => selector === '.zoomwrap' ? wrap : svg };
  let generation = 1, reduced = false, blocked = false, id = 0;
  const frames = new Map(), changes = [];
  const port = {
    current: () => { const captured = generation; return () => captured === generation; },
    stage: () => stage,
    changed: direction => { changes.push(direction); [svg.viewBox.baseVal.width, svg.viewBox.baseVal.height] = [svg.viewBox.baseVal.height, svg.viewBox.baseVal.width]; },
    updated: () => Promise.resolve(), reduced: () => reduced, blocked: () => blocked,
    requestFrame: callback => { frames.set(++id, callback); return id; }, cancelFrame: key => frames.delete(key), now: () => 0,
  };
  const motion = new PlanRotationMotion(port);
  const frame = time => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(time); };
  return { motion, port, stage, wrap, frames, changes, frame, retire: () => generation++, reduced: () => { reduced = true; }, block: () => { blocked = true; } };
}

test('#1119 quarter turn follows 280ms easing and restores its own style/input lease', async () => {
  const f = fixture(); f.motion.rotate(1); await flush();
  assert.deepEqual(f.changes, [1]); assert.equal(f.stage.inert, true);
  assert.match(f.wrap.style.transform, /^rotate\(-90deg\) scale\(1\.333/);
  f.frame(140); assert.match(f.wrap.style.transform, /^rotate\(-11\.25deg\)/);
  f.frame(279); assert.notEqual(f.wrap.style.transform, ''); assert.equal(f.stage.inert, true);
  f.frame(280); assert.equal(f.wrap.style.transform, ''); assert.equal(f.wrap.style.willChange, '');
  assert.equal(f.stage.style.overflow, 'visible'); assert.equal(f.stage.inert, false); assert.equal(f.frames.size, 0);
});

test('#1119 repeated native intents remain ordered; retirement cannot run a queued turn', async () => {
  const f = fixture(); f.motion.rotate(1); f.motion.rotate(-1); await flush();
  assert.deepEqual(f.changes, [1]); f.frame(280); await flush(); assert.deepEqual(f.changes, [1, -1]);
  f.frame(280); assert.equal(f.stage.inert, false);
  const g = fixture(); g.motion.rotate(1); g.motion.rotate(1); await flush(); g.retire(); g.frame(20); await flush();
  assert.deepEqual(g.changes, [1]); assert.equal(g.wrap.style.transform, ''); assert.equal(g.frames.size, 0);
});

test('#1119 cancellation during pending render retires later callbacks; reduced motion uses final frames only', async () => {
  const f = fixture(); let ready; f.port.updated = () => new Promise(resolve => { ready = resolve; });
  f.motion.rotate(1); f.motion.rotate(1); f.motion.cancel(); ready(); await flush();
  assert.deepEqual(f.changes, [1]); assert.equal(f.frames.size, 0); assert.equal(f.stage.inert, false);
  const g = fixture(); g.reduced(); g.motion.rotate(1); g.motion.rotate(-1); await flush();
  assert.deepEqual(g.changes, [1,-1]); assert.equal(g.frames.size, 0); assert.equal(g.wrap.style.transform, '');
});

test('#1119 finishing rotation cannot release a concurrent mode input barrier', async () => {
  const f = fixture(); f.motion.rotate(1); await flush(); f.block(); f.motion.cancel();
  assert.equal(f.stage.inert, true); assert.equal(f.wrap.style.transform, ''); assert.equal(f.frames.size, 0);
});
