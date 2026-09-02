import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adoptDecorAssets, decorAssetIds, initialDecorImageCm,
  projectDecorImage, resolveDecorAssets,
} from '../test-build/decor-assets.js';
import { decorBoxItem } from '../test-build/space-geometry.js';

const id = (char) => char.repeat(64);

test('#51 initial image sizing preserves aspect and caps portrait height', () => {
  assert.deepEqual(initialDecorImageCm(400, 200), { w: 100, h: 50 });
  assert.deepEqual(initialDecorImageCm(100, 400), { w: 50, h: 200 });
  assert.deepEqual(initialDecorImageCm(0, 0), { w: 100, h: 100 });
});

test('#51 asset ids are unique across spaces and malformed ids fail closed', () => {
  assert.deepEqual(decorAssetIds({ spaces: [
    { decor: [{ kind: 'image', asset_id: id('b') }, { kind: 'image', asset_id: 'bad' }] },
    { decor: [{ kind: 'image', asset_id: id('b') }, { kind: 'image', asset_id: id('a') }] },
  ] }), [id('b'), id('a')]);
});

test('#51 full and static renderers share one fail-closed image projection', () => {
  const shape = {
    id: 'image', kind: 'image', asset_id: id('d'),
    x: 0.1, y: 0.2, w: 0.3, h: 0.4, angle: 405, opacity: 2,
    flip_h: true,
  };
  assert.deepEqual(projectDecorImage(shape, 1000, 500), [
    100, 100, 300, 200, 1,
    'translate(250 200) rotate(45) scale(-1 1) translate(-250 -200)',
  ]);
  assert.equal(projectDecorImage({ ...shape, w: 0 }, 1000, 500), null);
});

test('#51 resolve projection rejects malformed catalog rows', () => {
  const good = {
    asset_id: id('c'), name: 'safe.svg', mime: 'image/svg+xml',
    width: 20, height: 10, bytes: 100, url: `/api/houseplan/content/assets/_/${id('c')}.svg`,
  };
  const adopted = adoptDecorAssets({ assets: [good, { ...good, asset_id: 'bad' }, { ...good, width: 0 }] });
  assert.equal(adopted.size, 1);
  assert.deepEqual(adopted.get(id('c')), good);
  assert.equal(adoptDecorAssets({ assets: [{ ...good, url: 'https://example.com/tracker.svg' }] }).size, 0);
  assert.equal(adoptDecorAssets({ assets: [{ ...good, mime: 'image/png' }] }).size, 0);
});

test('#51 a rotated image contributes its complete visible bounds to framing', () => {
  const item = decorBoxItem({ x: 0.1, y: 0.2, w: 0.2, h: 0.1, angle: 90 });
  assert.ok(item);
  assert.ok(Math.abs(item.minX - 150) < 1e-9);
  assert.ok(Math.abs(item.maxX - 250) < 1e-9);
  assert.ok(Math.abs(item.minY - 150) < 1e-9);
  assert.ok(Math.abs(item.maxY - 350) < 1e-9);
});

test('#51 resolve batches and deduplicates ids at the backend cap', async () => {
  const calls = [];
  const hass = { callWS: async (message) => {
    calls.push(message.asset_ids);
    return { assets: message.asset_ids.map((asset_id) => ({
      asset_id, name: 'x.png', mime: 'image/png', width: 1, height: 1,
      bytes: 1, url: `/api/houseplan/content/assets/_/${asset_id}.png`,
    })) };
  } };
  const ids = Array.from({ length: 201 }, (_, index) => index.toString(16).padStart(64, '0'));
  const resolved = await resolveDecorAssets(hass, [ids[0], ...ids]);
  assert.equal(resolved.size, 201);
  assert.deepEqual(calls.map((batch) => batch.length), [200, 1]);
  assert.equal(await resolveDecorAssets(hass, [...ids].reverse()), resolved);
  assert.deepEqual(calls.map((batch) => batch.length), [200, 1]);
});

test('#51 missing asset ids are negative-cached with their complete set', async () => {
  let calls = 0;
  const connection = {};
  const hass = {
    connection,
    callWS: async () => { calls++; return { assets: [], missing: [id('f')] }; },
  };
  const first = await resolveDecorAssets(hass, [id('f')]);
  const second = await resolveDecorAssets({ ...hass }, [id('f')]);
  assert.equal(first.size, 0);
  assert.equal(second, first);
  assert.equal(calls, 1);
});
