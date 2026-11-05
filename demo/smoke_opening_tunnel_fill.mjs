/** #1250: real composed pixels across the floor/opening seam, not a tunnel DOM contract. */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
import { prepareDesktopControls } from './helpers/desktop-controls.mjs';
import { makeStaticWallOpeningsFixture } from './fixtures/static-wall-openings.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
requirePinnedBrowser('#1250 unified room floor pixels');
const { page, browser } = await launch({ width: 1440, height: 1000 });
await prepareDesktopControls(page);
const output = 'artifacts/process-next/room-floor-paint'; mkdirSync(output, { recursive: true });
const out = {};
const settle = () => page.evaluate(async () => {
  const c = window.__card; await c.updateComplete;
  for (let i = 0; i < 18; i++) await new Promise(requestAnimationFrame);
});
async function seed(diagonal = false) {
  const cfg = commitWallSegmentModel(makeStaticWallOpeningsFixture({ diagonal })).config;
  cfg.spaces[0].settings.wall_fill = { c: '#778899', a: .35 };
  await page.evaluate(async cfg => { await window.__hpTest.setServerConfig(cfg); window.__card._fitAll(); }, cfg);
  await settle();
}
async function fills(a, b) {
  await page.evaluate(async ({ a, b }) => {
    await window.__hpTest.setServerConfig(cfg => {
      cfg.spaces[0].rooms.forEach((r, i) => { const value = i ? b : a;
        r.settings.fill_mode = value ? 'custom' : 'none';
        if (value) r.settings.custom_fill = value;
      });
    });
  }, { a, b }); await settle();
}
function pixel(image, point) {
  const x = Math.round(point[0]), y = Math.round(point[1]);
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) throw Error('pixel outside screenshot');
  return [...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 3)];
}
function errorToBlend(p, a, b) {
  const delta = b.map((v, i) => v - a[i]), length = delta.reduce((n,v) => n + v*v, 0);
  const t = length ? Math.max(0, Math.min(1, delta.reduce((n,v,i) => n + (p[i]-a[i])*v,0) / length)) : 0;
  return Math.max(...p.map((v,i) => Math.abs(v-a[i]-t*delta[i])));
}
async function probe(name, diagonal = false, staticCard = false, iso = false) {
  const positions = await page.evaluate(({ diagonal, staticCard }) => {
    const root = staticCard ? window.__floorStatic.shadowRoot : window.__card.renderRoot;
    const room = root.querySelector('[data-hp="room"][data-id="Alpha"]');
    const matrix = room.getScreenCTM();
    const point = (x, y) => {
      if (diagonal) [x,y] = [500 + (x-y)/Math.SQRT2,500 + (x+y-1000)/Math.SQRT2];
      const p = new DOMPoint(x,y).matrixTransform(matrix); return [p.x,p.y];
    };
    return { a: point(600,687.5), b: point(650,687.5),
      line: Array.from({length:121},(_,i) => point(610+i/4,687.5)),
      center:point(625,687.5), orphanLayer:root.querySelectorAll('.opening-tunnels').length };
  }, { diagonal, staticCard });
  const bytes = await page.screenshot({ fullPage:true }); writeFileSync(`${output}/${name}.png`, bytes);
  const image = PNG.sync.read(bytes), a = pixel(image,positions.a), b = pixel(image,positions.b);
  const errors = positions.line.map(p => errorToBlend(pixel(image,p),a,b));
  if (!iso) check(`${name}: no bright seam or double-alpha band`, Math.max(...errors) <= 7);
  else check(`${name}: floor remains painted inside 2.5D passage`, Math.max(...pixel(image,positions.center)) < 245);
  check(`${name}: no independent colored opening layer`, positions.orphanLayer === 0);
  out[name] = { a,b,maxSeamError:Math.max(...errors) };
}
await seed();
const same = { c:'#203040', a:.35 }, dark = { c:'#111111', a:1 };
const scenarios = [['opaque',dark,dark],['translucent',same,same],
  ['different',{c:'#143d85',a:.45},{c:'#12603b',a:.7}],['one-empty',same,null],['both-empty',null,null]];
for (const [name,a,b] of scenarios) {
  await fills(a,b);
  for (const zoom of [.87,1.23,1.91]) {
    await page.evaluate(zoom => {const c=window.__card; c._zoom=zoom; c._view=null; c.requestUpdate();}, zoom);
    await settle(); await probe(`${name}-${zoom}`);
  }
}
await fills(same,same);
const before = await page.evaluate(() => ({ counters:{...window.__card._floorCacheBuilds},
  cfg:JSON.stringify(window.__card._serverCfg), area:window.__card._spaceModel().rooms.map(r=>window.__card._areaOfRoom?.(r)) }));
await fills({c:'#334477',a:.5},{c:'#889944',a:.6});
await page.evaluate(async () => {
  const c=window.__card; c.hass={...c.hass,states:{...c.hass.states,
    'sensor.floor_paint_tick':{state:'42',attributes:{}}}}; await c.updateComplete;
}); await settle();
const after = await page.evaluate(() => ({...window.__card._floorCacheBuilds}));
check('color and HA ticks do not rebuild floor geometry', after.roomFloorPaint === before.counters.roomFloorPaint
  && after.cleanFloor === before.counters.cleanFloor && after.openingTunnel === before.counters.openingTunnel);
await fills(same,same);
await page.locator('houseplan-card [data-hp="rotate-right"]').click(); await settle();
await probe('quarter-turn');
await seed(true); await fills(same,same); await probe('diagonal',true);
await seed(); await fills(dark,dark);
await page.evaluate(async () => {
  await window.__hpTest.setServerConfig(cfg=>{cfg.settings.volumetric_view=true;});
  await window.__card._ensureIsoSceneRuntime();
}); await settle(); await probe('iso',false,false,true);
await page.evaluate(async () => {
  await window.__hpTest.setServerConfig(cfg=>{cfg.settings.volumetric_view=false;});
  const el=document.createElement('houseplan-space-card');
  el.setConfig({type:'custom:houseplan-space-card',space:'f1',title:'',show_button:false,fit:'house'});
  el.hass=window.__card.hass;
  const host=document.createElement('div');host.style.width='780px';document.body.append(host);host.append(el);
  window.__floorStatic=el;
  const end=performance.now()+10000;while(!el.shadowRoot?.querySelector('[data-hp="room"]')){
    if(performance.now()>end)throw Error('static floor timeout');await new Promise(requestAnimationFrame);
  }
}); await settle(); await probe('static',false,true);
await finish(browser,out);
