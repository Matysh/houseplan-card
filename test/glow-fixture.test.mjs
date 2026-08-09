import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = () => JSON.parse(readFileSync(
  new URL('./fixtures/glow/additive-pools.json', import.meta.url), 'utf8',
));

test('shared additive Glow fixture is deterministic and covers 1/10/30/60 pools', () => {
  const fixture = load();
  assert.equal(fixture.fixture, 'additive-pools-v1');
  assert.deepEqual(fixture.variants, [1, 10, 30, 60]);
  assert.equal(fixture.config.spaces[0].rooms.length, 2);
  assert.equal(fixture.config.spaces[0].walls.length > 0, true);
  assert.equal(fixture.config.spaces[0].openings.length > 0, true);
  assert.equal(fixture.config.markers.length, 60);
  assert.equal(Object.keys(fixture.layout).length, 60);
  assert.equal(Object.keys(fixture.ha.states).length, 60);
  assert.equal(new Set(fixture.config.markers.map((marker) => marker.id)).size, 60);
  assert.equal(JSON.stringify(load()), JSON.stringify(fixture));
});

