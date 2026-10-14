import { launch, check, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 1000, height: 820 });
try {
  await page.evaluate(() => {
    const card = window.__card, original = card.hass.callService;
    window.__fixtureProof = { original, wrapped: [] };
    const wrapper = async (...args) => { window.__fixtureProof.wrapped.push(structuredClone(args)); return original(...args); };
    window.__fixtureProof.wrapper = wrapper;
    card.hass = { ...card.hass, callService: wrapper };
  });
  const marker = page.locator('houseplan-card').locator('[data-hp="device"][data-id="d_light1"]');
  for (let index = 0; index < 3; index++) {
    await marker.click();
    await page.waitForFunction(count => window.__serviceCalls.length === count, index + 1);
  }
  const positive = await page.evaluate(() => ({ calls: window.__serviceCalls, wrapped: window.__fixtureProof.wrapped,
    sameWrapper: window.__card.hass.callService === window.__fixtureProof.wrapper,
    sameMethod: window.__mkHass().callService === window.__fixtureProof.original,
    state: window.__card.hass.states['light.ceiling'].state }));
  const expected = ['turn_off', 'turn_on', 'turn_off'].map(service => ['light', service, { entity_id: 'light.ceiling' }]);
  check('#896 three real marker actions: recorder exact parameters and order', positive.calls, expected);
  check('#896 delegated wrapper survives all state events', positive.wrapped, expected);
  check('#896 mkHass retains method identity', positive.sameMethod);
  check('#896 installed current-session wrapper retained', positive.sameWrapper);
  check('#896 synthetic toggle semantics unchanged', positive.state, 'off');

  const box = await marker.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const point = (id, dx = 0) => ({ id, x: x + dx, y, radiusX: 2, radiusY: 2, force: 1 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1), point(2, 45)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await page.waitForTimeout(100);
  check('#896 cancelled native multitouch dispatches zero', await page.evaluate(() => window.__serviceCalls.length), 3);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.waitForFunction(() => !!window.__card.shadowRoot.querySelector('hp-dialog'), null, { timeout: 1500 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  check('#896 held gesture opens information but dispatches zero', await page.evaluate(() => window.__serviceCalls.length), 3);
  await cdp.detach();

  const persistence = await page.evaluate(async () => {
    const h = window.__mkHass(), read = type => h.callWS({ type });
    const originalConfig = await read('houseplan/config/get'), originalLayout = await read('houseplan/layout/get');
    const candidate = structuredClone(originalConfig.config);
    candidate.spaces[0].title = 'Persisted fixture floor'; candidate.future = { untouched: ['extension'] };
    const configAck = await h.callWS({ type: 'houseplan/config/set', expected_rev: originalConfig.rev, config: candidate });
    const layout = { ...originalLayout.layout, extra_fixture: { s: 'f1', x: .3, y: .4, future: 'retained' } };
    const setAck = await h.callWS({ type: 'houseplan/layout/set', expected_rev: originalLayout.rev, layout });
    const pos = { s: 'f1', x: .31, y: .41, unknown: { keep: true } };
    const updateAck = await h.callWS({ type: 'houseplan/layout/update', device_id: 'd_light1', pos });
    const deleteAck = await h.callWS({ type: 'houseplan/layout/delete', device_id: 'extra_fixture' });
    const cfg = await read('houseplan/config/get'), saved = await read('houseplan/layout/get');
    const expectedLayout = { ...originalLayout.layout, d_light1: pos };
    const pair = JSON.stringify([cfg, saved]);
    let conflict = false, refused = false;
    try { await h.callWS({ type: 'houseplan/config/set', expected_rev: originalConfig.rev, config: candidate }); }
    catch (error) { conflict = error.code === 'conflict'; }
    const refusing = { ...h, callWS: async message => {
      if (message.type.endsWith('/set')) throw new Error('injected transport refusal'); return h.callWS(message);
    } };
    try { await refusing.callWS({ type: 'houseplan/layout/set', expected_rev: saved.rev, layout: {} }); }
    catch { refused = true; }
    const unchanged = JSON.stringify([await read('houseplan/config/get'), await read('houseplan/layout/get')]) === pair;
    const second = document.createElement('houseplan-card');
    second.setConfig({ type: 'custom:houseplan-card' }); document.body.append(second); second.hass = h;
    const started = performance.now();
    while (!second._loadOk || JSON.stringify(second._serverCfg) !== JSON.stringify(candidate)) {
      if (performance.now() - started > 4000) throw new Error('cold second card did not accept saved pair');
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const coldExact = JSON.stringify(second._serverCfg) === JSON.stringify(candidate)
      && JSON.stringify(second._layout) === JSON.stringify(expectedLayout);
    second.remove();
    return { savedConfig: JSON.stringify(cfg.config) === JSON.stringify(candidate),
      savedLayout: JSON.stringify(saved.layout) === JSON.stringify(expectedLayout), coldExact, conflict, refused, unchanged,
      revs: [configAck.rev - originalConfig.rev, cfg.rev - originalConfig.rev,
        setAck.rev - originalLayout.rev, updateAck.rev - originalLayout.rev, deleteAck.rev - originalLayout.rev,
        saved.rev - originalLayout.rev] };
  });
  for (const key of ['savedConfig', 'savedLayout', 'coldExact', 'conflict', 'refused', 'unchanged'])
    check(`#896 fixture ${key}`, persistence[key]);
  check('#896 independent revisions advance once per actual write', persistence.revs, [1, 1, 1, 2, 3, 3]);
} finally { await finish(browser); }
