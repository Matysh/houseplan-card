// #844: real entry/footer/runtime, a cold bundle and the actual HA transport
// boundary. Only HA responses and network timing are substituted.
import { readFileSync } from 'node:fs';
import { launchColdView, checkAll, finish, requirePinnedBrowser } from './serve.mjs';

requirePinnedBrowser('844 View/editor permission boundary');
const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const runtimePath = manifest.files.map(file => file.path)
  .find(path => /houseplan-editor-runtime-[^/]+\.js$/.test(path));
if (!runtimePath) throw new Error('missing editor chunk');
const runtimeName = runtimePath.split('/').at(-1);
const isEditor = url => new URL(url).pathname.endsWith(`/${runtimeName}`);
const checks = {};
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const runs = section => !only || only === section;

async function fixture({ admin = false, writer = false, kiosk = false, touch = false, showNames = false } = {}) {
  const f = await launchColdView(touch ? { width: 390, height: 760 } : { width: 1000, height: 850 },
    1, [], touch ? { hasTouch: true } : {});
  f.touch = touch;
  await f.page.evaluate(() => window.__hpTest.waitForWrites());
  f.editorRequests = 0;
  f.page.on('request', request => { if (isEditor(request.url())) f.editorRequests++; });
  f.id = await f.page.evaluate(async ({ admin, writer, kiosk, showNames }) => {
    const c = window.__card, original = c.hass;
    window.__844Writer = writer; window.__844Writes = []; window.__844MoreInfo = [];
    c.addEventListener('hass-more-info', event => window.__844MoreInfo.push(event.detail.entityId));
    c.hass = { ...original, user: { ...original.user, is_admin: admin }, callWS: async message => {
      if (message.type === 'houseplan/config/set') {
        window.__844Writes.push(message);
        if (!window.__844Writer) throw Object.assign(new Error('unauthorized'), { code: 'unauthorized' });
      }
      const response = await original.callWS(message);
      if (message.type === 'houseplan/config/set') window.__844Config = message.config;
      return message.type === 'houseplan/config/get'
        ? { ...response, config: window.__844Config ?? response.config, can_write: window.__844Writer } : response;
    } };
    if (kiosk) c.setConfig({ ...c._config, kiosk: true });
    const device = c._devices.find(d => !d.virtual && d.primary && !d.primary.startsWith('light.')
      && !d.tapAction && !d.marker?.controls?.length);
    if (!device) throw new Error('missing device fixture');
    const next = { ...c._serverCfg,
      spaces: c._serverCfg.spaces.map(s => ({ ...s, settings: { ...s.settings, show_names: showNames } })),
      settings: { ...c._serverCfg.settings,
        known_devices: c._devices.filter(d => !d.marker && !d.virtual).map(d => d.id).sort(),
        new_device_ids: [device.id] } };
    window.__844Config = next;
    await window.__hpTest.setServerConfig(next);
    await window.__hpTest.waitForWrites();
    window.__844DeviceId = device.id;
    window.__844Writes = [];
    c.requestUpdate(); await c.updateComplete;
    return device.id;
  }, { admin, writer, kiosk, showNames });
  return f;
}

async function openInfo(f) {
  const target = f.page.locator(`[data-hp="device"][data-id="${f.id}"]`);
  if (f.touch) {
    await target.tap(); // the plain device's default action is its information card
  } else {
    await target.hover(); await f.page.mouse.down();
    await f.page.waitForTimeout(700); await f.page.mouse.up();
  }
  await f.page.locator('hp-dialog[data-kind="info"]').waitFor();
}

async function snapshot(page) {
  return page.evaluate(() => {
    const c = window.__card, root = c.renderRoot;
    const footer = [...root.querySelectorAll('.infofooter button')];
    return { edit: footer.some(b => b.textContent.includes(c._t('btn.edit'))),
      open: footer.some(b => b.textContent.includes(c._t('btn.open_in_ha'))),
      close: footer.some(b => b.textContent.includes(c._t('btn.close'))),
      targetSizes: footer.map(b => { const r = b.getBoundingClientRect(); return [r.width, r.height]; }),
      runtime: !!c._editorRuntime, dialog: !!c._markerDialog,
      writes: window.__844Writes.length,
      newFlag: (c._serverCfg.settings.new_device_ids || []).includes(window.__844DeviceId) };
  });
}

