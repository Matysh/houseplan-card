// #1077: real card, saved visibility and public ZHA read; no live HA.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { settingsSection } from './helpers/settings-section.mjs';

requirePinnedBrowser('smoke_zigbee_hidden_placement');
const { page, browser } = await launch({ width: 1280, height: 900 });
const artifacts = new URL('../artifacts/zigbee-hidden-1077/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const out = { completed: false }, evidence = {};
const root = page.locator('#host > houseplan-card');
const settings = () => root.locator('hp-zigbee-topology-settings');
const settle = () => page.evaluate(() => window.__hpTest.settled());
const open = async () => {
  await root.locator('[data-hp="settings"]').click();
  await settingsSection(root.locator('hp-dialog[data-kind="settings"]'), 'zigbee');
  await settings().waitFor(); await settle();
};
const close = async () => { await page.keyboard.press('Escape'); await settle(); };
const configSnapshot = () => page.evaluate(async () => {
  await window.__hpTest.waitForWrites();
  const c = window.__card, cfg = await c.hass.callWS({ type: 'houseplan/config/get' });
  const layout = await c.hass.callWS({ type: 'houseplan/layout/get' });
  return JSON.stringify({ config: cfg.config, rev: cfg.rev, layout: layout.layout, lr: layout.rev });
});
const hover = async id => {
  const marker = root.locator('[data-hp="device"][data-id="' + id + '"]');
  await marker.hover();
  // A horizontal SVG line has zero DOM-box height despite a painted stroke.
  await root.locator('hp-zigbee-topology-overlay').locator('[data-hp="zigbee-topology-line"]').waitFor({ state: 'attached' });
  return page.evaluate(() => {
    const c = window.__card, overlay = c.renderRoot.querySelector('hp-zigbee-topology-overlay');
    const lines = [...overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-line"]')];
    return lines.map(line => {
      const p = overlay.shadowRoot.querySelector('svg').getScreenCTM();
      const point = (x,y) => { const q = new DOMPoint(Number(x),Number(y)).matrixTransform(p); return [q.x,q.y]; };
      return { direction: line.dataset.direction, from: point(line.getAttribute('x1'),line.getAttribute('y1')),
        to: point(line.getAttribute('x2'),line.getAttribute('y2')) };
    });
  });
};
try {
  await page.evaluate(async () => {
    const c = window.__card, original = c.hass;
    window.__hiddenZhaReads = 0;
    c.setConfig({ type: 'custom:houseplan-card', language: 'ru' });
    c.hass = { ...original, language: 'ru', user: { ...original.user, is_admin: true },
      callWS: async message => {
        if (message.type === 'config_entries/get') return [
          { entry_id: 'zha-1077', domain: 'zha', title: 'ZHA' },
          { entry_id: 'mqtt-1077', domain: 'mqtt', title: 'MQTT' },
        ];
        if (message.type !== 'zha/devices') return original.callWS(message);
        window.__hiddenZhaReads++;
        return [
          { ieee: '00124b0000000001', nwk: 0, device_reg_id: 'd_light1', device_type: 'Coordinator', name: 'Coordinator', neighbors: [] },
          { ieee: '00124b0000000002', nwk: 2, device_reg_id: 'd_temp', device_type: 'Router', name: 'Hidden radio',
            neighbors: [], routes: [{ dest_nwk: 0, next_hop: 0, route_status: 'Active' }] },
        ];
      } };
    await window.__hpTest.setServerConfig(cfg => {
      cfg.settings = { ...cfg.settings, filter_seeded: true, zigbee_topology: { enabled: true, z2m_base_topics: [] } };
      cfg.markers = cfg.markers.filter(m => !['device:d_light1','device:d_temp'].includes(m.binding));
      cfg.markers.push({ id: 'radio-root', binding: 'device:d_light1', space: c._space, hidden: false },
        { id: 'radio-hidden', binding: 'device:d_temp', space: c._space, hidden: true });
      return cfg;
    });
    await window.__hpTest.setLayout(layout => ({ ...layout,
      'radio-root': { s:c._space,x:.3,y:.35 }, 'radio-hidden': { s:c._space,x:.6,y:.35 } }));
  });
  await settle();
  await open();
  await settings().locator('.hpf-provider').first().locator('.hpf-actions button').click();
  await page.waitForFunction(() => window.__card.renderRoot.querySelector('hp-zigbee-topology-settings')?._snapshot?.states?.zha?.phase === 'ready');
  await settle();
  await settings().locator('#zigbee-visibility-zha summary').click();
  const hiddenText = await settings().locator('#zigbee-visibility-zha .incomplete-text').innerText();
  evidence.hidden = hiddenText;
  out.hiddenHasActionableReason = hiddenText.includes('Hidden radio') && hiddenText.includes('скрыто на плане')
    && hiddenText.includes('кнопкой глаза');
  out.hiddenIsNotMissingOrProviderPartial = await settings().locator('#zigbee-incomplete-zha').count() === 0;
  await page.screenshot({ path: fileURLToPath(new URL('hidden.png',artifacts)) });
  await close();
  const before = await configSnapshot();
  await root.locator('[data-hp="hidden-devices"]').click(); await settle();
  const outgoing = await hover('radio-hidden');
  const incoming = await hover('radio-root');
  out.hiddenOriginOutgoingAndVisibleOriginIncoming = outgoing.length === 1 && incoming.length === 1
    && outgoing[0].direction === 'toward-neighbor' && incoming[0].direction === 'toward-origin';
  const alignment = await page.evaluate(() => {
    const c=window.__card;
    return ['radio-root','radio-hidden'].map(id=>{
      const r=c.renderRoot.querySelector('[data-hp="device"][data-id="'+id+'"]').getBoundingClientRect();
      return [r.x+r.width/2,r.y+r.height/2];
    });
  });
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  out.exactPaintedEndpoints = distance(outgoing[0].from,alignment[1]) < 2 && distance(outgoing[0].to,alignment[0]) < 2;
  await page.screenshot({ path: fileURLToPath(new URL('shown-incoming.png',artifacts)) });
  await open();
  await settings().locator('#zigbee-visibility-zha summary').click();
  const shownText=await settings().locator('#zigbee-visibility-zha .incomplete-text').innerText();
  evidence.shown=shownText;
  out.shownIsReportedHonestly = shownText.includes('сейчас показано') && !shownText.includes('кнопкой глаза')
    && await settings().locator('#zigbee-incomplete-zha').count() === 0;
  await page.setViewportSize({width:390,height:900});
  out.narrowReasonWraps=await settings().locator('#zigbee-visibility-zha .incomplete-text').evaluate(el=>el.scrollWidth<=el.clientWidth+1);
  await page.screenshot({ path: fileURLToPath(new URL('shown-narrow.png',artifacts)) });
  await page.setViewportSize({width:1280,height:900});
  await close();
  await root.locator('[data-hp="hidden-devices"]').click(); await settle();
  out.eyeOffRemovesMarker = await root.locator('[data-hp="device"][data-id="radio-hidden"]').count()===0;
  out.noVisibilityConfigWrite = before === await configSnapshot();
  out.noAutomaticRescan = await page.evaluate(()=>window.__hiddenZhaReads===1);
  await page.evaluate(async()=>{
    await window.__hpTest.setServerConfig(cfg=>{
      cfg.markers=cfg.markers.map(m=>m.id==='radio-root'?{...m,hidden:true}:m);return cfg;
    });
  });
  await settle(); await root.locator('[data-hp="hidden-devices"]').click(); await settle();
  out.hiddenToHiddenDirectLink = (await hover('radio-hidden')).length===1;
  await page.screenshot({ path: fileURLToPath(new URL('hidden-to-hidden.png',artifacts)) });
  evidence.calls=await page.evaluate(()=>window.__hiddenZhaReads);
  out.completed=true;
} catch (error) {
  await page.screenshot({ path: fileURLToPath(new URL('failure.png',artifacts)) });
  evidence.failure = await settings().innerText().catch(()=>'settings unavailable');
  throw error;
} finally {
  writeFileSync(new URL('evidence.json',artifacts),JSON.stringify({out,evidence},null,2));
  checkAll(out); await finish(browser,out);
}

