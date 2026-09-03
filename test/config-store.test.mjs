import assert from 'node:assert/strict';
import test from 'node:test';

const loadFresh = (name) => import(new URL(
  `../test-build/config-store.js?case=${name}-${Date.now()}`,
  import.meta.url,
));

test('#434 config snapshots learn and revoke only exact decor API v1', async () => {
  let capability = 1;
  const hass = {
    callWS: async ({ type }) => type === 'houseplan/config/get'
      ? { config: { spaces: [] }, rev: 4, decor_assets_api: capability }
      : { layout: {}, rev: 1 },
  };
  const { getConfig } = await loadFresh('capability');
  assert.equal((await getConfig(hass)).decorAssetsApi, 1);

  capability = 2;
  assert.equal((await getConfig(hass, true)).decorAssetsApi, null);
  capability = undefined;
  assert.equal((await getConfig(hass, true)).decorAssetsApi, null);
});

test('#434 localStorage snapshot cannot grant a server runtime capability', async () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => JSON.stringify({
      config: { spaces: [] }, rev: 8, layout: {}, decor_assets_api: 1,
    }),
  };
  try {
    const { cachedSnapshot } = await loadFresh('seed');
    assert.equal(cachedSnapshot()?.decorAssetsApi, null);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