async function pressEdit(f) {
  const button = f.page.locator('.infofooter button').filter({ hasText: 'Edit' });
  await (f.touch ? button.tap() : button.click());
}

for (const role of [
  { name: 'admin', admin: true, writer: true },
  { name: 'writer', writer: true },
  { name: 'nonwriter' },
  { name: 'admin-nonwriter', admin: true },
  { name: 'kiosk-admin', admin: true, writer: true, kiosk: true },
  { name: 'kiosk-readonly', kiosk: true },
  { name: 'touch-readonly', touch: true },
  { name: 'touch-writer', writer: true, touch: true },
  { name: 'touch-kiosk-admin', admin: true, writer: true, kiosk: true, touch: true },
]) {
  if (!runs('roles') && !(only === 'touch' && role.touch)) continue;
  const f = await fixture(role);
  try {
    await openInfo(f);
    const before = await snapshot(f.page), allowed = !!role.writer && !role.kiosk;
    checks[`${role.name}:footer-matrix`] = before.edit === allowed && before.open && before.close;
    checks[`${role.name}:touch-targets`] = before.targetSizes.every(([w, h]) => w >= 44 && h >= 44);
    checks[`${role.name}:information-does-not-ack`] = before.newFlag && before.writes === 0
      && !before.runtime && f.editorRequests === 0;
    if (!allowed) {
      await f.page.evaluate(() => {
        const c = window.__card;
        c._ackNewDevice(window.__844DeviceId); // private-ok: #844 AC4 tests acknowledgement authority independently of both entry guards
        c._openMarkerDialog(c._devices.find(d => d.id === window.__844DeviceId)); // private-ok: #844 AC2 must exercise the hidden/direct entrance independently of the footer
      });
      await f.page.waitForTimeout(400);
      const refused = await snapshot(f.page);
      checks[`${role.name}:direct-entry-refused`] = !refused.dialog && !refused.runtime
        && refused.writes === 0 && refused.newFlag && f.editorRequests === 0;
      // Clean up a defective old-code entry so the remaining independent
      // assertions still run and report the original user-visible failures.
      if (refused.dialog) await f.page.evaluate(() => window.__hpTest.close());
      const moreInfo = f.page.locator('.infofooter button').filter({ hasText: 'Open in HA' });
      await (f.touch ? moreInfo.tap() : moreInfo.click());
      checks[`${role.name}:more-info-preserved`] = await f.page.evaluate(() => window.__844MoreInfo.length === 1);
    } else {
      await pressEdit(f);
      await f.page.waitForFunction(() => !!window.__card._markerDialog);
      await f.page.waitForFunction(() => window.__844Writes.length === 1);
      const opened = await snapshot(f.page);
      checks[`${role.name}:allowed-entry-acks-once`] = opened.dialog && opened.runtime
        && opened.writes === 1 && !opened.newFlag && f.editorRequests === 1;
      await f.page.evaluate(() => window.__hpTest.close());
      await openInfo(f); await pressEdit(f);
      await f.page.waitForFunction(() => !!window.__card._markerDialog);
      await f.page.waitForTimeout(400);
      checks[`${role.name}:second-entry-does-not-ack-again`] = (await snapshot(f.page)).writes === 1;
    }
  } finally { await f.browser.close(); }
}

// Unknown can_write uses the existing fail-closed HA-admin fallback. This
// executes the card getter/template, not an equivalent formula in the test.
for (const admin of [false, true]) {
  if (!runs('unknown')) continue;
  const f = await fixture({ admin, writer: true });
  try {
    await openInfo(f);
    await f.page.evaluate(async () => { const c = window.__card;
      c._serverCanWrite = null; // private-ok: #844 inject the pre-response ACL state; the facade cannot suspend only can_write
      c.requestUpdate(); await c.updateComplete; });
    checks[`unknown-write:${admin}:fallback`] = (await snapshot(f.page)).edit === admin;
  } finally { await f.browser.close(); }
}

