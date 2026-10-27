// #1093: real HA row/registry/authority updates against the rendered card.
// Fixture writes use the existing public harness; observations never write product internals.
import assert from 'node:assert/strict';

export async function runLiveInvalidationWitnesses({ page, card }) {
  const results = {};
  const tick = () => page.evaluate(async () => {
    await window.__card.updateComplete;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const counters = () => page.evaluate(() => {
    const c = window.__card;
    return { floor: { ...c._floorCacheBuilds }, contacts: { ...c._deviceContacts.work },
      snapshot: c._liveRt.work(), models: c._spaceModels.work.builds };
  });
  const face = id => card.locator(`[data-hp="device"][data-id="${id}"]`);
  const value = id => face(id).locator('.valtext').textContent();
  const row = async (id, patch) => {
    await page.evaluate(({ id, patch }) => {
      const c = window.__card, previous = c.hass.states[id];
      c.hass = { ...c.hass, states: { ...c.hass.states,
        [id]: { ...previous, ...patch, attributes: { ...previous.attributes, ...patch.attributes } } } };
    }, { id, patch });
    await tick();
  };
  const noPhysics = (before, after, label) => {
    for (const key of ['wallUnion', 'physicalBodies', 'cleanFloor', 'openingWallIndex'])
      assert.equal(after.floor[key], before.floor[key], `${label}: ${key}`);
    assert.equal(after.contacts.rebuilds, before.contacts.rebuilds, `${label}: contacts`);
    assert.equal(after.models, before.models, `${label}: scaled models`);
  };
  await page.evaluate(async () => {
    const c = window.__card;
    window.__liveWitness1093 = { hass: c.hass, config: structuredClone(c._serverCfg),
      layout: structuredClone(c._layout), visibility: Object.getOwnPropertyDescriptor(document, 'visibilityState'), registryDisabled: false, registryReads: [] };
    // Install the controllable backend before this new connection subscribes:
    // registry callbacks correctly retain the connection's original client.
    const original = c.hass.callWS, fixture = window.__liveWitness1093;
    c.hass = { ...c.hass, connection: { ...c.hass.connection }, callWS: async message => {
      const response = await original(message);
      if(message.type === 'config/entity_registry/list') fixture.registryReads.push(fixture.registryDisabled);
      return message.type === 'config/entity_registry/list' && fixture.registryDisabled
        ? response.map(row => row.entity_id === 'sensor.load_1' ? { ...row, disabled_by: 'user' } : row) : response;
    } };
    await window.__hpTest.setMode('view');
    await window.__hpTest.switchSpace('f1');
  });
  await tick();
  try {
    let before = await counters();
    const originalText = await value('load-1');
    // dev-213 has no plan marker; load_1500 is a real sibling of visible dev-2.
    await row('sensor.load_1497', { state: '876', attributes: { unrelated_revision: 'changed' } });
    let after = await counters();
    assert.equal(await value('load-1'), originalText);
    noPhysics(before, after, 'unrelated HA entity');
    assert.equal(after.snapshot.presentations, before.snapshot.presentations, 'unrelated row resolves no visible face');
    results.unrelated = { before, after };

    before = await counters();
    await row('sensor.load_1', { state: '37' });
    after = await counters();
    assert.match(await value('load-1'), /37/);
    noPhysics(before, after, 'numeric state');
    assert.ok(after.snapshot.presentations - before.snapshot.presentations <= 2,
      'one numeric source changes at most its two presentation variants');
    results.numeric = { before, after, text: await value('load-1') };

    await page.evaluate(async () => {
      await window.__hpTest.setServerConfig(cfg => {
        cfg.markers.find(m => m.id === 'load-1').value_source = {
          kind: 'entity_attribute', entity_id: 'sensor.load_1', attribute: 'reading',
        };
        return cfg;
      });
    });
    await row('sensor.load_1', { attributes: { reading: 41 } });
    assert.match(await value('load-1'), /41/);
    before = await counters();
    await row('sensor.load_1', { attributes: { reading: 42 } });
    after = await counters();
    assert.match(await value('load-1'), /42/);
    noPhysics(before, after, 'referenced attribute');
    results.attribute = { before, after, text: await value('load-1') };
    before = await counters();
    await row('sensor.load_1', { attributes: { unrelated_note: 'new metadata' } });
    after = await counters();
    assert.match(await value('load-1'), /42/);
    noPhysics(before, after, 'unrelated attribute on referenced row');
    assert.ok(after.snapshot.presentations - before.snapshot.presentations <= 2,
      'conservative row dependency must not resolve unrelated devices');
    results.sameRowUnrelated = { before, after };

    before = await counters();
    await row('sensor.load_130', { state: '73' });
    after = await counters();
    noPhysics(before, after, 'inactive-floor HA state');
    assert.equal(after.snapshot.presentations, before.snapshot.presentations);
    await page.evaluate(() => window.__hpTest.switchSpace('f2'));await tick();
    assert.match(await value('load-130'), /73/);
    results.inactiveLatest = { before, after, text: await value('load-130') };
    await page.evaluate(() => window.__hpTest.switchSpace('f1'));await tick();

    // Hidden demand defers rendering, but must preserve the latest relevant row.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    before = await counters();
    await row('sensor.load_1', { attributes: { reading: 43 } });
    after = await counters();
    noPhysics(before, after, 'hidden HA state');
    assert.deepEqual(after.snapshot, before.snapshot, 'hidden document starts no live snapshot work');
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });await tick();
    assert.match(await value('load-1'), /43/);
    results.hiddenLatest = { before, after, text: await value('load-1') };

    // An actual hidden relay is a positive dependency of a visible passive lamp.
    await page.evaluate(async () => {
      const c = window.__card, id = 'switch.live_witness_1093';
      c.hass = { ...c.hass, entities: { ...c.hass.entities,
        [id]: { entity_id: id, device_id: 'dev-0', platform: 'demo', unique_id: id } },
        states: { ...c.hass.states, [id]: { entity_id: id, state: 'off',
          attributes: { friendly_name: 'Hidden live relay' } } } };
      await window.__hpTest.setServerConfig(cfg => ({ ...cfg, markers: [...cfg.markers,
        { id: 'live-driver-1093', binding: `entity:${id}`, space: 'f1', name: 'Hidden relay', hidden: true,
          controls: ['marker:live-lamp-1093'] },
        { id: 'live-lamp-1093', binding: 'virtual', space: 'f1', name: 'Visible linked lamp', is_light: true },
      ] }));
      await window.__hpTest.setLayout(layout => ({ ...layout,
        'live-driver-1093': { s: 'f1', x: .87, y: .9 }, 'live-lamp-1093': { s: 'f1', x: .93, y: .9 } }));
    });await tick();
    assert.equal(await face('live-driver-1093').count(), 0);
    assert.equal(await face('live-lamp-1093').evaluate(n => n.classList.contains('on')), false);
    before = await counters();await row('switch.live_witness_1093', { state: 'on' });after = await counters();
    assert.equal(await face('live-lamp-1093').evaluate(n => n.classList.contains('on')), true);
    noPhysics(before, after, 'hidden linked relay');
    results.hiddenDriver = { before, after, className: await face('live-lamp-1093').getAttribute('class') };

    // Full registry authority arrives through its real subscription + WS read;
    // the thin hass.entities projection cannot override a known full snapshot.
    await page.evaluate(() => {
      const c = window.__card, id = 'sensor.load_1';
      window.__liveWitness1093.registryDisabled = true;
      window.__addRegistryEntity(id, null, c.hass.states[id].state, 'demo',
        { ...c.hass.entities[id], disabled_by: 'user' }, c.hass.states[id].attributes);
    });
    await face('load-1').waitFor({ state: 'hidden' });await tick();
    assert.equal(await face('load-1').count(), 0, 'HA-disabled device is hidden in ordinary View');
    await page.evaluate(() => {
      window.__liveWitness1093.registryDisabled = false;
      window.__setRegistryDisabled('entity', 'sensor.load_1', null);
    });
    await face('load-1').waitFor({ state: 'visible' });await tick();
    assert.match(await value('load-1'), /43/, 'registry re-enable restores the latest live value');
    results.registryDisabled = true;

    assert.ok(await card.locator('[data-hp="mode-tab"]').count() > 0);
    await page.evaluate(() => {
      const c = window.__card, original = c.hass.callWS;
      c.hass = { ...c.hass, user: { ...c.hass.user, id: 'live-reader-1093', is_admin: false },
        callWS: async message => {
          const response = await original(message);
          return message.type === 'houseplan/config/get' ? { ...response, can_write: false } : response;
        } };
    });
    await page.waitForFunction(() => window.__card._canEdit === false);await tick();
    assert.equal(await card.locator('[data-hp="mode-tab"]').count(), 0, 'new read-only authority removes actual editor entry points');
    assert.ok(await face('load-1').count());
    results.aclReadOnly = true;
    return results;
  } catch (error) {
    error.liveWitnesses = results;
    error.liveDiagnostics = await page.evaluate(() => ({ registry: window.__card._haRegistry.entities?.['sensor.load_1'], binding: window.__card._devices.find(d => d.id === 'load-1')?.bindingStatus, registryReads: window.__liveWitness1093.registryReads }));
    throw error;
  } finally {
    await page.evaluate(async () => {
      const c = window.__card, initial = window.__liveWitness1093;
      if (initial.visibility) Object.defineProperty(document, 'visibilityState', initial.visibility);
      else delete document.visibilityState;
      document.dispatchEvent(new Event('visibilitychange'));
      c.hass = initial.hass;
      await window.__hpTest.setServerConfig(initial.config);
      await window.__hpTest.setLayout(initial.layout);
      await window.__hpTest.switchSpace('f1');
      delete window.__liveWitness1093;
    });await tick();
  }
}
