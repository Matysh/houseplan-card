/**
 * #805 AC4(б): computed-style equivalence of two bundles across the editor surfaces.
 *
 * Moving editor-only rules into a sheet adopted after the eager `dialogs`
 * sheet can flip the winner between two equally weighted rules. The rule
 * multiset (`scripts/dev/styles-diff.mjs`) cannot see that; this script can.
 * It opens the same surfaces in two pages — the bundle of THIS tree and the
 * bundle of a base tree — and compares every computed property (custom
 * properties included) of every element of the card's shadow root, of the
 * card host and of nested `hp-device-preview` roots, which carry their own
 * `cardStyles`.
 *
 *   npm run bundle:sync                       # this tree → demo/srv/assets
 *   (cd <base> && npm run bundle:sync)        # base tree, e.g. a worktree of dev
 *   node scripts/dev/editor-styles-equivalence.mjs --base <base> [--surfaces a,b] [--combos 1100-dark,360-light]
 *
 * Exit 0 only when no element differs. Each run prints per surface the number
 * of compared elements and the differing ones with their properties.
 *
 * Phase `warm` (editor runtime preloaded, as every editor surface sees it): all
 * AC3 surface families plus View after the editor, at 1100 px and 360 px, light
 * and dark. Phase `cold` (no editor runtime): View, a static space card and the
 * onboarding form. By design the cold host no longer defines the tray's
 * `--hp-editor-tray-*` (contract p. 6); those inherited custom properties are
 * the only properties the cold phase ignores.
 */
import { resolve } from 'node:path';
import { launch, launchColdView } from '../../demo/serve.mjs';

