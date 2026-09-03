// #434: the embedded card treats decor_assets_api as fresh runtime authority.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 800, height: 700 });
const out = await page.evaluate(async () => {
  await customElements.whenDefined('houseplan-space-card');
  const source = window.__card;
  const config = structuredClone(source._serverCfg);
  const space = config.spaces[0];
  const assetId = 'a'.repeat(64);
  space.decor = [...(space.decor || []), {
    id: 'capability-image', kind: 'image', asset_id: assetId,
    x: 0.1, y: 0.1, w: 0.2, h: 0.2,
  }];
  let capability;
  let resolveCalls = 0;
  const hass = {
    ...source.hass,
    connection: {},
    callWS: async (message) => {
      if (message.type === 'houseplan/config/get') return {
        config,
        rev: 434,
        ...(capability === undefined ? {} : { decor_assets_api: capability }),
      };
      if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
      if (message.type === 'houseplan/assets/resolve') {
        resolveCalls++;
        return { assets: [{
          asset_id: assetId, name: 'proof.png', mime: 'image/png',
          width: 1, height: 1, bytes: 1,
          url: `/api/houseplan/content/assets/_/${assetId}.png`,
        }], missing: [] };
      }
      return source.hass.callWS(message);
    },
  };
  const card = document.createElement('houseplan-space-card');
  card.setConfig({ type: 'custom:houseplan-space-card', space: space.id });
  card.hass = hass;
  document.body.append(card);
  const settleLoad = async () => {
    for (let attempt = 0; attempt < 100 && card._loading; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await card.updateComplete;
  };
  await card._load(true);
  await settleLoad();
  const oldBackendSkippedResolve = resolveCalls === 0 && card._decorAssets.size === 0;

  capability = 1;
  await card._load(true);
  await settleLoad();
  const exactCapabilityResolves = resolveCalls === 1 && card._decorAssets.has(assetId);
  const capabilityOnlyUpgradeAdopted = card._snap.decorAssetsApi === 1;
  await card._load(true);
  await settleLoad();
  const sameEpochUsesCache = resolveCalls === 1;

  capability = undefined;
  await card._load(true);
  await settleLoad();
  const downgradeRevokesWithoutResolve = resolveCalls === 1
    && card._snap.decorAssetsApi === null && card._decorAssets.size === 0;
  card.remove();

  return {
    oldBackendSkippedResolve,
    exactCapabilityResolves,
    capabilityOnlyUpgradeAdopted,
    sameEpochUsesCache,
    downgradeRevokesWithoutResolve,
  };
});

checkAll(out);
await finish(browser, out);
