import assert from 'node:assert/strict';
import test from 'node:test';
import { LightBarrierPass } from '../test-build/glow-scene.js';

test('ordinary Glow and LED share one revision within a synchronous render only', () => {
  const pass = new LightBarrierPass(), space = { id: 'floor' };
  let builds = 0;
  const build = () => ({ fingerprint: String(++builds) });
  pass.run(() => {
    const first = pass.read(space, build);
    assert.equal(pass.read(space, build), first);
    assert.equal(pass.read(space, build), first);
    assert.equal(builds, 1);
  });
  assert.equal(pass.read(space, build).fingerprint, '2');
  assert.equal(pass.read(space, build).fingerprint, '3');
  pass.run(() => assert.equal(pass.read(space, build).fingerprint, '4'));
});

test('in-place plan and opening changes are fingerprinted again next render', () => {
  const pass = new LightBarrierPass(), space = { id: 'floor', wall: 10, opening: 0 };
  const build = () => ({ fingerprint: `${space.wall}/${space.opening}` });
  const render = () => pass.run(() => pass.read(space, build));
  assert.equal(render().fingerprint, '10/0');
  space.wall = 12;
  assert.equal(render().fingerprint, '12/0');
  space.opening = 1;
  assert.equal(render().fingerprint, '12/1');
});

test('owners and different space objects never share a memo, even with the same id', () => {
  const a = new LightBarrierPass(), b = new LightBarrierPass();
  const one = { id: 'floor' }, two = { id: 'floor' };
  let n = 0;
  const build = () => ({ fingerprint: String(++n) });
  a.run(() => b.run(() => {
    assert.equal(a.read(one, build).fingerprint, '1');
    assert.equal(a.read(two, build).fingerprint, '2');
    assert.equal(b.read(one, build).fingerprint, '3');
    assert.equal(a.read(one, build).fingerprint, '1');
  }));
});

test('throwing renders and failed builds cannot retain or poison the next read', () => {
  const pass = new LightBarrierPass(), space = { id: 'floor' };
  const failure = new Error('render failed');
  assert.throws(() => pass.run(() => {
    assert.throws(() => pass.read(space, () => { throw failure; }), failure);
    pass.read(space, () => ({ fingerprint: 'old' }));
    throw failure;
  }), failure);
  assert.equal(pass.read(space, () => ({ fingerprint: 'new' })).fingerprint, 'new');
});

test('nested synchronous passes restore the outer memo without leaking the inner one', () => {
  const pass = new LightBarrierPass(), space = { id: 'floor' };
  const outer = { fingerprint: 'outer' }, inner = { fingerprint: 'inner' };
  pass.run(() => {
    assert.equal(pass.read(space, () => outer), outer);
    pass.run(() => assert.equal(pass.read(space, () => inner), inner));
    assert.equal(pass.read(space, () => { throw Error('outer memo missing'); }), outer);
  });
  assert.equal(pass.read(space, () => inner), inner);
});