// Real delayed import: changing permission/kiosk, newer intent and disconnect
// cannot open the original request after the chunk finishes.
for (const revoke of ['writer', 'kiosk', 'disconnect', 'newer']) {
  if (!runs('late') && only !== `late-${revoke}`) continue;
  const f = await fixture({ writer: true });
  try {
    let release, entered;
    const started = new Promise(resolve => { entered = resolve; });
    await f.page.route(`**/${runtimeName}*`, async route => {
      entered(); await new Promise(resolve => { release = resolve; });
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(`demo/srv/assets/${runtimePath}`) });
    });
    await openInfo(f); await pressEdit(f); await started;
    await f.page.evaluate(async revoke => {
      const c = window.__card;
      if (revoke === 'writer') { window.__844Writer = false; await window.__hpTest.setServerConfig(window.__844Config); }
      if (revoke === 'kiosk') c.setConfig({ ...c._config, kiosk: true });
      if (revoke === 'disconnect') { window.__844Parent = c.parentNode; c.remove(); }
      if (revoke === 'newer') {
        window.__844NewerId = c._devices.find(d => d.id !== window.__844DeviceId).id;
        c._openMarkerDialog(c._devices.find(d => d.id === window.__844NewerId)); // private-ok: #844 inject a competing entry while the actual lazy import is held
      }
      await c.updateComplete;
    }, revoke);
    release();
    await f.page.waitForFunction(() => window.__card._editorRuntimeLoader.state === 'ready');
    await f.page.waitForTimeout(400);
    const result = await f.page.evaluate(() => ({ dialog: window.__card._markerDialog?.devId ?? null,
      writes: window.__844Writes.length, newFlag: (window.__card._serverCfg.settings.new_device_ids || []).includes(window.__844DeviceId) }));
    console.log('late-result', revoke, result);
    checks[`late:${revoke}:old-intent-refused`] = result.newFlag && result.writes === 0
      && (revoke === 'newer'
        ? result.dialog === await f.page.evaluate(() => window.__844NewerId) : result.dialog === null);
    if (revoke !== 'newer') {
      await f.page.evaluate(async () => {
        const c = window.__card;
        if (!c.isConnected) window.__844Parent.appendChild(c);
        c.setConfig({ ...c._config, kiosk: false }); window.__844Writer = true;
        await c.updateComplete;
      });
      await f.page.waitForFunction(() => window.__card._loadOk && !window.__card._loading);
      if (revoke === 'writer') await f.page.evaluate(() => window.__hpTest.setServerConfig(window.__844Config));
      await openInfo(f); await pressEdit(f);
      await f.page.waitForFunction(() => window.__card._markerDialog?.devId === window.__844DeviceId);
      checks[`late:${revoke}:fresh-intent-works`] = true;
    }
  } finally { await f.browser.close(); }
}

// Revive the genuine warm dialog snapshot in View against a denied port. The
// normal permitted remount is covered by smoke_warm_dialogs as well.
for (const kiosk of [false, true]) {
  if (!runs('warm')) continue;
  const f = await fixture({ writer: true });
  try {
    await openInfo(f); await pressEdit(f);
    await f.page.waitForFunction(() => !!window.__card._markerDialog);
    await f.page.waitForFunction(() => window.__844Writes.length === 1);
    const revived = await f.page.evaluate(async kiosk => {
      const c = window.__card, data = c._warmDialogState();
      c._serverCanWrite = false; // private-ok: #844 inject denial while a View-created dialog is retained in memory
      c.requestUpdate(); await c.updateComplete;
      const hidden = !c.renderRoot.querySelector('hp-dialog[data-kind="marker"]');
      c._markerDialog = null; // private-ok: #844 warm-restore fault injection after a genuine UI-created draft; this is not form input
      c._serverCanWrite = false; // private-ok: #844 inject denial at the warm-restore boundary, no facade operation owns this boundary
      if (kiosk) c.setConfig({ ...c._config, kiosk: true });
      c._warmSlot.dlg = data; // private-ok: #844 seed the genuine saved dialog at the warm-restore boundary
      c._warmSlot.freed = Date.now(); // private-ok: #844 simulate a just-detached owner at the warm-restore boundary
      window.__844Writes = []; c._warmReviveDialog(); // private-ok: #844 execute the production restore against the denied port
      c.requestUpdate(); await c.updateComplete;
      return hidden && !c._markerDialog && !c.renderRoot.querySelector('hp-dialog[data-kind="marker"]')
        && c._warmSlot.dlg === null && window.__844Writes.length === 0;
    }, kiosk);
    checks[`warm:${kiosk}:forbidden-dialog-not-revived`] = revived;
  } finally { await f.browser.close(); }
}