const argv = process.argv.slice(2);
const arg = (name) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 ? argv[at + 1] : undefined;
};
const baseRoot = arg('base') && resolve(arg('base'));
if (!baseRoot) {
  console.error('usage: node scripts/dev/editor-styles-equivalence.mjs --base <tree> [--surfaces a,b] [--combos 1100-dark]');
  process.exit(2);
}
const only = arg('surfaces')?.split(',');
const combos = (arg('combos')?.split(',') || ['1100-dark', '1100-light', '360-dark', '360-light']).map((name) => {
  const [width, theme] = name.split('-');
  return { name, theme, viewport: { width: Number(width), height: Number(width) > 600 ? 900 : 780 } };
});
const context = { locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce' };

/* ---- page-side helpers (serialised into each page) ---------------------- */

const PAGE_HELPERS = String.raw`
window.__hpEq = {
  async settle(c) {
    for (let i = 0; i < 4; i++) {
      c.requestUpdate();
      await c.updateComplete;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    await new Promise((r) => setTimeout(r, 400));
    await document.fonts?.ready;
  },
  hash(text) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
  },
  styleOf(el, ignore) {
    const cs = getComputedStyle(el);
    const parts = [];
    for (let i = 0; i < cs.length; i++) {
      const p = cs[i];
      if (ignore && ignore.test(p)) continue;
      parts.push(p + ':' + cs.getPropertyValue(p));
    }
    return parts.sort().join(';');
  },
  collect(hosts) {
    const els = [];
    const keys = [];
    const visit = (root, prefix) => {
      for (const el of root.querySelectorAll('*')) {
        els.push(el);
        keys.push(prefix + el.localName + (el.classList.length ? '.' + [...el.classList].join('.') : ''));
        if (el.localName === 'hp-device-preview' && el.shadowRoot) visit(el.shadowRoot, prefix + 'hp-device-preview>');
      }
    };
    for (const [label, host] of hosts) {
      els.push(host); keys.push(label);
      visit(host.shadowRoot || host.renderRoot, label + '>');
    }
    window.__hpEqEls = els;
    return keys;
  },
  snapshot(hosts, ignoreSource) {
    const ignore = ignoreSource ? new RegExp(ignoreSource) : null;
    const keys = this.collect(hosts);
    return keys.map((key, i) => [key, this.hash(this.styleOf(window.__hpEqEls[i], ignore))]);
  },
  detail(indices, ignoreSource) {
    const ignore = ignoreSource ? new RegExp(ignoreSource) : null;
    return indices.map((i) => this.styleOf(window.__hpEqEls[i], ignore));
  },
  reset(c) {
    for (const k of ['_settingsDialog', '_supportDialog', '_rulesDialog', '_backupExportDialog',
      '_backupImportDialog', '_deviceInbox', '_markerDialog', '_roomDialog', '_alignDialog',
      '_wallDialog', '_vacFit', '_vacCalConfirm', '_mergeDialog', '_openingDialog']) {
      if (k in c) c[k] = null;
    }
    c._tool = 'select'; c._decorTool = 'select'; c._furnPalette = null; c._decorImagePalette = null;
    c._setMode('view');
  },
};`;

/** Surfaces: the AC3 families of #805, each opened through the product path. */
const WARM_SURFACES = {
  view: { expect: '.stage', run: `c._setMode('view');` },
  plan: { expect: '.stage.mode-plan', run: `c._setMode('plan');` },
  planDrawTray: { expect: '.editor-secondary-host.open .drawwall', run: `c._setMode('plan'); c._tool = 'draw';` },
  devices: { expect: '.stage.mode-devices', run: `c._setMode('devices');` },
  decor: { expect: '.stage.mode-decor', run: `c._setMode('decor');` },
  furniturePalette: { expect: '.furnpalette', run: `c._setMode('decor'); c._decorTool = 'furniture'; c._furnPalette = null;` },
  imagePalette: { expect: '.imagepalette', run: `
    c._setMode('decor'); c._haDecorAssetsApi = 1;
    c._decorAssetCatalog = [{ asset_id: 'eq-asset', name: 'eq.svg', mime: 'image/svg+xml', width: 100, height: 100,
      bytes: 100, url: '/api/houseplan/content/assets/_/eq-asset.svg', used_by: [] }];
    await __hpEq.settle(c);
    root.querySelector('[data-editor-palette="image"]')?.click();` },
  settings: { expect: 'hp-dialog .hpf-card', run: `c._setMode('plan'); c._openSettingsDialog();` },
  supportForm: { expect: '.supportform', run: `c._haIntegrationVersion = c._haIntegrationVersion || '0'; c._haSupportApi = 1; c._openSupportDialog();` },
  supportPreview: { expect: '.supportpreview', run: `
    c._haSupportApi = 1; c._openSupportDialog(); await __hpEq.settle(c);
    const text = '{"format":"houseplan-support-package","version":1}\\n';
    c._supportDialog = { ...c._supportDialog, contact: 'user@example.test', message: 'Eq', attach: true,
      status: 'ready', preview: { token: 'a'.repeat(48), expiresAt: 4102444800000, size: text.length,
        sha256: 'b'.repeat(64), spaces: 2, format: 'houseplan-support-package', version: 1, text, preparedAt: 0 } };` },
  rules: { expect: 'hp-dialog .rtest, hp-dialog .rulerow, hp-dialog .body', run: `c._setMode('devices'); c._openRulesDialog();` },
  backupExport: { expect: 'hp-dialog .backupwarn', run: `c._openBackupExport();` },
  backupExportPlanOnly: { expect: 'hp-dialog .backupplanonly', run: `c._openBackupExport(); c._backupExportDialog = { ...c._backupExportDialog, kind: 'space', planOnly: true };` },
  backupImport: { expect: 'hp-dialog .backupdetails', run: `
    c._backupImportDialog = { filename: 'houseplan-space-ground.json', size: 12345, token: 'eq-token',
      preview: { kind: 'space', plan_only: true, source: 'same', created_at: '2026-08-11T10:00:00Z',
        space_title: 'Ground (2)', counts: { spaces: 1, rooms: 4, markers: 0, layout: 4 }, duplicates: 2,
        repaired_target_refs: 3, preserved_unresolved_refs: 1,
        reference_report: { remapped: { incoming: { 'layout.space': 4 }, target: { 'marker.space': 3 } },
          collisions: {}, preservedUnresolved: { 'marker.room_id': 1 }, droppedIncomingLinks: {}, boundedLineages: 0,
          examples: [{ bucket: 'preservedUnresolved', category: 'marker.room_id', owner: 'eq', reference: 'room_old' }] },
        confirmation_required: true,
        content: [{ url: '/api/houseplan/content/plans/_/ground.svg', state: 'detach_required' }] },
      expectedConfigRev: 1, expectedLayoutRev: 1, duplicatePolicy: 'skip', confirmMissing: false, busy: false, error: '' };` },
  deviceInbox: { expect: '.device-inbox-row', run: `c._setMode('devices'); await __hpEq.settle(c); c._openDeviceInbox();` },
  deviceDialog: { expect: 'hp-dialog hp-device-preview', run: `c._setMode('devices'); await __hpEq.settle(c); c._openMarkerDialog(c._devices[0]);` },
  vacuumDialog: { expect: 'hp-dialog .vacdiag', run: `c._setMode('devices'); await __hpEq.settle(c);
    c._openMarkerDialog(c._devices.find((d) => d.id === 'e_vacuum_robo'));` },
  radarDialog: { expect: 'hp-dialog .radargroup', run: `c._setMode('devices'); await __hpEq.settle(c);
    c._openMarkerDialog(c._devices.find((d) => d.id === 'd_lamp') || c._devices.find((d) => d.bindingKind !== 'virtual'));
    await __hpEq.settle(c); root.querySelector('#marker-radar-presence')?.click();` },
  radarWizard: { expect: '.radarsetup', run: `c._setMode('devices'); await __hpEq.settle(c);
    const dev = c._devices.find((d) => d.id === 'd_lamp') || c._devices.find((d) => d.bindingKind !== 'virtual');
    c._openMarkerDialog(dev); await __hpEq.settle(c);
    root.querySelector('#marker-radar-presence')?.click(); await __hpEq.settle(c);
    const room = c._spaceModelById(dev.space)?.rooms?.[0];
    const binary = Object.keys(c._planHass.states || {}).find((id) => id.startsWith('binary_sensor.'));
    c._markerDialog = { ...c._markerDialog, radar: { ...c._markerDialog.radar, profile: 'presence_v1',
      roomId: room?.id || '', occupancyEntity: binary || '' } };
    await __hpEq.settle(c);
    root.querySelector('.radargroup button ha-icon[icon="mdi:map-marker-radius"]')?.closest('button')?.click();` },
  vacuumFit: { expect: '.vacfit', run: `c._setMode('devices'); await __hpEq.settle(c);
    c._vacStartFit(c._devices.find((d) => d.id === 'e_vacuum_robo'));` },
  roomDialog: { expect: 'hp-dialog.roomdialog', run: `c._setMode('plan'); await __hpEq.settle(c); c._openRoomEdit(c._spaceModel().rooms[0]);` },
  wallThickness: { expect: '.wallthick-dlg', run: `c._setMode('plan'); c._tool = 'wallthick'; await __hpEq.settle(c);
    const poly = c._spaceModel().rooms[0].poly || c._spaceModel().rooms[0].points;
    const a = poly[0], b = poly[1];
    c._wallThickClick([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);` },
  optimize: { expect: 'hp-dialog .optimize-live, hp-dialog .body', run: `c._setMode('plan'); await __hpEq.settle(c); c._editorRuntime.optimizePlans.open();` },
};

/** Shared fixture additions, identical on both pages: a live vacuum with a map. */
const WARM_SETUP = `
  c.hass = { ...c.hass,
    entities: { ...c.hass.entities,
      'vacuum.robo': { entity_id: 'vacuum.robo', platform: 'demo', disabled_by: null },
      'camera.robo_map': { entity_id: 'camera.robo_map', platform: 'demo', disabled_by: null } },
    states: { ...c.hass.states,
      'vacuum.robo': { state: 'docked', attributes: { friendly_name: 'Robot' } },
      'camera.robo_map': { state: 'idle', attributes: { vacuum_position: { x: 500, y: 500, a: 0 }, map_name: 'm2',
        rooms: { 1: { name: 'Kitchen', x0: 0, y0: 0, x1: 1000, y1: 800 }, 2: { name: 'Hall', x0: 0, y0: 800, x1: 1000, y1: 2000 } } } } } };
  const cfg = c._serverCfg;
  cfg.markers = cfg.markers || [];
  if (!cfg.markers.some((m) => m.id === 'e_vacuum_robo')) {
    cfg.markers.push({ id: 'e_vacuum_robo', binding: 'entity:vacuum.robo', space: 'f1',
      vacuum: { source: 'camera.robo_map', calibration: { m1: [0.5, 0, 0, 0, 0.5, 0] } } });
    c._layout['e_vacuum_robo'] = { s: 'f1', x: 0.1, y: 0.1 };
  }
  c._regSignature = ''; c._setMode('view');`;

const COLD_SURFACES = {
  coldView: { hosts: 'card', expect: '.stage', run: `c._setMode('view');` },
  spaceCard: {
    hosts: 'space', expect: '.hp-static-stage, .stage',
    run: `const host = document.createElement('div'); document.body.appendChild(host);
      const el = document.createElement('houseplan-space-card'); el.id = 'hp-eq-space';
      el.setConfig({ type: 'custom:houseplan-space-card', space: c._space });
      el.hass = c.hass; host.appendChild(el); await el.updateComplete;
      await new Promise((r) => setTimeout(r, 600));`,
  },
  onboarding: {
    hosts: 'card', expect: 'hp-dialog .hpf-card',
    run: `c._onboardingShown = false; c._serverCfg = { ...c._serverCfg, spaces: [] }; c._model = [];
      c.hass = { ...c.hass, floors: {}, areas: {} };
      for (let i = 0; i < 60 && !(c._onboardingRuntime && root.querySelector('hp-dialog')); i++) {
        await __hpEq.settle(c);
      }`,
  },
};

const THEME_VARS = {
  dark: {
    '--primary-color': '#3ea6ff', '--primary-text-color': '#e6e7eb', '--secondary-text-color': '#9aa4ad',
    '--card-background-color': '#202126', '--ha-card-background': '#202126', '--divider-color': '#3a3d45',
  },
  light: {
    '--primary-color': '#0b73b8', '--primary-text-color': '#202124', '--secondary-text-color': '#5f6368',
    '--card-background-color': '#ffffff', '--ha-card-background': '#ffffff', '--divider-color': '#d7d9de',
  },
};

async function applyCombo(page, combo) {
  await page.setViewportSize(combo.viewport);
  await page.emulateMedia({ colorScheme: combo.theme, reducedMotion: 'reduce' });
  await page.evaluate(async ({ theme, vars }) => {
    for (const [name, value] of Object.entries(vars)) document.documentElement.style.setProperty(name, value);
    document.documentElement.style.colorScheme = theme;
    const c = window.__card;
    c.hass = { ...c.hass, themes: { ...(c.hass.themes || {}), darkMode: theme === 'dark' } };
    await window.__hpEq.settle(c);
  }, { theme: combo.theme, vars: THEME_VARS[combo.theme] });
}

const hostsExpr = (kind) => (kind === 'space'
  ? `[['space-card', document.querySelector('#hp-eq-space')]]`
  : `[['card', window.__card]]`);

async function openAndSnapshot(page, code, hostsKind, ignore, expect) {
  return page.evaluate(async ({ body, hosts, ignoreSource, expectSelector }) => {
    const c = window.__card;
    const root = c.renderRoot;
    // eslint-disable-next-line no-new-func
    const run = new Function('c', 'root', '__hpEq', `return (async () => { ${body} })();`);
    let error = null;
    try { await run(c, root, window.__hpEq); } catch (e) { error = String(e?.message || e); }
    await window.__hpEq.settle(c);
    // eslint-disable-next-line no-new-func
    const hostList = new Function(`return ${hosts};`)();
    const shown = !expectSelector || hostList.some(([, host]) => (host.shadowRoot || host.renderRoot)
      ?.querySelector(expectSelector));
    const pairs = window.__hpEq.snapshot(hostList, ignoreSource);
    return { error, pairs, shown };
  }, { body: code, hosts: hostsExpr(hostsKind), ignoreSource: ignore, expectSelector: expect || null });
}

const diffProps = (a, b) => {
  const map = (text) => new Map(text.split(';').filter(Boolean).map((part) => {
    const at = part.indexOf(':');
    return [part.slice(0, at), part.slice(at + 1)];
  }));
  const A = map(a), B = map(b);
  const out = [];
  for (const key of new Set([...A.keys(), ...B.keys()])) {
    if (A.get(key) !== B.get(key)) out.push(`${key}: ${A.get(key) ?? '∅'} → ${B.get(key) ?? '∅'}`);
  }
  return out;
};

async function compare(pages, label, code, hostsKind, ignore, report, expect) {
  const [base, head] = await Promise.all(pages.map((page) => openAndSnapshot(page, code, hostsKind, ignore, expect)));
  const entry = {
    surface: label, elements: head.pairs.length, differing: [], errors: [base.error, head.error],
    opened: base.shown && head.shown,
  };
  if (base.pairs.length !== head.pairs.length
      || base.pairs.some(([key], i) => key !== head.pairs[i][0])) {
    entry.differing.push({ structural: true, base: base.pairs.length, head: head.pairs.length });
  } else {
    const indices = head.pairs.flatMap(([, hash], i) => (hash === base.pairs[i][1] ? [] : [i]));
    if (indices.length) {
      const [bd, hd] = await Promise.all(pages.map((page) => page.evaluate(
        ({ list, ignoreSource }) => window.__hpEq.detail(list, ignoreSource), { list: indices, ignoreSource: ignore },
      )));
      indices.forEach((index, n) => entry.differing.push({ element: head.pairs[index][0], props: diffProps(bd[n], hd[n]) }));
    }
  }
  report.push(entry);
  const mark = entry.differing.length ? 'DIFF' : entry.opened ? 'ok  ' : 'MISS';
  const errors = entry.errors.filter(Boolean);
  console.log(`${mark} ${label.padEnd(36)} ${String(entry.elements).padStart(5)} elements, ${entry.differing.length} differ`
    + (errors.length ? `  (opener error: ${errors.join(' | ')})` : ''));
  for (const diff of entry.differing.slice(0, 20)) {
    console.log(`       ${diff.structural ? `structure differs: ${diff.base} vs ${diff.head} elements` : `${diff.element}: ${diff.props.slice(0, 8).join(' | ')}`}`);
  }
}

const report = [];
const sessions = [];
try {
  // ---- warm phase: the editor runtime is installed, as for every editor surface
  for (const combo of combos) {
    const warm = await Promise.all([
      launch(combo.viewport, 1, [], { ...context, colorScheme: combo.theme }, resolve(baseRoot, 'demo/srv'), baseRoot),
      launch(combo.viewport, 1, [], { ...context, colorScheme: combo.theme }),
    ]);
    sessions.push(...warm);
    const pages = warm.map((session) => session.page);
    for (const page of pages) {
      await page.addScriptTag({ content: PAGE_HELPERS });
      await page.evaluate(async (setup) => {
        const c = window.__card;
        // eslint-disable-next-line no-new-func
        await new Function('c', `return (async () => { ${setup} })();`)(c);
        await window.__hpEq.settle(c);
      }, WARM_SETUP);
      await applyCombo(page, combo);
    }
    for (const [name, surface] of Object.entries(WARM_SURFACES)) {
      if (only && !only.includes(name)) continue;
      await compare(pages, `${combo.name} ${name}`, surface.run, 'card', null, report, surface.expect);
      await Promise.all(pages.map((page) => page.evaluate(async () => {
        window.__hpEq.reset(window.__card);
        await window.__hpEq.settle(window.__card);
      })));
    }
    await Promise.all(warm.map((session) => session.browser.close()));
    sessions.length = 0;
  }
  // ---- cold phase: no editor runtime; one fresh pair of pages per surface
  for (const combo of combos) {
    for (const [name, surface] of Object.entries(COLD_SURFACES)) {
      if (only && !only.includes(name)) continue;
      const cold = await Promise.all([
        launchColdView(combo.viewport, 1, [], { ...context, colorScheme: combo.theme }, resolve(baseRoot, 'demo/srv'), baseRoot),
        launchColdView(combo.viewport, 1, [], { ...context, colorScheme: combo.theme }),
      ]);
      sessions.push(...cold);
      const pages = cold.map((session) => session.page);
      for (const page of pages) {
        await page.addScriptTag({ content: PAGE_HELPERS });
        await applyCombo(page, combo);
      }
      await compare(pages, `${combo.name} ${name} (cold)`, surface.run, surface.hosts, '^--hp-editor-tray-', report, surface.expect);
      const editorLoaded = await Promise.all(pages.map((page) => page.evaluate(() => !!window.__card._editorRuntime)));
      if (editorLoaded.some(Boolean)) console.log(`       note: editor runtime loaded during cold ${name}: ${editorLoaded}`);
      await Promise.all(cold.map((session) => session.browser.close()));
      sessions.length = 0;
    }
  }
} finally {
  await Promise.all(sessions.map((session) => session.browser.close().catch(() => {})));
}

const outPath = arg('out');
if (outPath) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(outPath, JSON.stringify(report, null, 1));
}
const differing = report.reduce((sum, entry) => sum + entry.differing.length, 0);
const compared = report.reduce((sum, entry) => sum + entry.elements, 0);
const missed = report.filter((entry) => !entry.opened).map((entry) => entry.surface);
console.log(`\n${report.length} surface snapshots, ${compared} element comparisons, ${differing} differing`
  + (missed.length ? `; surface not shown: ${missed.join(', ')}` : ''));
process.exitCode = differing || missed.length ? 1 : 0;
