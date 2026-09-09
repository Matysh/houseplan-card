// #505: observable presentation and native-dialog contracts. The separate
// summary smoke owns the large-index/performance and lost-ACK regression set.
// No HA service/config endpoint outside this isolated demo is contacted.
import { launch, check, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1600, height: 1000 });
const evidence = {};
const fixtureKey = 'hp_summary_505_fake_server';

async function installFixture({ seed = false } = {}) {
  await page.waitForFunction(() => !!window.__card?._summary);
  return page.evaluate(async ({ seed, fixtureKey }) => {
    const card = window.__card;
    const root = () => card.shadowRoot || card.renderRoot;
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const settle = async () => { await card.updateComplete; await frame(); await card.updateComplete; };
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    card._config = { ...card._config, language: 'en', kiosk: false };
    card._serverCanWrite = true;
    card._haSummaryPanelApi = 1;
    card.narrow = false;
    document.querySelector('#host').style.width = '1440px';
    root().querySelector('.stage').style.height = '800px';
    if (seed) {
      const config = structuredClone(card._serverCfg);
      config.settings = { ...config.settings, summary_panel: {
        version: 1, title: 'Summary', show_on_mobile: true,
        blocks: [{ id: 'first', title: 'General', visible: true, scope: { type: 'all' }, values: [
          { id: 'devices', label: 'Devices', source: { type: 'system', key: 'device_count' } },
          { id: 'area', label: 'Floor area', source: { type: 'system', key: 'total_area' } },
          { id: 'clock', label: 'Date and time', source: { type: 'system', key: 'datetime' } },
        ] }],
      } };
      localStorage.setItem(fixtureKey, JSON.stringify({ config, rev: card._cfgRev }));
    }
    const server = JSON.parse(localStorage.getItem(fixtureKey));
    card._serverCfg = structuredClone(server.config);
    card._settings = card._serverCfg.settings;
    card._cfgRev = server.rev;
    const writes = [];
    card._sendConfigCandidate = async (candidate) => {
      writes.push(structuredClone(candidate));
      server.config = structuredClone(candidate);
      server.rev++;
      card._cfgRev = server.rev;
      localStorage.setItem(fixtureKey, JSON.stringify(server));
    };
    card._summary.updated();
    card.requestUpdate();
    await settle();
    const panel = () => root().querySelector('.summary-overlay');
    const control = () => root().querySelector('.summary-control');
    const toggle = () => control()?.querySelector('button:last-child');
    const show = async (wanted) => {
      if ((toggle()?.getAttribute('aria-pressed') === 'true') !== wanted) toggle()?.click();
      await card.updateComplete;
    };
    const open = async () => {
      control()?.querySelector('button:first-child')?.click();
      for (let i = 0; i < 60 && !root().querySelector('hp-dialog[data-kind="summary"]'); i++) {
        await pause(5); await settle();
      }
      await settle();
      const dialog = root().querySelector('hp-dialog[data-kind="summary"]');
      await dialog?.updateComplete;
      await frame();
      return dialog;
    };
    const dialog = () => root().querySelector('hp-dialog[data-kind="summary"]');
    const field = (kind) => dialog()?.querySelector(`[data-summary-${kind}-show]`);
    const clickField = async (kind, wanted) => {
      const input = field(kind);
      if (input && input.checked !== wanted) input.click();
      await settle();
      return !!input;
    };
    const close = async (kind = 'cancel') => {
      if (kind === 'x') dialog()?.shadowRoot?.querySelector('.close')?.click();
      else dialog()?.querySelector(`[data-hp="dialog-${kind}"]`)?.click();
      await settle();
    };
    const localKey = () => card._summary.storageKey;
    const stored = () => ({
      local: localStorage.getItem(localKey()),
      legacy: localStorage.getItem('houseplan_card_kiosk_v1'),
      server: localStorage.getItem(fixtureKey),
    });
    const snapshot = () => {
      const node = panel();
      const css = node ? getComputedStyle(node) : null;
      const rect = node?.getBoundingClientRect();
      const stage = root().querySelector('.stage').getBoundingClientRect();
      const transform = css && css.transform !== 'none' ? new DOMMatrixReadOnly(css.transform) : null;
      const translate = (css?.translate || '0px 0px').split(/\s+/).map((value) => parseFloat(value) || 0);
      return {
        present: !!node, count: root().querySelectorAll('.summary-overlay').length,
        opacity: css ? Number(css.opacity) : null,
        dx: (transform?.m41 || 0) + translate[0], dy: (transform?.m42 || 0) + (translate[1] || 0),
        inert: node?.inert === true, hidden: node?.getAttribute('aria-hidden') === 'true',
        center: rect ? (rect.left + rect.right - stage.left - stage.right) / 2 : null,
      };
    };
    const sample = async (ms) => {
      const started = performance.now();
      const rows = [];
      do { rows.push({ ms: performance.now() - started, ...snapshot() }); await frame(); }
      while (performance.now() - started < ms);
      rows.push({ ms: performance.now() - started, ...snapshot() });
      return rows;
    };
    const size = async (side) => {
      document.querySelector('#host').style.width = side === 'bottom' ? '700px' : '1440px';
      root().querySelector('.stage').style.height = side === 'bottom' ? '950px' : '800px';
      card._summary.resized(); await settle();
    };
    window.__summary505 = {
      card, root, frame, settle, pause, panel, control, toggle, show, open, dialog,
      field, clickField, close, localKey, stored, snapshot, sample, size, writes,
    };
    return { key: localKey(), freshServer: !!server.config.settings.summary_panel };
  }, { seed, fixtureKey });
}

