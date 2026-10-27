// #1093 group B: trusted native input and browser-side request/ACK/paint clocks.
// Only the declared fixture delay is subtracted; persisted reads run after paint.
import assert from 'node:assert/strict';

export async function runHistoryTiming({ page, card, delay, iterations, onSample = () => {} }) {
  assert.ok(Number.isInteger(iterations) && iterations > 0);
  assert.ok(Number.isFinite(delay) && delay >= 0);
  const samples = [];
  const persisted = () => page.evaluate(async () => {
    const c = window.__card;
    const cfg = await c.hass.callWS({ type: 'houseplan/config/get' });
    const layout = await c.hass.callWS({ type: 'houseplan/layout/get' });
    return { config: cfg.config, layout: layout.layout };
  });
  const settle = () => page.waitForFunction(() => {
    const c = window.__card;
    return !c._devicePositionBusy && !c._modeTransitionBusy && !c._modeTransitionPreparing;
  });
  await page.evaluate(async () => {
    window.__save1093 = undefined;
    await window.__hpTest.setMode('devices');
    await window.__hpTest.waitForWrites();
    await window.__card.updateComplete;
  });
  await settle();
  await card.locator('[data-hp="zoom-fit"]').click();
  const baseline = await persisted();
  await page.evaluate(() => {
    const c = window.__card, original = c.hass.callWS;
    const counters = () => ({ floor: { ...c._floorCacheBuilds },
      contacts: { ...c._deviceContacts.work }, live: c._liveRt.work(),
      spaceModels: c._spaceModels.work.builds, visible: c.renderRoot.querySelectorAll('[data-hp="device"]').length });
    const state = { sample: null, frame: 0, original, counters };
    window.__historyTiming1093 = state;
    const onInput = event => {
      const p = state.sample;
      if (!p || p.input !== undefined || !event.isTrusted) return;
      const matches = event.composedPath().some(n => p.action === 'copy'
        ? n?.getAttribute?.('data-hp') === 'device-copy'
        : p.action === 'delete' ? n?.getAttribute?.('data-hp') === 'dialog-confirm'
          : n?.getAttribute?.('data-device-position-history') === p.action);
      if (!matches) return;
      p.input = performance.now(); p.trusted = true; p.before = counters();
      const observe = async () => {
        if (state.sample !== p || p.paint !== undefined) return;
        if (p.ack !== undefined && !c._devicePositionBusy) {
          await c.updateComplete;
          if (state.sample !== p) return;
          const marker = c._serverCfg?.markers?.find(m => m.id === p.id && !m.removed);
          const expected = p.response?.config?.markers?.find(m => m.id === p.id && !m.removed);
          const node = c.renderRoot.querySelector(`[data-hp="device"][data-id="${CSS.escape(p.id)}"]`);
          const correct = !!marker === p.present && !!node === p.present
            && JSON.stringify(marker) === JSON.stringify(expected)
            && JSON.stringify(c._layout[p.id]) === JSON.stringify(p.response?.layout?.[p.id]);
          if (correct && !c._devicePositionBusy) {
            // The next animation frame follows the verified Lit DOM commit.
            state.frame = requestAnimationFrame(() => {
              if (state.sample !== p) return;
              p.paint = performance.now(); p.after = counters();
              p.profile = p.action === 'copy' ? structuredClone(c._editorRuntime?.deviceCopy.lastProfile) : null;
              p.dom = { present: !!node, transform: node?.getAttribute('transform') || null };
            });
            return;
          }
        }
        state.frame = requestAnimationFrame(observe);
      };
      state.frame = requestAnimationFrame(observe);
    };
    state.onInput = onInput;
    c.addEventListener('pointerdown', onInput, true);
    state.wrapped = async message => {
      const p = state.sample;
      if (p?.input !== undefined && (message.type === 'houseplan/marker/copy'
          || message.type === 'houseplan/marker/history')) {
        p.requests++;
        if (p.request === undefined) p.request = performance.now();
        p.wire = { type: message.type, action: message.action || 'copy' };
        if (message.type === 'houseplan/marker/copy') p.id = message.marker.id;
        if (p.delay) await new Promise(resolve => setTimeout(resolve, p.delay));
        try {
          const response = await original(message);
          p.ack = performance.now(); p.response = structuredClone(response);
          return response;
        } catch (error) { p.error = String(error); throw error; }
      }
      return original(message);
    };
    c.hass = { ...c.hass, callWS: state.wrapped };
  });
  const measure = async (action, id, present, iteration, click) => {
    await settle();
    await page.evaluate(({ action, id, present, iteration, delay }) => {
      window.__historyTiming1093.sample = { action, id, present, iteration, delay, requests: 0 };
    }, { action, id, present, iteration, delay });
    await click();
    try {
      await page.waitForFunction(() => window.__historyTiming1093.sample.paint !== undefined, null, { timeout: 15000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({ sample: window.__historyTiming1093.sample,
        copy: window.__card._editorRuntime?.deviceCopy.lastProfile,
        busy: window.__card._devicePositionBusy,
        notices: [...window.__card.renderRoot.querySelectorAll('[data-hp="toast"]')].map(n => n.textContent) }));
      throw new Error(`Native ${action} did not produce a correct frame: ${JSON.stringify(diagnostic)}`, { cause: error });
    }
    const sample = await page.evaluate(() => {
      const p = window.__historyTiming1093.sample;
      const result = { ...p, response: undefined,
        longTasks: window.__long1093.filter(t => t.start < p.paint && t.start + t.duration > p.input),
        inputToRequest: p.request - p.input, ackToPaint: p.paint - p.ack,
        client: p.paint - p.input - p.delay };
      window.__historyTiming1093.sample = null;
      return result;
    });
    assert.equal(sample.trusted, true);
    assert.equal(sample.requests, 1, 'one fixed fixture delay, no retry hidden by subtraction');
    assert.equal(sample.wire.action, action);
    assert.ok(sample.input <= sample.request && sample.request <= sample.ack && sample.ack <= sample.paint);
    for (const key of ['wallUnion','physicalBodies','cleanFloor','openingWallIndex'])
      assert.equal(sample.after.floor[key], sample.before.floor[key], `${action}: unchanged floor ${key}`);
    assert.equal(sample.after.spaceModels, sample.before.spaceModels, `${action}: unchanged scaled floor model`);
    const actual = await persisted();
    assert.equal(actual.config.markers.some(m => m.id === sample.id && !m.removed), present);
    assert.equal(Object.hasOwn(actual.layout, sample.id), present);
    sample.persisted = true;
    if (action === 'copy') { assert.equal(sample.profile?.outcome, 'accepted'); assert.equal(sample.profile.files, false); }
    samples.push(sample); onSample(sample);
    return { sample, actual };
  };
  try {
    for (let iteration = 0; iteration < iterations; iteration++) {
      await card.locator('[data-hp="device"][data-id="load-0"]').click({ button: 'right' });
      const copied = await measure('copy', null, true, iteration,
        () => card.locator('[data-hp="device-copy"]').click());
      const id = copied.sample.id;
      await measure('undo', id, false, iteration,
        () => card.locator('[data-device-position-history="undo"]').click());
      const redone = await measure('redo', id, true, iteration,
        () => card.locator('[data-device-position-history="redo"]').click());
      assert.deepEqual(redone.actual.config.markers.find(m => m.id === id), copied.actual.config.markers.find(m => m.id === id));
      assert.deepEqual(redone.actual.layout[id], copied.actual.layout[id]);
      await card.locator(`[data-hp="device"][data-id="${id}"]`).click();
      await card.locator('[data-action="marker-delete"]:visible,[data-action="properties-delete"]:visible').click();
      const deleted = await measure('delete', id, false, iteration,
        () => card.locator('hp-confirm [data-hp="dialog-confirm"]').click());
      assert.deepEqual(deleted.actual.config.markers, baseline.config.markers, 'cycle restores original marker records');
      assert.deepEqual(deleted.actual.layout, baseline.layout, 'cycle restores original positions');
    }
    return samples;
  } finally {
    await page.evaluate(() => {
      const c = window.__card, s = window.__historyTiming1093;
      cancelAnimationFrame(s.frame); c.removeEventListener('pointerdown', s.onInput, true);
      if (c.hass.callWS === s.wrapped) c.hass = { ...c.hass, callWS: s.original };
      delete window.__historyTiming1093;
    });
  }
}
