import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const calls = [];
  c.hass = { ...c.hass, callService: (d, s, data) => { calls.push([d, s, data.entity_id]); return Promise.resolve(); } };
  // два подопытных light-entity
  const lights = Object.keys(c.hass.states).filter((e) => e.startsWith('light.')).slice(0, 2);
  out.twoLights = lights.length === 2;
  const setSt = async (m) => {
    const st = { ...c.hass.states };
    for (const [e, v] of Object.entries(m)) st[e] = { ...st[e], state: v };
    c.hass = { ...c.hass, states: st }; await c.updateComplete;
  };
  // виртуальный маркер-выключатель с controls и tap_action=toggle
  c._setMode('devices'); await c.updateComplete;
  c._openMarkerDialog();
  const room = c._spaceModel().rooms.find((r) => r.id && r.area);
  c._markerDialog = { ...c._markerDialog, name: 'Выключатель', binding: 'virtual',
    room: c._space + '#' + room.area, tapAction: 'toggle', controls: lights,
    icon: 'mdi:light-switch', display: 'icon_ripple' };
  await c._saveMarker(); await c.updateComplete;
  const dev = c._devices.find((d) => d.name === 'Выключатель');
  out.markerSaved = !!dev && JSON.stringify(dev.marker.controls) === JSON.stringify(lights);

  // #84: a forced plan source without its own HA entity is selectable as a
  // target and marker:* never leaks into the controller's HA service list.
  const passiveId = 'smoke_passive_lamp';
  c._serverCfg.markers.push({
    id: passiveId, binding: 'virtual', name: 'Passive lamp', is_light: true,
    space: c._space, area: room.area,
  });
  c._regSignature = ''; c._maybeRebuildDevices(); await c.updateComplete;
  const controller = c._devices.find((item) => item.id === dev.id);
  c._openMarkerDialog(controller); await c.updateComplete;
  c._markerDialog = { ...c._markerDialog, controlsFilter: 'Passive lamp' };
  await c.updateComplete;
  const planCandidate = c._controlCandidates(c._markerDialog)
    .find((candidate) => candidate.value === `marker:${passiveId}`);
  out.passivePlanSourceCandidate = !!planCandidate;
  c._addControlRef(c._markerDialog, `marker:${passiveId}`); await c.updateComplete;
  out.passiveRefStoredInDraft = c._markerDialog.controls.includes(`marker:${passiveId}`);
  c._markerDialog = null;
  c._setMode('view'); await c.updateComplete;
  // 1) все выключены → клик включает все
  await setSt({ [lights[0]]: 'off', [lights[1]]: 'off' });
  const dev2 = () => c._devices.find((d) => d.name === 'Выключатель');
  c._clickDevice(new MouseEvent('click'), dev2());
  out.turnOnAll = JSON.stringify(calls.at(-1)) === JSON.stringify(['homeassistant', 'turn_on', lights]);
  // 2) частично включено → клик выключает все
  await setSt({ [lights[0]]: 'on', [lights[1]]: 'off' });
  c._clickDevice(new MouseEvent('click'), dev2());
  out.partialTurnsOff = JSON.stringify(calls.at(-1)) === JSON.stringify(['homeassistant', 'turn_off', lights]);
  // 3) значок отражает цели: горит одна → класс on
  const el = [...sr().querySelectorAll('.dev')].find((e) => e.title === 'Выключатель' || e.textContent.includes(''));
  out.stateOn = !!c._stateClass(dev2()).includes('on');
  out.aggregateActivityRuns = c._stateClass(dev2()).includes('activity-running');
  await setSt({ [lights[0]]: 'off' });
  out.stateOff = c._stateClass(dev2()) === '';
  // 4) без tap_action=toggle клик НЕ переключает (инфо)
  const cfg = c._serverCfg.markers.find((m) => m.name === 'Выключатель');
  cfg.tap_action = 'info'; c._regSignature = ''; c._maybeRebuildDevices(); await c.updateComplete;
  const n = calls.length;
  c._clickDevice(new MouseEvent('click'), dev2());
  out.infoNoToggle = calls.length === n && !!c._infoCard;
  // 5) инфо-карточка показывает цели
  await c.updateComplete;
  out.infoListsTargets = sr().querySelectorAll('.ctrlstate').length === 2;
  c._infoCard = null; await c.updateComplete;
  // 6) замок в controls отфильтрован при клике (защита)
  cfg.tap_action = 'toggle'; cfg.controls = ['lock.front_door', lights[0]];
  c._regSignature = ''; c._maybeRebuildDevices(); await c.updateComplete;
  await setSt({ [lights[0]]: 'off' });
  c._clickDevice(new MouseEvent('click'), dev2());
  const last = calls.at(-1);
  out.lockFiltered = JSON.stringify(last) === JSON.stringify(['homeassistant', 'turn_on', [lights[0]]]);

  // Opening and saving must not rewrite configuration that runtime cannot
  // currently execute: YAML-only domains and duplicates are still user data.
  const losslessControls = [lights[0], 'input_boolean.yaml_only', lights[0], 'sensor.vendor_option'];
  cfg.controls = [...losslessControls];
  c._regSignature = ''; c._maybeRebuildDevices(); await c.updateComplete;
  c._openMarkerDialog(dev2()); await c.updateComplete;
  out.dialogKeepsUnknownAndDuplicateControls = JSON.stringify(c._markerDialog?.controls)
    === JSON.stringify(losslessControls);
  await c._saveMarker(); await c.updateComplete;
  const savedLossless = c._serverCfg.markers.find((m) => m.name === 'Выключатель')?.controls;
  out.saveKeepsUnknownAndDuplicateControls = JSON.stringify(savedLossless)
    === JSON.stringify(losslessControls);

  // Legacy configs could store a standalone entity as its own external
  // control. That self-reference must neither become a light source/group nor
  // disappear behind ambiguous dialog UI. Its normal Toggle action still
  // operates the entity, and an ON hood/fan still has working-state yellow.
  const own = Object.keys(c.hass.states).find((eid) => eid.startsWith('switch.'));
  out.hasStandaloneSwitch = !!own;
  const self = own && {
    id: 'self-control-regression', name: 'Hood', icon: 'mdi:fan',
    space: c._space, area: room.area, entities: [own], primary: own,
    bindingKind: 'entity', bindingRef: own, tapAction: 'toggle',
    marker: { id: 'self-control-regression', binding: `entity:${own}`, controls: [own] },
  };
  if (self) {
    await setSt({ [own]: 'off' });
    c._clickDevice(new MouseEvent('click'), self);
    out.selfControlUsesDirectToggle = JSON.stringify(calls.at(-1))
      === JSON.stringify(['homeassistant', 'toggle', own]);
    c._openMarkerDialog(self); await c.updateComplete;
    out.selfControlAbsentFromDialog = c._markerDialog?.controls.length === 0;
    c._markerDialog = null;
    await setSt({ [own]: 'on' });
    out.selfSwitchStillShowsWorkingState = c._stateClass(self).includes('on');
  }
  return out;
});
checkAll(res);
await finish(browser, res);