for (const role of [{ name: 'admin', admin: true, writer: true },
  { name: 'writer', writer: true }, { name: 'readonly' },
  { name: 'kiosk', admin: true, writer: true, kiosk: true }]) {
  if (!runs('area')) continue;
  const f = await fixture({ ...role, showNames: true });
  try {
    for (const mode of ['view', 'devices', 'decor', 'plan']) {
      if (mode !== 'view' && (!role.writer || role.kiosk)) continue;
      if (mode !== 'view') {
        await f.page.evaluate(mode => window.__hpTest.setMode(mode), mode);
        await f.page.waitForFunction(mode => window.__card._mode === mode && !window.__card._modeTransitionBusy, mode);
      }
      const result = await f.page.evaluate(async mode => {
        const c = window.__card, r = c._spaceModel().rooms.find(r => r.name && r.area);
        if (!r) throw new Error('missing room');
        const label = [...c.renderRoot.querySelectorAll('.roomlabel')].find(l => l.dataset.id === r.id);
        const icon = label?.querySelector('.rlgo');
        const old = history.pushState; let navigations = 0;
        history.pushState = () => { navigations++; };
        try { icon?.click(); c._clickRoom(r); } finally { history.pushState = old; }
        const b = icon?.getBoundingClientRect();
        return { visible: !!icon, title: icon?.getAttribute('title') ?? '', navigations,
          id: r.id, layout: c._layout[`rl_${r.id}`] ?? null,
          point: b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null };
      }, mode);
      const visible = !role.kiosk && (role.admin || mode === 'plan');
      checks[`area:${role.name}:${mode}:visibility`] = result.visible === !!visible;
      checks[`area:${role.name}:${mode}:navigation`] = result.navigations === (role.admin && !role.kiosk && mode !== 'plan' ? 2 : 0);
      if (mode === 'plan') {
        checks[`area:${role.name}:plan-no-link-title`] = result.title === '';
        if (result.point) {
          await f.page.mouse.move(result.point.x, result.point.y); await f.page.mouse.down();
          await f.page.mouse.move(result.point.x + 24, result.point.y + 16, { steps: 4 }); await f.page.mouse.up();
          checks[`area:${role.name}:plan-icon-drags`] = await f.page.evaluate(({ id, layout }) => {
            const after = window.__card._layout[`rl_${id}`];
            return !!after && (!layout || after.x !== layout.x || after.y !== layout.y);
          }, result);
        } else checks[`area:${role.name}:plan-icon-drags`] = false;
      }
    }
  } finally { await f.browser.close(); }
}

// A kiosk writer still participates in automatic registry lifecycle writes.
if (runs('lifecycle')) {
const lifecycle = await fixture({ writer: true, admin: true, kiosk: true });
try {
  checks['kiosk-writer:lifecycle-new-device-preserved'] = await lifecycle.page.evaluate(async () => {
    const c = window.__card, h = c.hass;
    c.hass = { ...h, devices: { ...h.devices, d_844: { id: 'd_844', name: 'New plug', model: 'Plug', area_id: 'kitchen', identifiers: [['demo', 'd_844']] } },
      entities: { ...h.entities, 'switch.new844': { entity_id: 'switch.new844', device_id: 'd_844', platform: 'demo' } },
      states: { ...h.states, 'switch.new844': { state: 'off', attributes: { friendly_name: 'New plug' } } } };
    await c.updateComplete; c.requestUpdate(); await c.updateComplete;
    return c._serverCfg.settings.new_device_ids?.includes('d_844');
  });
} finally { await lifecycle.browser.close(); }
}

checkAll(checks);
await finish(null, checks);