try {
  evidence.fixture = await installFixture({ seed: true });
  evidence.controls = await page.evaluate(async () => {
    const f = window.__summary505;
    await f.show(true); await f.pause(330); await f.settle();
    const group = f.control();
    const buttons = [...group.querySelectorAll('button')];
    const rects = buttons.map((button) => button.getBoundingClientRect());
    const actionRow = group.parentElement;
    const following = [...actionRow.children].slice([...actionRow.children].indexOf(group) + 1)
      .filter((node) => node.getBoundingClientRect().width > 0);
    return {
      pairIsLastViewAction: following.length === 0,
      gearThenToggle: buttons.length === 2 && rects[0].left < rects[1].left
        && buttons[0].getAttribute('aria-label') === f.card._summary.t('summary.settings')
        && buttons[1].getAttribute('aria-pressed') === 'true',
      vectorGlyphsAreAccessible: buttons.every((button) => {
        const svg = button.querySelector('svg');
        const box = svg?.getBoundingClientRect();
        return !!button.getAttribute('aria-label') && !!svg?.getAttribute('viewBox')
          && svg.getAttribute('aria-hidden') === 'true' && box.width >= 18 && box.width <= 22
          && box.height >= 18 && box.height <= 22;
      }),
      controlsHaveTouchTargets: rects.every((rect) => rect.width >= 44 && rect.height >= 44),
      onlyToggleHasAccent: getComputedStyle(buttons[0]).backgroundColor !== getComputedStyle(buttons[1]).backgroundColor,
      summaryOutsideCamera: !group.closest('.zoomwrap') && !f.panel()?.closest('.zoomwrap'),
    };
  });
  checkAll(evidence.controls);
  evidence.kioskControls = await page.evaluate(async () => {
    const f = window.__summary505;
    f.card._config = { ...f.card._config, kiosk: true };
    f.card.requestUpdate(); await f.settle(); await f.show(true); await f.pause(240); await f.settle();
    const control = f.root().querySelector('.summary-control.kiosk');
    const panel = f.panel();
    const controlBox = control?.getBoundingClientRect();
    const panelBox = panel?.getBoundingClientRect();
    const out = {
      kiosk_pair_stays_outside_camera: !!control && !control.closest('.zoomwrap'),
      kiosk_panel_clears_measured_controls: !!panelBox && !!controlBox && panelBox.top >= controlBox.bottom + 8,
      kiosk_pair_keeps_two_touch_targets: control?.querySelectorAll('button').length === 2
        && [...control.querySelectorAll('button')].every((button) => {
          const box = button.getBoundingClientRect(); return box.width >= 44 && box.height >= 44;
        }),
    };
    f.card._config = { ...f.card._config, kiosk: false }; f.card.requestUpdate(); await f.settle();
    return out;
  });
  checkAll(evidence.kioskControls);

  evidence.motion = await page.evaluate(async () => {
    const f = window.__summary505;
    const results = {};
    const traces = {};
    for (const side of ['right', 'bottom']) {
      await f.show(false); await f.pause(330); await f.size(side);
      // A fixture resize legitimately refits the camera. Let that independent
      // operation finish before asserting that show/hide itself never refits.
      await f.pause(330); await f.settle();
      const stage = f.root().querySelector('.stage');
      const camera = f.root().querySelector('.zoomwrap');
      const before = { box: JSON.stringify(stage.getBoundingClientRect().toJSON()),
        camera: camera?.getAttribute('style'), x: scrollX, y: scrollY };
      await f.show(true);
      await f.frame();
      const entering = f.panel();
      const entryDurations = entering?.getAnimations().map((animation) => animation.effect?.getTiming().duration) || [];
      const entry = await f.sample(240);
      results[`${side}_entry_has_real_progress`] = entry.some((row) => row.opacity > .02 && row.opacity < .98)
        && entry.at(-1).opacity >= .99;
      results[`${side}_entry_uses_190ms`] = entryDurations.length > 0
        && entryDurations.every((duration) => duration === 190);
      const original = f.panel();
      const exitStarted = performance.now();
      await f.show(false);
      const immediate = f.snapshot();
      results[`${side}_exit_retains_inert_same_node`] = f.panel() === original && !!original
        && immediate.inert && immediate.hidden && immediate.opacity > .8;
      const exit = await f.sample(320);
      const gone = exit.find((row) => !row.present);
      results[`${side}_exit_progress_then_bounded_removal`] = exit.some((row) => row.opacity > .02 && row.opacity < .98)
        && !!gone && gone.ms >= 100 && performance.now() - exitStarted < 380 && gone.ms <= 320;
      const movement = exit.filter((row) => row.present).map((row) => side === 'right' ? row.dx : row.dy);
      results[`${side}_edge_motion_is_18px`] = movement.some((value) => value > 12 && value <= 18.5)
        && movement.every((value) => value >= -.5 && value <= 18.5);
      results[`${side}_one_subtree`] = [...entry, ...exit].every((row) => row.count <= 1);
      results[`${side}_camera_and_stage_unchanged`] = JSON.stringify(stage.getBoundingClientRect().toJSON()) === before.box
        && camera?.getAttribute('style') === before.camera && scrollX === before.x && scrollY === before.y;
      if (side === 'bottom') results.bottom_centered_throughout = [...entry, ...exit]
        .filter((row) => row.present).every((row) => Math.abs(row.center) <= 1);

      await f.show(true); await f.pause(240); await f.show(false); await f.pause(65);
      const reversedNode = f.panel();
      const preReverse = f.snapshot();
      await f.show(true);
      const postReverse = f.snapshot();
      const reverse = await f.sample(330);
      results[`${side}_reversal_starts_at_rendered_progress`] = !!reversedNode && f.panel() === reversedNode
        && preReverse.opacity > .02 && preReverse.opacity < .98
        && Math.abs(preReverse.opacity - postReverse.opacity) < .15;
      results[`${side}_old_completion_cannot_remove_reversal`] = reverse.every((row) => row.present && row.count === 1)
        && reverse.at(-1).opacity >= .99 && !reverse.at(-1).inert;
      await f.show(false); await f.pause(35); await f.show(true); await f.pause(35); await f.show(false);
      const last = await f.sample(340);
      results[`${side}_rapid_last_intent_wins`] = !last.at(-1).present && last.every((row) => row.count <= 1)
        && f.toggle().getAttribute('aria-pressed') === 'false';
      traces[side] = { entryDurations, entry, exit, preReverse, postReverse, reverse,
        cameraBefore: before, cameraAfter: { box: JSON.stringify(stage.getBoundingClientRect().toJSON()),
          camera: camera?.getAttribute('style'), x: scrollX, y: scrollY } };
    }
    return { results, traces };
  });
  checkAll(evidence.motion.results);

  evidence.lifecycle = await page.evaluate(async () => {
    const f = window.__summary505;
    const out = {};
    await f.size('right'); await f.show(true); await f.pause(240);
    await f.show(false); await f.pause(45);
    f.panel()?.getAnimations().forEach((animation) => animation.cancel());
    await f.pause(290); await f.settle();
    out.cancelled_animation_still_cleans_up = !f.panel();
    await f.show(true); await f.pause(55);
    await f.size('bottom');
    const anchored = f.snapshot();
    out.anchor_change_settles_visible_at_new_edge = f.panel()?.classList.contains('bottom') === true
      && anchored.opacity >= .99 && Math.abs(anchored.dy) < .5 && Math.abs(anchored.center) < 1;
    await f.pause(320);
    out.old_anchor_callback_cannot_remove_new_panel = !!f.panel();
    await f.show(false); await f.pause(35); await f.size('right');
    out.anchor_change_settles_latest_off_immediately = !f.panel();
    await f.show(true); await f.pause(240);
    const savedIntent = f.stored().local;
    document.querySelector('#host').style.width = '260px';
    f.card._summary.resized(); await f.settle();
    out.fit_loss_removes_without_persisting_off = !f.panel() && f.stored().local === savedIntent;
    await f.size('right'); await f.pause(240);
    out.fit_recovery_restores_saved_intent = !!f.panel();
    const oldSettings = f.card._serverCfg.settings;
    f.card._serverCfg = { ...f.card._serverCfg, settings: { ...oldSettings,
      summary_panel: { ...oldSettings.summary_panel, show_on_mobile: false } } };
    f.card._settings = f.card._serverCfg.settings;
    f.card.narrow = true; f.card.requestUpdate(); await f.settle();
    out.native_narrow_hides_without_changing_intent = !f.panel() && f.stored().local === savedIntent;
    f.card.narrow = false; f.card._serverCfg = { ...f.card._serverCfg, settings: oldSettings };
    f.card._settings = oldSettings; f.card.requestUpdate(); await f.settle(); await f.pause(240);

    // Dispatch the same lifecycle signal as a backgrounded document. The
    // read-only browser property is scoped to this fixture and restored below.
    await f.show(false); await f.pause(45);
    const descriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    f.card._summary.visibility('hidden'); await f.settle();
    out.hidden_document_settles_latest_off = !f.panel();
    await f.show(true); await f.settle();
    out.hidden_document_on_settles_without_motion = !!f.panel() && f.snapshot().opacity >= .99;
    if (descriptor) Object.defineProperty(document, 'visibilityState', descriptor);
    else delete document.visibilityState;
    f.card._summary.visibility('visible'); await f.settle();
    out.return_from_background_does_not_replay = !!f.panel() && f.snapshot().opacity >= .99
      && f.panel().getAnimations().length === 0;

    for (const boundary of ['editor', 'identity', 'host', 'unsupported', 'route', 'disconnect']) {
      await f.show(true); await f.pause(240); await f.show(false); await f.pause(45);
      const original = { user: f.card.hass.user, host: f.card.panelHost,
        settings: f.card._serverCfg.settings, path: location.pathname };
      if (boundary === 'editor') f.card._mode = 'plan';
      if (boundary === 'identity') f.card.hass = { ...f.card.hass, user: { ...original.user, id: 'summary-505-other' } };
      if (boundary === 'host') f.card.panelHost = !original.host;
      if (boundary === 'unsupported') {
        f.card._serverCfg = { ...f.card._serverCfg, settings: { ...original.settings,
          summary_panel: { version: 999, title: 'Future private data', blocks: [] } } };
        f.card._settings = f.card._serverCfg.settings;
      }
      if (boundary === 'route') {
        history.pushState({}, '', '/summary-505-away'); f.card._summary.leaveRoute();
      }
      if (boundary === 'disconnect') f.card._summary.disconnect();
      f.card.requestUpdate(); await f.settle();
      const immediatelyGone = !f.panel();
      await f.pause(320); await f.settle();
      out[`${boundary}_cancels_old_presentation`] = immediatelyGone && !f.panel();
      f.card._mode = 'view'; f.card.hass = { ...f.card.hass, user: original.user };
      f.card.panelHost = original.host;
      f.card._serverCfg = { ...f.card._serverCfg, settings: original.settings };
      f.card._settings = original.settings;
      if (boundary === 'route') history.replaceState({}, '', original.path);
      f.card._summary.connect(); f.card.requestUpdate(); await f.settle();
    }
    const contentSettings = f.card._serverCfg.settings;
    const dense = structuredClone(contentSettings.summary_panel);
    dense.blocks[0].values = Array.from({ length: 20 }, (_, index) => ({
      id: `scroll-${index}`, label: `Reading ${index}`, source: { type: 'system', key: 'device_count' },
    }));
    dense.blocks.push({ id: 'filtered', title: 'Private 505 filtered', visible: true,
      scope: { type: 'all' }, values: [] });
    f.card._serverCfg = { ...f.card._serverCfg, settings: { ...contentSettings, summary_panel: dense } };
    f.card._settings = f.card._serverCfg.settings;
    f.root().querySelector('.stage').style.height = '400px'; f.card._summary.resized();
    f.card.requestUpdate(); await f.settle(); await f.show(true); await f.pause(240);
    const contentNode = f.panel();
    const scroll = contentNode?.querySelector('.summary-scroll');
    if (scroll) scroll.scrollTop = 100;
    const scrollBefore = scroll?.scrollTop;
    f.card.hass = { ...f.card.hass, states: { ...f.card.hass.states,
      'sensor.unrelated_505': { entity_id: 'sensor.unrelated_505', state: '42', attributes: {} } } };
    f.card.requestUpdate(); await f.settle();
    out.unrelated_rerender_retains_panel_and_scroll = !!contentNode && f.panel() === contentNode
      && scrollBefore > 0 && scroll.scrollTop === scrollBefore;
    dense.title = 'Updated while visible'; dense.blocks[1].scope = { type: 'space', space_id: 'filtered-away-505' };
    f.card._serverCfg = { ...f.card._serverCfg, settings: { ...contentSettings, summary_panel: structuredClone(dense) } };
    f.card._settings = f.card._serverCfg.settings; f.card.requestUpdate(); await f.settle();
    out.eligible_config_update_is_in_place_without_private_block = f.panel() === contentNode
      && contentNode.querySelector('h2').textContent === 'Updated while visible'
      && !contentNode.textContent.includes('Private 505 filtered') && contentNode.getAnimations().length === 0
      && scroll.scrollTop === scrollBefore;
    f.card._serverCfg = { ...f.card._serverCfg, settings: contentSettings }; f.card._settings = contentSettings;
    f.card.requestUpdate(); await f.size('right');
    return out;
  });
  checkAll(evidence.lifecycle);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  evidence.reduced = await page.evaluate(async () => {
    const f = window.__summary505;
    await f.show(true); await f.settle();
    const on = f.snapshot();
    await f.show(false); await f.settle();
    return { reduced_on_has_no_motion: on.present && on.opacity >= .99 && Math.abs(on.dx) < .5 && Math.abs(on.dy) < .5,
      reduced_off_has_no_delayed_dom: !f.panel() };
  });
  checkAll(evidence.reduced);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(async () => {
    const f = window.__summary505; await f.show(true); await f.pause(240); await f.show(false);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    window.__summary505MediaChanged = media.matches ? Promise.resolve(true) : new Promise((resolve) => {
      media.addEventListener('change', () => resolve(true), { once: true });
    });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  check('motion_preference_change_settles_inflight_exit', await page.evaluate(async () => {
    const f = window.__summary505;
    // Chromium delivers media-change events asynchronously after the CDP
    // command returns. Inspect the product after that real event, not before.
    const delivered = await Promise.race([window.__summary505MediaChanged, f.pause(180).then(() => false)]);
    await f.settle(); return delivered && !f.panel();
  }));

  evidence.nativeDesktop = await page.evaluate(async () => {
    const f = window.__summary505;
    await f.open();
    const dialog = f.dialog();
    const surface = dialog?.shadowRoot?.querySelector('.surface');
    const rect = surface?.getBoundingClientRect();
    const save = dialog?.querySelector('[data-hp="dialog-confirm"]');
    const out = {
      actual_native_surface_is_920px: !!rect && Math.abs(rect.width - 920) <= 1,
      surface_bounded_to_viewport: !!rect && rect.left >= 0 && rect.right <= innerWidth,
      general_before_blocks: !!dialog?.querySelector('.summary-general') && !!dialog.querySelector('.summary-blocks-card')
        && !!(dialog.querySelector('.summary-general').compareDocumentPosition(dialog.querySelector('.summary-blocks-card'))
          & Node.DOCUMENT_POSITION_FOLLOWING),
      unchanged_save_visible_disabled: !!save && save.disabled && save.getBoundingClientRect().width >= 44,
      sizes_absent: !dialog?.querySelector('input[type="range"], .summary-local-sizes, .summary-sizes-title, .summary-size-reset'),
    };
    await f.close();
    return out;
  });
  checkAll(evidence.nativeDesktop);

  evidence.responsive = [];
  for (const scenario of [
    { width: 320, height: 760, language: 'ru', dark: true },
    { width: 390, height: 844, language: 'de', dark: false },
    { width: 740, height: 400, language: 'fr', dark: true },
  ]) {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    const metric = await page.evaluate(async (scenario) => {
      const f = window.__summary505;
      document.documentElement.style.fontSize = '200%';
      document.documentElement.toggleAttribute('dark', scenario.dark);
      document.querySelector('#host').style.width = '100%';
      f.card._config = { ...f.card._config, language: scenario.language };
      await f.open();
      const dialog = f.dialog();
      const editor = dialog?.querySelector('.summary-editor');
      const surface = dialog?.shadowRoot?.querySelector('.surface');
      const footer = dialog?.querySelector('[slot="footer"]');
      const targets = [...(editor?.querySelectorAll('button, input:not([type="checkbox"]), select, .summary-switch, .summary-drag') || []),
        ...(footer?.querySelectorAll('button') || []), ...(dialog?.shadowRoot?.querySelectorAll('.close') || [])];
      const boxes = targets.map((target) => ({ name: target.getAttribute('aria-label') || target.title || target.textContent.trim(),
        ...target.getBoundingClientRect().toJSON() }));
      const footerBox = footer?.getBoundingClientRect();
      const checks = {
        actual_surface_fits: !!surface && surface.getBoundingClientRect().left >= -1
          && surface.getBoundingClientRect().right <= innerWidth + 1,
        no_masked_horizontal_overflow: [surface, editor].every((node) => !!node && node.scrollWidth <= node.clientWidth + 1),
        every_actual_control_fits: boxes.length > 10 && boxes.every((box) => box.left >= -1 && box.right <= innerWidth + 1),
        every_target_is_touch_sized: boxes.every((box) => box.width >= 43.5 && box.height >= 43.5),
        footer_reachable: !!footerBox && footerBox.top >= 0 && footerBox.bottom <= innerHeight + 1,
      };
      await f.close();
      return { scenario, checks, badTargets: boxes.filter((box) => box.left < -1 || box.right > innerWidth + 1 || box.width < 43.5 || box.height < 43.5) };
    }, scenario);
    evidence.responsive.push(metric);
    for (const [name, result] of Object.entries(metric.checks)) check(`${scenario.language}_${scenario.width}_${name}`, result);
  }

  await page.setViewportSize({ width: 1600, height: 1000 });
  evidence.persistence = await page.evaluate(async () => {
    const f = window.__summary505;
    document.documentElement.style.fontSize = '';
    document.documentElement.removeAttribute('dark');
    f.card._config = { ...f.card._config, language: 'en' };
    await f.size('right');
    const key = f.localKey();
    localStorage.setItem(key, JSON.stringify({ version: 1, show: false, icon_scale: 1.75, font_scale: 1.25 }));
    localStorage.setItem('houseplan_card_kiosk_v1', JSON.stringify({ icon: .8, font: 2.2 }));
    f.card._summary.disconnect(); f.card._summary.connect(); await f.settle();
    const scales = () => {
      const local = JSON.parse(localStorage.getItem(key));
      return local.icon_scale === 1.75 && local.font_scale === 1.25
        && localStorage.getItem('houseplan_card_kiosk_v1') === '{"icon":0.8,"font":2.2}'
        && f.card._kioskScale.icon === 1.75 && f.card._kioskScale.font === 1.25;
    };
    const rows = [];
    for (const show of [false, true]) for (const mobile of [false, true]) {
      await f.open();
      const before = f.stored();
      await f.clickField('local', true);
      await f.clickField('mobile', mobile);
      await f.clickField('local', false);
      const disabled = f.field('mobile');
      disabled?.focus();
      const disabledCannotFocus = f.root().activeElement !== disabled;
      const preservedWhileOff = disabled?.disabled === true && disabled.checked === mobile;
      await f.clickField('local', true);
      const restored = f.field('mobile')?.disabled === false && f.field('mobile').checked === mobile;
      await f.clickField('local', show);
      const noOptimisticWrite = JSON.stringify(f.stored()) === JSON.stringify(before);
      // Force a genuine shared write even if this pair equals the previous pair.
      const title = f.dialog()?.querySelector('#summary-panel-title');
      if (title) { title.value = `Saved ${show}/${mobile}`; title.dispatchEvent(new Event('input', { bubbles: true, composed: true })); }
      await f.settle();
      const save = f.dialog()?.querySelector('[data-hp="dialog-confirm"]');
      save?.click(); await f.settle(); await f.pause(20); await f.settle();
      const committed = !f.dialog() && JSON.parse(localStorage.getItem(key)).show === show
        && f.card._serverCfg.settings.summary_panel.show_on_mobile === mobile;
      await f.open();
      const reopened = f.field('local')?.checked === show && f.field('mobile')?.checked === mobile
        && f.field('mobile')?.disabled === !show;
      const savedBeforeCancel = f.stored();
      await f.clickField('local', true); await f.clickField('mobile', !mobile); await f.clickField('local', !show);
      await f.close();
      const cancelUnchanged = !f.dialog() && JSON.stringify(f.stored()) === JSON.stringify(savedBeforeCancel);
      await f.open(); await f.clickField('local', !show); await f.close('x');
      const xUnchanged = !f.dialog() && JSON.stringify(f.stored()) === JSON.stringify(savedBeforeCancel);
      rows.push({ show, mobile, checks: { preservedWhileOff, disabledCannotFocus, restored,
        noOptimisticWrite, committed, reopened, cancelUnchanged, xUnchanged, scalesPreserved: scales() } });
    }
    return rows;
  });
  for (const row of evidence.persistence) for (const [name, value] of Object.entries(row.checks)) {
    check(`show_${row.show}_mobile_${row.mobile}_${name}`, value);
  }

  evidence.reload = [];
  for (const show of [false, true]) for (const mobile of [false, true]) {
    await page.evaluate(async ({ show, mobile }) => {
      const f = window.__summary505; await f.open();
      await f.clickField('local', true); await f.clickField('mobile', mobile); await f.clickField('local', show);
      const title = f.dialog()?.querySelector('#summary-panel-title');
      if (title) { title.value = `Reload ${show}/${mobile}`; title.dispatchEvent(new Event('input', { bubbles: true, composed: true })); }
      await f.settle(); await f.close('confirm');
    }, { show, mobile });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__card?._booting === false && !!window.__card?._summary);
    await installFixture();
    const row = await page.evaluate(async ({ show, mobile }) => {
      const f = window.__summary505; await f.open();
      const local = JSON.parse(localStorage.getItem(f.localKey()));
      const checks = {
        reload_restores_pair: f.field('local')?.checked === show && f.field('mobile')?.checked === mobile
          && f.field('mobile')?.disabled === !show,
        reload_preserves_old_scales: local.icon_scale === 1.75 && local.font_scale === 1.25
          && f.card._kioskScale.icon === 1.75 && f.card._kioskScale.font === 1.25,
      };
      window.__summary505BeforeEscape = f.stored();
      await f.clickField('local', true); await f.clickField('mobile', !mobile); await f.clickField('local', !show);
      return { show, mobile, checks };
    }, { show, mobile });
    await page.keyboard.press('Escape');
    row.checks.escape_discards_draft_without_writes = await page.evaluate(async () => {
      const f = window.__summary505; await f.settle();
      return !f.dialog() && JSON.stringify(f.stored()) === JSON.stringify(window.__summary505BeforeEscape);
    });
    evidence.reload.push(row);
    for (const [name, value] of Object.entries(row.checks)) check(`reload_${show}_${mobile}_${name}`, value);
  }

  evidence.titleOnly = await page.evaluate(async () => {
    const f = window.__summary505;
    const before = f.stored();
    await f.open();
    f.dialog()?.querySelector('[data-hp="dialog-confirm"]')?.click(); await f.settle();
    const unchangedSaveIsNoop = !!f.dialog() && JSON.stringify(f.stored()) === JSON.stringify(before);
    const title = f.dialog()?.querySelector('#summary-panel-title');
    if (title) { title.value = 'Only title changed'; title.dispatchEvent(new Event('input', { bubbles: true, composed: true })); }
    await f.settle(); await f.close('confirm');
    return { unchangedSaveIsNoop, titleOnlyLeavesLocalStorageIdentical: f.stored().local === before.local
      && f.stored().legacy === before.legacy && !f.dialog() };
  });
  checkAll(evidence.titleOnly);

  evidence.busy = await page.evaluate(async () => {
    const f = window.__summary505;
    await f.open();
    const originalWrite = f.card._sendConfigCandidate;
    const before = f.stored();
    const title = f.dialog()?.querySelector('#summary-panel-title');
    if (title) { title.value = 'Busy write'; title.dispatchEvent(new Event('input', { bubbles: true, composed: true })); }
    f.card._sendConfigCandidate = async (candidate) => {
      await new Promise((resolve) => { window.__summary505ReleaseWrite = resolve; });
      await originalWrite(candidate);
    };
    await f.settle(); f.dialog()?.querySelector('[data-hp="dialog-confirm"]')?.click(); await f.settle();
    window.__summary505OriginalWrite = originalWrite;
    return { both_toggles_native_disabled_while_saving: f.field('local')?.disabled === true && f.field('mobile')?.disabled === true,
      saving_does_not_optimistically_persist: JSON.stringify(f.stored()) === JSON.stringify(before) };
  });
  await page.keyboard.press('Escape');
  evidence.busy.escape_does_not_close_busy_dialog = await page.evaluate(async () => {
    const f = window.__summary505; await f.settle(); return !!f.dialog();
  });
  await page.evaluate(async () => {
    const f = window.__summary505; window.__summary505ReleaseWrite?.();
    await f.pause(20); await f.settle();
    f.card._sendConfigCandidate = window.__summary505OriginalWrite;
  });
  checkAll(evidence.busy);

  evidence.localOnly = await page.evaluate(async () => {
    const f = window.__summary505;
    const out = {};
    const original = { config: f.card._config, user: f.card.hass.user, settings: f.card._serverCfg.settings };
    for (const role of ['household', 'kiosk', 'backend', 'future']) {
      f.card._serverCanWrite = role !== 'household';
      f.card._config = { ...original.config, kiosk: role === 'kiosk' };
      f.card._haSummaryPanelApi = role === 'backend' ? 0 : 1;
      const settings = role === 'future' ? { ...original.settings,
        summary_panel: { version: 99, title: 'Opaque future', blocks: [] } } : original.settings;
      f.card._serverCfg = { ...f.card._serverCfg, settings }; f.card._settings = settings;
      f.card.requestUpdate(); await f.settle(); await f.open();
      const before = f.stored();
      const editor = f.dialog()?.querySelector('.summary-editor');
      const current = f.field('local')?.checked;
      out[`${role}_has_only_local_controls`] = !!f.field('local') && !!editor?.querySelector('.summary-local-hint')
        && !f.field('mobile') && !editor.querySelector('input[type="text"], select, .summary-editor-blocks, input[type="range"]');
      await f.clickField('local', !current); await f.close();
      out[`${role}_cancel_preserves_all_storage`] = JSON.stringify(f.stored()) === JSON.stringify(before);
      await f.open(); await f.clickField('local', !current); await f.close('confirm');
      const local = JSON.parse(localStorage.getItem(f.localKey()));
      out[`${role}_save_is_local_and_preserves_scales`] = !f.dialog() && f.stored().server === before.server
        && f.stored().legacy === before.legacy && local.show === !current
        && local.icon_scale === 1.75 && local.font_scale === 1.25;
    }
    return out;
  });
  checkAll(evidence.localOnly);
  check('storage_unavailable_warning_survives_size_control_removal', await page.evaluate(async () => {
    const f = window.__summary505;
    const key = f.localKey();
    const originalGetItem = Storage.prototype.getItem;
    try {
      Storage.prototype.getItem = function (requested) {
        if (requested === key) throw new DOMException('Fixture storage denial', 'SecurityError');
        return originalGetItem.call(this, requested);
      };
      f.card._summary.disconnect(); f.card._summary.connect(); await f.settle(); await f.open();
      return f.dialog()?.textContent.includes(f.card._summary.t('summary.storage_unavailable')) === true
        && !f.dialog()?.querySelector('input[type="range"]');
    } finally {
      Storage.prototype.getItem = originalGetItem;
      await f.close();
    }
  }));
} finally {
  await finish(browser, evidence);
}
