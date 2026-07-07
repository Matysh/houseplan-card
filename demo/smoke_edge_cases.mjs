import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const mk = () => document.createElement('houseplan-card');
  const sr = (c) => c.shadowRoot || c.renderRoot;

  // 1) пустая инсталляция: ноль устройств/зон, конфиг с пространством без комнат
  const c1 = mk();
  c1.setConfig({ type: 'custom:houseplan-card' });
  document.body.appendChild(c1);
  c1.hass = { language:'en', locale:{language:'en'}, devices:{}, entities:{}, areas:{}, states:{},
    callWS: async (m) => m.type==='houseplan/config/get'
      ? { config:{ spaces:[{ id:'s1', title:'Empty', plan_url:null, aspect:1.4, view_box:[0,0,1,1], rooms:[], segments:[] }], markers:[], settings:{} }, rev:1 }
      : { layout:{} },
    connection:{ subscribeEvents: async()=>()=>{} } };
  await new Promise(r=>setTimeout(r,150));
  c1.hass = { ...c1.hass };
  await c1.updateComplete; await new Promise(r=>setTimeout(r,50)); await c1.updateComplete;
  out.emptyDevices = c1._devices.length;
  out.emptyRenders = !!sr(c1).querySelector('.stage');
  out.emptyCount = sr(c1).querySelector('.count')?.textContent.trim();
  c1.remove();

  // 2) XSS в именах комнат и устройств
  const c2 = mk();
  c2.setConfig({ type: 'custom:houseplan-card' });
  document.body.appendChild(c2);
  const evil = '<img src=x onerror=window.__pwned=1><b>bold</b>';
  c2.hass = { language:'en', locale:{language:'en'},
    devices:{ d1:{ id:'d1', name: evil, model:'M<script>1</script>', area_id:'a1', identifiers:[['x','1']] } },
    entities:{}, areas:{ a1:{ area_id:'a1', name:'A1' } }, states:{},
    callWS: async (m) => m.type==='houseplan/config/get'
      ? { config:{ spaces:[{ id:'s1', title:'S', plan_url:null, aspect:1, view_box:[0,0,1,1],
          rooms:[{ id:'r1', name: evil, area:'a1', poly:[[0.1,0.1],[0.9,0.1],[0.9,0.9],[0.1,0.9]] }], segments:[] }], markers:[], settings:{} }, rev:1 }
      : { layout:{} },
    connection:{ subscribeEvents: async()=>()=>{} } };
  await new Promise(r=>setTimeout(r,150));
  c2.hass = { ...c2.hass };
  await c2.updateComplete; await new Promise(r=>setTimeout(r,50)); await c2.updateComplete;
  out.xssPwned = !!window.__pwned;
  const lbl = sr(c2).querySelector('.roomlabel');
  out.xssLabelIsText = lbl ? lbl.innerHTML.includes('&lt;img') || lbl.textContent.includes('<img') : 'no label';
  out.xssDeviceRendered = sr(c2).querySelectorAll('.dev').length;
  c2.remove();

  // 3) легаси-записи layout v1 {x,y} без ключа s — игнорируются в norm-режиме
  const c = window.__card;
  c._layout = { ...c._layout, d_light1_legacy_test: { x: 500, y: 300 } };
  const fake = { id: 'd_light1_legacy_test', space: 'f1' };
  const p = c._pos(fake);
  out.legacyIgnored = p.y !== 300; // centre y=400 if ignored; raw 300 would mean it leaked through
  delete c._layout.d_light1_legacy_test;

  // 4) перф: 150 устройств
  const t0 = performance.now();
  const devices = {}; const entities = {}; const states = {};
  for (let i = 0; i < 150; i++) {
    devices['p'+i] = { id:'p'+i, name:'Plug '+i, model:'Smart Plug', area_id:'living_room', identifiers:[['demo','p'+i]] };
    entities['switch.p'+i] = { entity_id:'switch.p'+i, device_id:'p'+i, platform:'demo' };
    states['switch.p'+i] = { state: i%2?'on':'off', attributes:{ linkquality: 50+i } };
  }
  const bigHass = { ...window.__mkHass(), devices:{...window.__mkHass().devices, ...devices},
    entities:{...window.__mkHass().entities, ...entities}, states:{...window.__mkHass().states, ...states} };
  c.hass = bigHass; c._regSignature=''; c._maybeRebuildDevices();
  out.bigBuildMs = Math.round(performance.now() - t0);
  out.bigCount = c._devices.length;
  await c.updateComplete;
  const t1 = performance.now(); c.requestUpdate(); await c.updateComplete;
  out.bigRenderMs = Math.round(performance.now() - t1);
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
