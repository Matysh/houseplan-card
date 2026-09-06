// #474: designer furniture artwork lives in a lazy chunk.
//   AC2  a plan WITH furniture: the boot veil holds until the artwork lands,
//        so the first revealed frame already draws every piece — even when
//        the chunk is artificially slow (600 ms, inside BOOT_MAX_MS);
//   AC3  a plan WITHOUT furniture never requests the chunk at all;
//   AC4  the chunk failing twice (network) settles into fallback: the veil
//        lifts, the plan and devices are alive, pieces render as nothing,
//        exactly one toast is shown;
//   AC5  a chunk from another build is terminal: one import, no retry;
//   AC11 two cards on one page share one request.
// The production bundle is served from demo/srv/assets with the demo page's
// CFG patched to carry furniture; the chunk itself is routed per scenario.
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { checkAll, finish, watchPage } from './serve.mjs';

const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const artPath = manifest.lazyFurnitureArtFiles?.[0];
if (!artPath) throw new Error('furniture artwork chunk is absent from the bundle manifest');
const artName = artPath.split('/').at(-1);
const SRV = new URL('./srv', import.meta.url).pathname;
const CT = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };

const FURNITURE = `decor:[
  {id:'lazy-sofa', kind:'furniture', symbol:'sofa', x:0.10, y:0.20, w:0.18, h:0.09, rot:0},
  {id:'lazy-fridge', kind:'furniture', symbol:'fridge', x:0.60, y:0.20, w:0.06, h:0.065, rot:0},
  {id:'lazy-bed', kind:'furniture', symbol:'bed_double', x:0.60, y:0.55, w:0.16, h:0.20, rot:0}
], `;

const demoHtml = (withFurniture, twoCards) => {
  let html = readFileSync(`${SRV}/demo.html`, 'utf8');
  if (withFurniture) {
    const anchor = "{ id:'f1', title:'Ground floor',";
    if (!html.includes(anchor)) throw new Error('demo.html fixture anchor moved');
    html = html.replace(anchor, `{ id:'f1', title:'Ground floor', ${FURNITURE}`);
  }
  if (twoCards) {
    // A second card with the same config: the page runtime must load the
    // artwork once for both.
    const anchor = 'window.__card=card;';
    if (!html.includes(anchor)) throw new Error('demo.html card anchor moved');
    html = html.replace(anchor, anchor
      + 'const card2=document.createElement("houseplan-card");'
      + "card2.setConfig({type:'custom:houseplan-card', title:'Second', icon_size:3.4});"
      + 'document.getElementById("host").appendChild(card2);card2.hass=mkHass();window.__card2=card2;');
  }
  return html;
};

const run = async ({ furniture, twoCards = false, chunk = 'serve', delayMs = 0 }) => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 820, height: 760 } })).newPage();
  watchPage(page);
  const requests = [];
  let artRequests = 0;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/demo.html';
    requests.push(p);
    if (p === '/demo.html') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: demoHtml(furniture, twoCards) });
    }
    if (p.endsWith(`/${artName}`)) {
      artRequests++;
      if (chunk === 'abort') return route.abort('failed');
      if (chunk === 'foreign') {
        const body = readFileSync(`${SRV}${p}`, 'utf8').replaceAll(manifest.fingerprint, 'another-build');
        return route.fulfill({ status: 200, contentType: 'text/javascript', body });
      }
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const file = `${SRV}${p}`;
    return existsSync(file)
      ? route.fulfill({ status: 200, headers: { 'content-type': CT[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' }, body: readFileSync(file) })
      : route.fulfill({ status: 404, body: 'nf' });
  });
  await page.goto('http://demo.local/demo.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__card?._model?.length > 0, { timeout: 9000 });
  // The first REVEALED frame: capture what the stage holds the moment the
  // veil lifts, before any later re-render could paint the pieces in.
  const revealed = await page.evaluate(() => new Promise((resolve) => {
    const card = window.__card;
    const root = () => card.shadowRoot || card.renderRoot;
    const snapshot = () => ({
      furniture: root().querySelectorAll('[data-kind="furniture"]').length,
      devices: card._devices?.length ?? 0,
      booting: card._booting,
    });
    const tick = () => {
      if (card._booting === false) return resolve(snapshot());
      setTimeout(tick, 5);
    };
    tick();
  }));
  await page.waitForFunction(() => window.__card._booting === false, { timeout: 9000 });
  await page.evaluate(() => { const c = window.__card; c.hass = { ...c.hass }; });
  await page.waitForFunction(() => window.__card._devices.length > 0, { timeout: 9000 });
  // Let a possible fallback/toast settle.
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => {
    const card = window.__card;
    const root = card.shadowRoot || card.renderRoot;
    return {
      furniture: root.querySelectorAll('[data-kind="furniture"]').length,
      toasts: root.querySelectorAll('.toast').length,
      toastText: root.querySelector('.toast')?.textContent?.trim() ?? '',
      booting: card._booting,
      devices: card._devices.length,
      secondCardFurniture: window.__card2
        ? (window.__card2.shadowRoot || window.__card2.renderRoot)?.querySelectorAll('[data-kind="furniture"]').length ?? -1
        : null,
    };
  });
  await browser.close();
  return { revealed, after, artRequests, requests };
};

const out = {};

// AC2 — furniture in the first revealed frame, chunk slowed by 600 ms.
const slow = await run({ furniture: true, delayMs: 600 });
out.slowChunkStillDrawnInFirstRevealedFrame = slow.revealed.furniture === 3;
out.slowChunkRequestedExactlyOnce = slow.artRequests === 1;
out.legacyPieceNeedsNoChunk = slow.revealed.furniture >= 1; // fridge is primitive art

// AC3 — no furniture, no request.
const plain = await run({ furniture: false });
out.planWithoutFurnitureNeverRequestsArtwork = plain.artRequests === 0
  && !plain.requests.some((p) => p.endsWith(`/${artName}`));
out.planWithoutFurnitureBootsNormally = plain.after.booting === false && plain.after.devices > 0;

// AC4 — the chunk fails twice: fallback, veil lifted, plan alive, one toast.
const broken = await run({ furniture: true, chunk: 'abort' });
out.failedChunkLiftsTheVeil = broken.after.booting === false;
out.failedChunkKeepsPlanAndDevicesAlive = broken.after.devices > 0;
out.failedChunkRetriedExactlyOnce = broken.artRequests === 2;
// Designer pieces (sofa, bed) render as nothing; the legacy fridge still draws.
out.failedChunkDrawsOnlyLegacyPieces = broken.after.furniture === 1;
out.failedChunkShowsOneToast = broken.after.toasts === 1
  && /furniture|мебел/i.test(broken.after.toastText);

// AC5 — foreign build: terminal, one import, no retry, same fallback.
const foreign = await run({ furniture: true, chunk: 'foreign' });
out.foreignBuildIsTerminalWithoutRetry = foreign.artRequests === 1;
out.foreignBuildFallsBackLikeNetworkFailure = foreign.after.booting === false
  && foreign.after.furniture === 1 && foreign.after.toasts === 1;

// AC11 — two cards, one request.
const pair = await run({ furniture: true, twoCards: true });
out.twoCardsShareOneArtworkRequest = pair.artRequests === 1;
out.twoCardsBothDrawFurniture = pair.after.furniture === 3
  && (pair.after.secondCardFurniture === 3 || pair.after.secondCardFurniture === null);

checkAll(out);
await finish(undefined, out);
