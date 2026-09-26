// #654: the first visible successful frame is already 2.5D with the settled
// floor classification. The same boundary covers ordinary View and kiosk;
// a failed lazy chunk must release to the existing safe Flat fallback.
import { assertFreshDemoBundleUnlessAllowed } from './bundle-freshness.mjs';
import { checkAll, finish, launchPanelCold } from './serve.mjs';

async function observe({ volumetric = true, kiosk = false, delay = 0, fail = false }) {
  const { page, browser } = await launchPanelCold({ width: 900, height: 760 });
  await page.route('**/iso-scene-render-*.js*', async (route) => {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (fail) await route.fulfill({ status: 503, body: 'injected iso runtime failure' });
    else await route.fallback();
  });
  await page.evaluate(async ({ wantsIso, isKiosk }) => {
    document.documentElement.style.setProperty('--ha-card-background', '#fff');
    const hass = window.__mkHass();
    const configResult = await hass.callWS({ type: 'houseplan/config/get' });
    const layoutResult = await hass.callWS({ type: 'houseplan/layout/get' });
    const config = structuredClone(configResult.config);
    config.settings = { ...(config.settings || {}), ...(wantsIso ? { volumetric_view: true } : {}) };
    const rev = window.__pushServerConfig(config);
    localStorage.setItem('houseplan_card_cfg_v1', JSON.stringify({
      config, rev, layout: layoutResult.layout, layout_rev: layoutResult.rev,
    }));
    await import('/assets/houseplan-card.js');
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan', icon_size: 3.4,
      ...(isKiosk ? { kiosk: true } : {}) });
    document.getElementById('host').appendChild(card);
    card.hass = hass;
    window.__card = card;
  }, { wantsIso: volumetric, isKiosk: kiosk });
  await page.waitForFunction(() => window.__card?._model?.length > 0, { timeout: 9000 });
  await assertFreshDemoBundleUnlessAllowed(page);
  const result = await page.evaluate(async (expectFailure) => {
    const card = window.__card;
    const records = [];
    const read = () => {
      const stage = card.renderRoot.querySelector('.stage');
      const wrap = stage?.querySelector(':scope > .zoomwrap');
      const visible = !!wrap && getComputedStyle(wrap).visibility !== 'hidden';
      const iso = !!stage?.classList.contains('projection-iso');
      const light = !!stage?.querySelector('.dev.iso-floor-light');
      const shadow = stage?.querySelector('.iso-tile-shadow');
      records.push({ visible, iso, light, readiness: stage?.dataset.hpIsoReadiness || '',
        veil: !!stage?.querySelector('.bootveil:not(.off)'),
        shadowOpacity: shadow ? getComputedStyle(shadow).opacity : null });
      return records.at(-1);
    };
    const deadline = performance.now() + 7000;
    while (performance.now() < deadline) {
      const now = read();
      if (now.visible && (expectFailure ? !now.iso : now.iso && now.light)) break;
      await new Promise((done) => requestAnimationFrame(done));
    }
    const visible = records.filter((row) => row.visible);
    return { records, firstVisible: visible[0] || null };
  }, fail);
  await browser.close();
  return result;
}

const ordinary = await observe({ delay: 1600 });
const kiosk = await observe({ kiosk: true, delay: 350 });
const failed = await observe({ kiosk: true, delay: 50, fail: true });
const flat = await observe({ volumetric: false, kiosk: true });

const out = {
  ordinaryNeverShowsIntermediateFlat: ordinary.records
    .filter((row) => row.visible).every((row) => row.iso),
  ordinaryFirstVisibleIsSettledIso: ordinary.firstVisible?.iso === true
    && ordinary.firstVisible.light === true && ordinary.firstVisible.readiness === 'ready'
    && ordinary.firstVisible.shadowOpacity === '1',
  ordinaryPendingOutlivesBootCap: ordinary.records.some((row) =>
    !row.visible && row.readiness === 'pending' && row.veil),
  kioskNeverShowsIntermediateFlat: kiosk.records
    .filter((row) => row.visible).every((row) => row.iso),
  kioskFirstVisibleIsSettledIso: kiosk.firstVisible?.iso === true
    && kiosk.firstVisible.light === true && kiosk.firstVisible.readiness === 'ready'
    && kiosk.firstVisible.shadowOpacity === '1',
  failedChunkReleasesFiniteFlatFallback: failed.firstVisible?.iso === false
    && failed.firstVisible.readiness === 'fallback' && failed.firstVisible.veil === false,
  flatKioskHasNoIsoWait: flat.firstVisible?.iso === false
    && flat.firstVisible.readiness === '' && flat.firstVisible.veil === false,
};

checkAll(out);
await finish(null, out);
