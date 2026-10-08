// #805: CSS only the editor renders arrives with the lazy editor runtime.
//
// AC2 — a cold View (desktop, 360 px, kiosk card, space card, onboarding) has
// none of the moved dialog rules nor the contextual tray sheet in its shadow
// root, no `--hp-editor-tray-*` on the host and requests no editor chunk.
// AC3 — opening each editor surface family on a cold tab: the control element
// already has its styles in the very first frame it can be painted in (found by
// a MutationObserver, judged once in the flat tree at the update boundary —
// before any task could adopt a sheet — or else in the next animation frame);
// the sheets sit in the canonical cascade slots exactly once, and back in View
// the editor sheets change the computed style of no element.
// AC5 — two cards, warm remount with a revived dialog, disconnect during the
// import, a failed first attempt healed by the content-hashed retry, a module
// of another build. AC7 — opening the editor requests only the editor graph.
import { readFileSync } from 'node:fs';
import { launchColdView, checkAll, finish, requirePinnedBrowser } from './serve.mjs';

const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const runtimePath = manifest.files.map((file) => file.path)
  .find((path) => /houseplan-editor-runtime-[^/]+\.js$/.test(path));
if (!runtimePath) throw new Error('editor runtime is absent from the bundle manifest');
const runtimeName = runtimePath.split('/').at(-1);
const runtimePattern = `**/${runtimeName}*`;
const jsName = (pathname) => pathname.replace(/^\/assets\//, '');
const isJs = (pathname) => pathname.endsWith('.js');

// #827: первый кадр стилей (#805) — свидетель только в пиновом Chromium;
// каждая сессия launchColdView судит запущенный браузер и отказывает как среда.
requirePinnedBrowser('smoke_editor_styles_lazy');

const DESKTOP = { width: 1100, height: 820 };
const PHONE = { width: 360, height: 780 };
const out = {};
const sessions = [];
const open = async (viewport = DESKTOP) => {
  const session = await launchColdView(viewport);
  sessions.push(session);
  const requests = [];
  session.page.on('request', (request) => {
    const { pathname, search } = new URL(request.url());
    if (isJs(pathname)) requests.push(jsName(pathname) + search);
  });
  session.requests = requests;
  session.loaded = await session.page.evaluate(() => performance.getEntriesByType('resource')
    .map((entry) => new URL(entry.name).pathname).filter((path) => path.endsWith('.js')));
  await session.page.evaluate(installHelpers);
  return session;
};
const close = async (session) => {
  sessions.splice(sessions.indexOf(session), 1);
  await session.browser.close();
};
/** The verdict `__hp805.watch` parks once the control element has been judged. */
const frameOf = async (page) => {
  await page.waitForFunction(() => window.__hp805Frame !== null, null, { timeout: 20000 });
  return page.evaluate(() => window.__hp805Frame);
};

/** Page-side helpers: rule inventory of a root, first-frame observer, View snapshot. */
function installHelpers() {
  const kindOf = (sheet) => {
    for (const rule of sheet.cssRules) {
      if (rule.selectorText === '.radarcoordinates') return 'editor-dialogs';
      if (rule.selectorText === '.editor-secondary-host') return 'editor-tray';
    }
    return 'other';
  };
  const selectors = (rules, into = []) => {
    for (const rule of rules) {
      if (rule.selectorText !== undefined) into.push(rule.selectorText);
      if (rule.cssRules) selectors(rule.cssRules, into);
    }
    return into;
  };
  window.__hp805 = {
    kindOf,
    /** Sheets of a root as kinds, plus every selector each carries. */
    inventory(root) {
      const sheets = [...(root.adoptedStyleSheets || [])];
      return {
        kinds: sheets.map(kindOf),
        selectors: sheets.flatMap((sheet) => selectors(sheet.cssRules)),
        ruleCount: sheets.reduce((sum, sheet) => sum + selectors(sheet.cssRules).length, 0),
      };
    },
    editorSelectors(root) {
      return [...(root.adoptedStyleSheets || [])].filter((sheet) => kindOf(sheet) !== 'other')
        .flatMap((sheet) => selectors(sheet.cssRules)).filter((selector) => selector !== ':host');
    },
    trayVar(host) { return getComputedStyle(host).getPropertyValue('--hp-editor-tray-bg').trim(); },
    /**
     * The element takes part in rendering: connected, and slotted by every shadow
     * host on its way up. A light-DOM child of a host that has not rendered its
     * <slot> yet (a fresh hp-dialog before its first update) is outside the flat
     * tree and has no computed style at all (Chromium 151 returns empty values).
     */
    inFlatTree(element) {
      if (!element?.isConnected) return false;
      for (let node = element; node;) {
        const parent = node.parentNode;
        if (parent instanceof ShadowRoot) { node = parent.host; continue; }
        if (parent instanceof Element && parent.shadowRoot) {
          if (!node.assignedSlot) return false;
          node = node.assignedSlot;
          continue;
        }
        node = parent instanceof Element ? parent : null;
      }
      return true;
    },
    /**
     * Judge the control element in the first frame it can be painted in.
     *
     * Found by a MutationObserver as soon as the card renders it, the element is
     * judged once it is in the flat tree and computes a value: first at the
     * microtask boundary — after `updateComplete` of the card and of every Lit
     * host on its way up (hp-dialog slots its content in its first update), all
     * before any task (a `setTimeout` adoption) can run — and only if that is not
     * enough, in the next animation frames (rAF runs before the frame's style
     * and paint). An empty value is a reason to wait, never a verdict.
     */
    firstFrame(card, selector, property) {
      return new Promise((resolve) => {
        const root = card.renderRoot;
        let settled = false;
        const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
        const editorKinds = () => [...root.adoptedStyleSheets].map(kindOf).filter((kind) => kind !== 'other');
        const rendered = () => {
          const element = root.querySelector(selector);
          if (!element || !window.__hp805.inFlatTree(element)) return null;
          const value = getComputedStyle(element).getPropertyValue(property).trim();
          return value ? { element, value } : null;
        };
        const hostsOf = (element) => {
          const hosts = new Set([card]);
          for (let node = element; node && node !== root; node = node.parentNode) {
            if (typeof node.updateComplete?.then === 'function') hosts.add(node);
          }
          return [...hosts];
        };
        const judge = async (found) => {
          let element = found;
          for (let round = 0; round < 8; round++) {
            const now = rendered();
            if (now) return finish({ value: now.value, kinds: editorKinds(), phase: 'update', rendered: true });
            element = root.querySelector(selector) || element;
            await Promise.all(hostsOf(element).map((host) => host.updateComplete));
          }
          for (let frame = 0; frame < 30; frame++) {
            await new Promise((done) => requestAnimationFrame(done));
            const now = rendered();
            if (now) return finish({ value: now.value, kinds: editorKinds(), phase: `frame ${frame + 1}`, rendered: true });
          }
          return finish({ value: 'never rendered', kinds: editorKinds(), phase: 'none', rendered: false });
        };
        const probe = () => {
          const element = root.querySelector(selector);
          if (!element) return false;
          void judge(element);
          return true;
        };
        if (probe()) return;
        const observer = new MutationObserver(() => { if (probe()) observer.disconnect(); });
        observer.observe(root, { childList: true, subtree: true });
        setTimeout(() => { observer.disconnect(); finish({ value: 'never shown', kinds: [], phase: 'none', rendered: false }); }, 10000);
      });
    },
    /**
     * Start judging and park the verdict in a slot. A promise left pending across
     * evaluate calls, or awaited for seconds inside one, can be reported by CDP
     * as collected; the Node side polls the slot with waitForFunction instead.
     */
    watch(card, selector, property) {
      window.__hp805Frame = null;
      this.firstFrame(card, selector, property).then((frame) => { window.__hp805Frame = frame; });
    },
    /** Index of the last sheet of the card's own `static styles` (Lit adopts them first). */
    litSheets(card) { return card.constructor.elementStyles.length; },
    /** Computed style of every View element; the tray tokens are host-level by contract. */
    snapshot(card) {
      const root = card.renderRoot;
      return [...root.querySelectorAll('*')].map((element) => {
        const style = getComputedStyle(element);
        const parts = [];
        for (let i = 0; i < style.length; i++) {
          if (!style[i].startsWith('--hp-editor-tray-')) parts.push(`${style[i]}:${style.getPropertyValue(style[i])}`);
        }
        return `${element.localName}.${[...element.classList].join('.')}|${parts.sort().join(';')}`;
      });
    },
    async settle(card) {
      for (let i = 0; i < 3; i++) {
        card.requestUpdate();
        await card.updateComplete;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
    },
  };
}

/** Canonical slots (#805 p. 4): editor dialogs right after `dialogs` (5th sheet), tray right after `cardStyles`. */
const canonical = (kinds, litSheets) => kinds.filter((kind) => kind === 'editor-dialogs').length === 1
  && kinds.filter((kind) => kind === 'editor-tray').length === 1
  && kinds.indexOf('editor-dialogs') === 5 && kinds.indexOf('editor-tray') === litSheets + 1;

try {
  // ---- AC2 desktop cold View, kiosk card, space card; then AC3 settings; AC5 (i)/(ii)
  const desktop = await open(DESKTOP);
  const page = desktop.page;
  const cold = await page.evaluate(async () => {
    const card = window.__card;
    const kiosk = document.createElement('houseplan-card');
    kiosk.id = 'hp-805-kiosk';
    kiosk.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 });
    kiosk.hass = card.hass;
    document.body.appendChild(kiosk);
    const space = document.createElement('houseplan-space-card');
    space.id = 'hp-805-space';
    space.setConfig({ type: 'custom:houseplan-space-card', space: card._space });
    space.hass = card.hass;
    document.body.appendChild(space);
    await kiosk.updateComplete; await space.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 600));
    await window.__hp805.settle(card);
    return {
      card: window.__hp805.inventory(card.renderRoot),
      kiosk: window.__hp805.inventory(kiosk.renderRoot),
      space: window.__hp805.inventory(space.renderRoot),
      trayVar: [card, kiosk, space].map((host) => window.__hp805.trayVar(host)),
      litSheets: window.__hp805.litSheets(card),
      litRules: window.__hp805.inventory({ adoptedStyleSheets: card.constructor.elementStyles.map((style) => style.styleSheet) }).ruleCount,
      // The card's static styles open the root, sheet for sheet; anything after them is adopted later.
      litFirst: card.constructor.elementStyles.every((style, i) => card.renderRoot.adoptedStyleSheets[i] === style.styleSheet),
      laterKinds: [...card.renderRoot.adoptedStyleSheets].slice(card.constructor.elementStyles.length)
        .map((sheet) => window.__hp805.kindOf(sheet)),
    };
  });
  out.coldViewRequestsNoEditorChunk = !desktop.loaded.concat(desktop.requests)
    .some((path) => path.includes('houseplan-editor-runtime-'));
  console.log('cold View JS:', JSON.stringify(desktop.loaded.map(jsName)));
  out.coldViewLoadsTheInitialGraph = manifest.initialViewFiles.every((path) => desktop.loaded.map(jsName).includes(path));
  out.coldRootsHaveNoEditorSheet = [cold.card, cold.kiosk, cold.space]
    .every((inventory) => inventory.kinds.every((kind) => kind === 'other'));
  out.coldHostsHaveNoTrayTokens = cold.trayVar.every((value) => value === '');

  // AC3 settings family on the cold tab: the first frame of the dialog has its styles.
  const beforeOpen = desktop.requests.length;
  await page.evaluate(() => {
    const card = window.__card;
    window.__hp805.watch(card, 'hp-dialog .backupupload input', 'display');
    card.renderRoot.querySelector('[data-hp="settings"]').click();
  });
  const settings = await frameOf(page);
  console.log(`first frame, settings: @${settings.phase}`);
  out.settingsFirstFrameStyled = settings.rendered && settings.value === 'none'
    && JSON.stringify(settings.kinds) === JSON.stringify(['editor-dialogs', 'editor-tray'])
    || `display=${settings.value} (${settings.phase}), editor sheets ${settings.kinds.join('+') || 'none'}`;
  const afterLoad = await page.evaluate(async () => {
    const card = window.__card;
    const kiosk = document.querySelector('#hp-805-kiosk');
    const space = document.querySelector('#hp-805-space');
    return {
      card: window.__hp805.inventory(card.renderRoot),
      kinds: [...card.renderRoot.adoptedStyleSheets].map(window.__hp805.kindOf),
      editor: window.__hp805.editorSelectors(card.renderRoot),
      editorRules: [...card.renderRoot.adoptedStyleSheets].filter((sheet) => window.__hp805.kindOf(sheet) !== 'other')
        .reduce((sum, sheet) => sum + window.__hp805.inventory({ adoptedStyleSheets: [sheet] }).ruleCount, 0),
      editorChars: [...card.renderRoot.adoptedStyleSheets].filter((sheet) => window.__hp805.kindOf(sheet) !== 'other')
        .reduce((sum, sheet) => sum + [...sheet.cssRules].reduce((n, rule) => n + rule.cssText.length, 0), 0),
      kioskKinds: window.__hp805.inventory(kiosk.renderRoot).kinds,
      kioskRuntime: !!kiosk._editorRuntime,
      spaceKinds: window.__hp805.inventory(space.renderRoot).kinds,
      trayVar: window.__hp805.trayVar(card),
    };
  });
  const editorSet = new Set(afterLoad.editor);
  out.editorSheetsCarryTheMovedRules = editorSet.has('.radarcoordinates') && editorSet.has('.device-inbox-row')
    && editorSet.has('.supportform > label:not(.srcrow)') && editorSet.has('.editor-secondary-host');
  out.coldRootsMatchNoMovedSelector = [cold.card, cold.kiosk, cold.space]
    .every((inventory) => inventory.selectors.every((selector) => !editorSet.has(selector)));
  // The cold root holds the card's static styles and nothing editor-only: its rule count is theirs.
  console.log(`cold card root: ${cold.litRules} rules in the ${cold.litSheets} sheets of cardStyles`
    + ` (${cold.card.ruleCount} in all ${cold.card.kinds.length} sheets, later ones: summary panel);`
    + ` the editor sheets bring ${afterLoad.editorRules} rules, ${afterLoad.editorChars} chars of CSS`);
  out.coldRootIsCardStylesPlusLaterNonEditorSheets = cold.litFirst
    && cold.laterKinds.every((kind) => kind === 'other');
  out.sheetsInCanonicalSlotsOnce = canonical(afterLoad.kinds, cold.litSheets) || afterLoad.kinds.join(',');
  out.trayTokensArriveWithTheRuntime = afterLoad.trayVar !== '';
  out.kioskAndSpaceCardStayWithoutEditorSheets = !afterLoad.kioskRuntime
    && afterLoad.kioskKinds.every((kind) => kind === 'other') && afterLoad.spaceKinds.every((kind) => kind === 'other');
  // AC7: the editor brings its own graph only — no separate sheet chunk, no new role.
  const editorRequests = desktop.requests.slice(beforeOpen).map((path) => path.replace(/\?.*$/, ''));
  console.log('JS requested on opening the editor:', JSON.stringify(editorRequests));
  const known = new Set(['lazyEditorFiles', 'lazyNamespaceLocaleFiles', 'lazyMoonFiles', 'lazyLocaleFiles',
    'lazyFurnitureArtFiles'].flatMap((graph) => manifest[graph] || []));
  out.editorOpenRequestsOnlyKnownGraphs = editorRequests.includes(runtimePath)
    && editorRequests.every((path) => known.has(path)) || editorRequests.filter((path) => !known.has(path)).join(',');

  // AC3 return to View: with the editor sheets adopted, no View element computes
  // differently than without them (the tray's host tokens are the runtime's by contract).
  const backInView = await page.evaluate(async () => {
    const card = window.__card;
    await window.__hpTest.close();
    await window.__hpTest.setMode('plan');
    await window.__hpTest.setMode('view');
    await new Promise((resolve) => setTimeout(resolve, 400));
    const root = card.renderRoot;
    const withSheets = window.__hp805.snapshot(card);
    const all = [...root.adoptedStyleSheets];
    root.adoptedStyleSheets = all.filter((sheet) => window.__hp805.kindOf(sheet) === 'other');
    const withoutSheets = window.__hp805.snapshot(card);
    root.adoptedStyleSheets = all;
    const differing = withSheets.filter((entry, i) => entry !== withoutSheets[i]).map((entry) => entry.split('|')[0]);
    return { elements: withSheets.length, differing, mode: card._mode };
  });
  out.viewAfterEditorUntouchedByEditorSheets = backInView.mode === 'view' && backInView.elements > 100
    && backInView.differing.length === 0 || `${backInView.differing.length} of ${backInView.elements}: ${backInView.differing.slice(0, 5)}`;

  // AC5 (i): a second full card adopts into its own root; the sheet objects are shared.
  await page.evaluate(() => {
    const second = document.createElement('houseplan-card');
    second.id = 'hp-805-second';
    second.setConfig({ type: 'custom:houseplan-card', title: 'Second' });
    second.hass = window.__card.hass;
    document.body.appendChild(second);
  });
  await page.waitForFunction(() => {
    const second = document.querySelector('#hp-805-second');
    return second?._booting === false && !!second.renderRoot?.querySelector('[data-hp="mode-tab"][data-mode="plan"]');
  }, null, { timeout: 15000 });
  await page.evaluate(() => {
    const second = document.querySelector('#hp-805-second');
    window.__hp805.watch(second, '.editor-secondary-host', 'position');
    second.renderRoot.querySelector('[data-hp="mode-tab"][data-mode="plan"]').click();
  });
  const secondFrame = await frameOf(page);
  out.secondCardOwnRootSharedSheets = await page.evaluate((frame) => {
    const sheetsOf = (card) => [...card.renderRoot.adoptedStyleSheets]
      .filter((sheet) => window.__hp805.kindOf(sheet) !== 'other');
    const a = sheetsOf(window.__card);
    const b = sheetsOf(document.querySelector('#hp-805-second'));
    return frame.value === 'absolute' && a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === b[1]
      || `position=${frame.value} (${frame.phase}), sheets ${a.length}/${b.length}`;
  }, secondFrame);

  // AC5 (ii): warm remount — General settings revive on the new instance, styled in their first frame.
  await page.evaluate(async () => {
    await window.__hpTest.setMode('view');
    window.__card.renderRoot.querySelector('[data-hp="settings"]').click();
  });
  await page.waitForFunction(() => !!window.__card.renderRoot.querySelector('hp-dialog .backupupload'),
    null, { timeout: 15000 });
  await page.evaluate(() => {
    const old = window.__card;
    const host = old.parentNode;
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan', icon_size: 3.4 });
    card.hass = old.hass;
    old.remove();
    host.appendChild(card);
    window.__card = card;
    // Connected: the render root exists, the first render is still a microtask away.
    window.__hp805.watch(card, 'hp-dialog .backupupload input', 'display');
  });
  const revived = await frameOf(page);
  out.warmRemountRevivedDialogStyled = revived.value === 'none' && revived.kinds.length === 2
    && await page.evaluate(() => !!window.__card._editorRuntime)
    || `display=${revived.value} (${revived.phase}), editor sheets ${revived.kinds.join('+') || 'none'}`;
  await close(desktop);

  // ---- AC3 families on cold tabs: each surface opened through its product path. The first
  // check of a tab is what loads the runtime; later checks open surfaces of the warm runtime.
  const families = [
    {
      name: 'support', checks: [{
        selector: '.supportsection', property: 'display', expected: 'grid',
        open: () => window.__card.renderRoot.querySelector('[data-hp="support"]').click(),
      }],
    },
    {
      name: 'plan', checks: [{
        selector: '.editor-secondary-host', property: 'position', expected: 'absolute',
        open: () => { void window.__hpTest.setMode('plan'); },
      }, {
        selector: 'hp-dialog .alignmsg', property: 'display',
        open: () => window.__card._editorRuntime.optimizePlans.open(),
      }, {
        selector: 'hp-dialog .backupbody .srcrow', property: 'display', expected: 'flex',
        open: async () => { await window.__hpTest.close(); window.__card._openBackupExport(); },
      }, {
        selector: 'hp-dialog.roomdialog', property: 'display',
        open: async () => {
          await window.__hpTest.close();
          void window.__hpTest.openRoomEdit(window.__card._spaceModel().rooms[0].id);
        },
      }, {
        selector: '.wallthick-dlg', property: 'position', expected: 'absolute',
        open: async () => {
          await window.__hpTest.close();
          await window.__hpTest.setTool('wall-thickness');
          const [a, b] = window.__card._spaceModel().rooms[0].poly;
          window.__card._wallThickClick([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
        },
      }],
    },
    {
      name: 'devices', checks: [{
        selector: '.editor-secondary-host', property: 'position', expected: 'absolute',
        open: () => { void window.__hpTest.setMode('devices'); },
      }, {
        selector: '.device-inbox-row', property: 'display', expected: 'grid',
        open: () => { void window.__hpTest.setTool('device-inbox'); },
      }, {
        selector: '.rtest', property: 'display', expected: 'flex',
        open: async () => { await window.__hpTest.close(); void window.__hpTest.setTool('icon-rules'); },
      }, {
        selector: '.radarcoordinates', property: 'flex-wrap', expected: 'wrap',
        open: async () => {
          await window.__hpTest.close();
          await window.__hpTest.openMarkerDialog('d_lamp');
          window.__card.renderRoot.querySelector('#marker-radar-presence').click();
        },
      }, {
        selector: '.radarsetup', property: 'display', expected: 'grid',
        open: async () => {
          const card = window.__card;
          const root = card.renderRoot;
          const choose = async (select, pick) => {
            select.value = pick([...select.options].map((option) => option.value));
            select.dispatchEvent(new Event('change', { bubbles: true }));
            await window.__hpTest.settled();
          };
          await choose(root.querySelector('#radar-profile'), () => 'presence_v1');
          await choose(root.querySelector('#radar-room'), (values) => values.find(Boolean));
          const occupancy = [...root.querySelectorAll('.radargroup label')]
            .find((label) => label.textContent.trim() === card._t('radar.occupancy_source'))?.nextElementSibling;
          await choose(occupancy, (values) => values.find((value) => value.startsWith('binary_sensor.')));
          root.querySelector('.radargroup button ha-icon[icon="mdi:map-marker-radius"]').closest('button').click();
        },
      }, {
        selector: '.vacdiag', property: 'display', expected: 'grid',
        open: async () => {
          const card = window.__card;
          await window.__hpTest.close();
          card.hass = { ...card.hass,
            entities: { ...card.hass.entities, 'vacuum.robo': { entity_id: 'vacuum.robo', platform: 'demo', disabled_by: null },
              'camera.robo_map': { entity_id: 'camera.robo_map', platform: 'demo', disabled_by: null } },
            states: { ...card.hass.states, 'vacuum.robo': { state: 'docked', attributes: { friendly_name: 'Robot' } },
              'camera.robo_map': { state: 'idle', attributes: { vacuum_position: { x: 500, y: 500, a: 0 }, map_name: 'm2',
                rooms: { 1: { name: 'Kitchen', x0: 0, y0: 0, x1: 1000, y1: 800 } } } } } };
          await window.__hpTest.setServerConfig((cfg) => {
            cfg.markers = [...(cfg.markers || []), { id: 'e_vacuum_robo', binding: 'entity:vacuum.robo', space: 'f1',
              vacuum: { source: 'camera.robo_map', calibration: { m1: [0.5, 0, 0, 0, 0.5, 0] } } }];
            return cfg;
          });
          await window.__hpTest.setLayout((layout) => ({ ...layout, e_vacuum_robo: { s: 'f1', x: 0.1, y: 0.1 } }));
          void window.__hpTest.openMarkerDialog('e_vacuum_robo');
        },
      }, {
        selector: '.vacfit', property: 'position', expected: 'absolute',
        open: async () => {
          await window.__hpTest.close();
          window.__card._vacStartFit(window.__card._devices.find((device) => device.id === 'e_vacuum_robo'));
        },
      }],
    },
    {
      name: 'decor', checks: [{
        selector: '.editor-secondary-host', property: 'position', expected: 'absolute',
        open: () => { void window.__hpTest.setMode('decor'); },
      }, {
        selector: '.furnpalette', property: 'display', expected: 'flex',
        open: () => { void window.__hpTest.setTool('furniture'); },
      }, {
        selector: '.imageupload input', property: 'display', expected: 'none',
        open: async () => {
          await window.__hpTest.setTool('furniture');
          window.__card._haDecorAssetsApi = 1; // private-ok: #805 the demo backend reports no decor-assets capability (as in smoke_decor_images)
          // The capability is a plain field: ask for the render that shows the image tool, then use it.
          const tool = () => window.__card.renderRoot.querySelector('[data-hp="tool"][data-tool="image"]');
          for (let i = 0; i < 100 && !tool(); i++) {
            window.__card.requestUpdate();
            await window.__hpTest.settled();
          }
          void window.__hpTest.setTool('image');
        },
      }],
    },
  ];
  for (const family of families) {
    const session = await open(DESKTOP);
    const results = [];
    for (const check of family.checks) {
      // The observer writes into a slot: a promise left pending across two evaluate
      // calls can be collected by CDP before it settles.
      await session.page.evaluate(({ selector, property }) => {
        window.__hp805.watch(window.__card, selector, property);
      }, { selector: check.selector, property: check.property });
      await session.page.evaluate(check.open);
      results.push(await frameOf(session.page));
    }
    const kinds = await session.page.evaluate(() => [...window.__card.renderRoot.adoptedStyleSheets].map(window.__hp805.kindOf));
    console.log(`first frame, ${family.name}:`, family.checks.map((check, i) => `${check.selector} @${results[i].phase}`).join('; '));
    family.checks.forEach((check, i) => {
      const result = results[i];
      out[`${family.name}: ${check.selector} styled in its first frame`] = result.rendered
        && (check.expected === undefined || result.value === check.expected)
        && result.kinds.length === 2
        || `${check.property}=${result.value} (${result.phase}), editor sheets ${result.kinds.join('+') || 'none'}`;
    });
    const lit = await session.page.evaluate(() => window.__hp805.litSheets(window.__card));
    out[`${family.name}: editor sheets adopted once, canonical slots`] = canonical(kinds, lit) || kinds.join(',');
    await close(session);
  }

  // ---- AC2 phone width: cold View and onboarding stay without the editor
  const phone = await open(PHONE);
  const phoneCold = await phone.page.evaluate(async () => {
    const card = window.__card;
    await window.__hp805.settle(card);
    return { kinds: window.__hp805.inventory(card.renderRoot).kinds, tray: window.__hp805.trayVar(card) };
  });
  out.phoneColdViewWithoutEditorSheets = phoneCold.kinds.every((kind) => kind === 'other') && phoneCold.tray === '';
  const onboarding = await phone.page.evaluate(async () => {
    const card = window.__card;
    card.hass = { ...card.hass, floors: {}, areas: {} };
    await window.__hpTest.setServerConfig((cfg) => ({ ...cfg, spaces: [] }));
    for (let i = 0; i < 80 && !(card._onboardingRuntime && card.renderRoot.querySelector('hp-dialog .hpf-card')); i++) {
      await window.__hp805.settle(card);
    }
    // Rules shared with onboarding stay eager: its own rows are laid out without the editor.
    const shared = [...card.renderRoot.querySelectorAll('hp-dialog .planrow, hp-dialog .savedplans, hp-dialog .floorrow')];
    return {
      shown: !!card.renderRoot.querySelector('hp-dialog .hpf-card'),
      editor: !!card._editorRuntime,
      kinds: window.__hp805.inventory(card.renderRoot).kinds,
      shared: shared.map((element) => `${element.className}:${getComputedStyle(element).display}`),
    };
  });
  out.onboardingWithoutEditorAndItsSheets = onboarding.shown && !onboarding.editor
    && onboarding.kinds.every((kind) => kind === 'other');
  out.onboardingSharedRowsStyledWithoutEditor = onboarding.shared.length > 0
    && onboarding.shared.every((entry) => entry.endsWith(':flex')) || JSON.stringify(onboarding.shared);
  out.phoneNoEditorChunkRequested = !phone.loaded.concat(phone.requests).some((path) => path.includes('houseplan-editor-runtime-'));
  await close(phone);

  // ---- AC5 (iii): disconnect while the runtime is importing, then reconnect
  const detached = await open(DESKTOP);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await detached.page.route(runtimePattern, async (route) => { await gate; await route.fallback(); });
  await detached.page.evaluate(() => {
    const card = window.__card;
    card.renderRoot.querySelector('[data-hp="mode-tab"][data-mode="plan"]').click();
    window.__hp805Host = card.parentNode;
    card.remove();
  });
  release();
  await detached.page.waitForFunction(() => window.__card._editorRuntimeLoader.state === 'ready');
  const detachedKinds = await detached.page.evaluate(() => {
    const card = window.__card;
    const kinds = [...card.renderRoot.adoptedStyleSheets].map(window.__hp805.kindOf);
    window.__hp805Host.appendChild(card);
    window.__hp805.watch(card, '.editor-secondary-host', 'position');
    card.renderRoot.querySelector('[data-hp="mode-tab"][data-mode="plan"]').click();
    return kinds;
  });
  const reattached = await frameOf(detached.page);
  const reattachedKinds = await detached.page.evaluate(() => [...window.__card.renderRoot.adoptedStyleSheets]
    .map(window.__hp805.kindOf));
  out.disconnectDuringImportAdoptsOnce = detachedKinds.filter((kind) => kind !== 'other').length === 2
    && reattached.value === 'absolute' && reattachedKinds.filter((kind) => kind !== 'other').length === 2
    || `detached ${detachedKinds}, position=${reattached.value} (${reattached.phase}), after ${reattachedKinds}`;
  await close(detached);

  // ---- AC5 (iv): the first attempt fails, the content-hashed retry succeeds — adopted once
  const retry = await open(DESKTOP);
  let attempts = 0;
  await retry.page.route(runtimePattern, (route) => {
    attempts += 1;
    return new URL(route.request().url()).search ? route.fallback() : route.abort('failed');
  });
  await retry.page.evaluate(() => {
    window.__hp805.watch(window.__card, '.editor-secondary-host', 'position');
    window.__card.renderRoot.querySelector('[data-hp="mode-tab"][data-mode="plan"]').click();
  });
  const retried = {
    result: await frameOf(retry.page),
    kinds: await retry.page.evaluate(() => [...window.__card.renderRoot.adoptedStyleSheets]
      .map(window.__hp805.kindOf).filter((kind) => kind !== 'other')),
  };
  out.retryAfterFailedAttemptAdoptsOnce = attempts === 2 && retried.result.value === 'absolute'
    && JSON.stringify(retried.kinds) === JSON.stringify(['editor-dialogs', 'editor-tray']) || `${attempts} attempts, ${retried.kinds}`;
  await close(retry);

  // ---- AC5 (v): a module of another build adopts nothing; the View keeps working
  const foreign = await open(DESKTOP);
  const incompatible = readFileSync(`demo/srv/assets/${runtimePath}`, 'utf8')
    .replaceAll(manifest.fingerprint, `${manifest.fingerprint}-mismatch`);
  await foreign.page.route(runtimePattern, (route) => route.fulfill({
    status: 200, contentType: 'text/javascript', body: incompatible,
  }));
  await foreign.page.evaluate(() => {
    window.__card.renderRoot.querySelector('[data-hp="mode-tab"][data-mode="plan"]').click();
  });
  await foreign.page.waitForFunction(() => window.__card._editorRuntimeLoader.state === 'failed');
  out.foreignBuildAdoptsNothing = await foreign.page.evaluate(async () => {
    const card = window.__card;
    await window.__hp805.settle(card);
    return card._mode === 'view' && !card._editorRuntime
      && [...card.renderRoot.adoptedStyleSheets].every((sheet) => window.__hp805.kindOf(sheet) === 'other')
      && window.__hp805.trayVar(card) === '' && !card.renderRoot.querySelector('.editor-secondary-host')
      && !!card.renderRoot.querySelector('.stage');
  });
  await close(foreign);
} finally {
  for (const session of [...sessions]) await session.browser.close().catch(() => {});
}

checkAll(out);
await finish(null, out);
