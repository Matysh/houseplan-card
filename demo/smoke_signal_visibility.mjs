// #876: real form controls, server events and independent full/static consumers.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const card = window.__card, hp = window.__hpTest;
  const root = () => card.shadowRoot;
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const wait = async (predicate, label) => {
    const end = performance.now() + 10000;
    while (!predicate()) {
      if (performance.now() > end) throw new Error(`signal visibility: ${label}`);
      await frame();
    }
    await hp.settled();
  };
  const dialog = kind => root().querySelector(`hp-dialog[data-kind="${kind}"]`);
  const shown = c => [...c.shadowRoot.querySelectorAll('.dev .lqi')].map(n => n.textContent.trim()).sort();
  const results = {};
  const accepted = async patch => hp.setServerConfig(cfg => { patch(cfg); return cfg; });
  await accepted(cfg => {
    for (const space of cfg.spaces) space.settings = { ...space.settings, show_names: true, label_lqi: true };
    delete cfg.settings.show_lqi;
  });
  await hp.setMode('devices');
  const openGeneral = async () => {
    root().querySelector('[data-hp="settings"]').click();
    await wait(() => dialog('settings')?.querySelector('#gs-show-lqi'), 'general form opens');
    return dialog('settings');
  };
  const save = async kind => {
    const button = dialog(kind).querySelector('[data-hp="dialog-confirm"]');
    if (button.disabled) throw new Error(`signal visibility: ${kind} Save disabled: ${dialog(kind).textContent}`);
    button.click();
    await wait(() => !dialog(kind), `${kind} accepted save closes`);
    await hp.waitForWrites();
  };
  let general = await openGeneral();
  const globalInput = general.querySelector('#gs-show-lqi');
  results.globalDefaultOn = globalInput.checked;
  const battery = general.querySelector('[name="gs-device-battery"]');
  results.globalImmediatelyAfterBattery = !!battery
    && !!(battery.closest('.hpf-field').compareDocumentPosition(globalInput.closest('.hpf-toggle')) & Node.DOCUMENT_POSITION_FOLLOWING)
    && globalInput.closest('.hpf-toggle').previousElementSibling?.contains(battery);
  results.globalLocalized = globalInput.closest('.hpf-toggle').textContent.includes('Show Zigbee signal');
  await hp.close(general, { via: 'cancel' });
  await hp.setMode('view');
  const before = shown(card);
  results.initialSignalVisible = before.includes('196') && before.includes('154');

  const peer = document.createElement('houseplan-card');
  peer.setConfig({ type: 'custom:houseplan-card', title: 'Peer', show_signal: true });
  peer.hass = card.hass;
  document.body.append(peer);
  await wait(() => peer.shadowRoot?.querySelector('.dev .lqi'), 'peer initial signal');
  await import('/assets/houseplan-card.js');
  const mini = document.createElement('houseplan-space-card');
  mini.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', show_signal: true });
  mini.hass = card.hass;
  document.body.append(mini);
  await wait(() => mini.shadowRoot?.querySelector('.dev .lqi'), 'static initial signal');

  await hp.setMode('devices');
  general = await openGeneral();
  general.querySelector('#gs-show-lqi').click();
  await hp.settled();
  await save('settings');
  await hp.setMode('view');
  await wait(() => shown(peer).length === 0 && shown(mini).length === 0, 'peer/static accepted off event');
  results.sharedGlobalOff = card._serverCfg.settings.show_lqi === false && shown(card).length === 0;
  results.peerAndStaticOff = shown(peer).length === 0 && shown(mini).length === 0;
  const lampNode = root().querySelector('[data-hp="device"][data-id="d_lamp"]');
  lampNode.dispatchEvent(new PointerEvent('pointermove', {
    bubbles: true, composed: true, pointerType: 'mouse', clientX: 200, clientY: 200,
  }));
  await hp.settled();
  results.tooltipOff = !!root().querySelector('.tip') && !root().querySelector('.tip').textContent.includes('LQI 196');
  results.roomMetricIndependent = !!root().querySelector('[data-hp="room-label"] .lqi,.room-metric-lqi')
    || [...root().querySelectorAll('[data-hp="room-label"]')].some(n => n.textContent.includes('175'));
  await hp.setVolumetricView(true);
  results.isoGlobalOff = root().querySelector('.projection-iso') != null && shown(card).length === 0;
  await hp.setVolumetricView(false);
  const kiosk = document.createElement('houseplan-card');
  kiosk.setConfig({ type: 'custom:houseplan-card', kiosk: true, show_signal: true });
  kiosk.hass = card.hass;
  document.body.append(kiosk);
  await wait(() => kiosk.shadowRoot?.querySelector('.dev'), 'kiosk loads');
  results.kioskGlobalOff = shown(kiosk).length === 0;
  kiosk._openSettingsDialog();
  await kiosk.updateComplete;
  results.kioskCannotOpenGeneral = !kiosk.shadowRoot.querySelector('hp-dialog[data-kind="settings"]');

  await hp.setMode('devices');
  let markerForm = await hp.openMarkerDialog('d_lamp');
  const preview = () => markerForm.querySelector('hp-device-preview');
  await wait(() => preview()?.shadowRoot?.querySelector('.dev'), 'marker preview paints');
  results.previewGlobalOff = !preview().shadowRoot.querySelector('.lqi');
  await hp.close(markerForm, { via: 'cancel' });

  let spaceForm = await hp.openSpaceDialog('edit', 'f1');
  const radios = () => [...spaceForm.querySelectorAll('input[name$="-show-lqi"]')];
  results.localThreeModes = radios().length === 3 && radios()[0].checked;
  results.inheritedCaptionOff = radios()[0].closest('label').textContent.includes('Off');
  radios()[1].click();
  await hp.settled();
  await save('space');
  await hp.setMode('view');
  await wait(() => shown(peer).length > 0 && shown(mini).length > 0, 'explicit on reaches all consumers');
  results.explicitOnOverridesGlobal = shown(card).includes('196')
    && card._serverCfg.spaces.find(s => s.id === 'f1').settings.show_lqi_mode === 'on';
  await wait(() => shown(kiosk).includes('196'), 'kiosk explicit override');
  results.kioskExplicitOn = shown(kiosk).includes('196');
  await hp.setMode('devices');
  markerForm = await hp.openMarkerDialog('d_lamp');
  await wait(() => preview()?.shadowRoot?.querySelector('.lqi'), 'preview explicit override');
  results.previewExplicitOn = preview().shadowRoot.querySelector('.lqi').textContent === '196';
  await hp.close(markerForm, { via: 'cancel' });
  await hp.setMode('view');
  card.setConfig({ type: 'custom:houseplan-card', show_signal: false });
  await hp.settled();
  results.explicitOnOverridesYamlFalse = shown(card).includes('196');

  await hp.setMode('devices');
  spaceForm = await hp.openSpaceDialog('edit', 'f1');
  radios()[0].click();
  await hp.settled();
  await save('space');
  const inherited = card._serverCfg.spaces.find(s => s.id === 'f1').settings;
  results.inheritRemovesMirror = !Object.hasOwn(inherited, 'show_lqi') && !Object.hasOwn(inherited, 'show_lqi_mode');
  await hp.setMode('view');
  results.yamlFalseStillHides = shown(card).length === 0;
  card.setConfig({ type: 'custom:houseplan-card', show_signal: 0 });
  await accepted(cfg => { delete cfg.settings.show_lqi; });
  await wait(() => shown(card).length > 0, 'invalid YAML is default-on');
  results.invalidYamlDefaultOn = shown(card).includes('196');

  // An old true inherits, and an unrelated real text-field edit must not create own-on.
  await accepted(cfg => { cfg.spaces[0].settings.show_lqi = true; });
  await hp.setMode('devices');
  spaceForm = await hp.openSpaceDialog('edit', 'f1');
  results.oldTrueOpensInherited = radios()[0].checked;
  await hp.input(spaceForm.querySelector('input[id$="-title"]'), 'Inherited floor');
  await save('space');
  results.unrelatedSaveStaysInherited = !Object.hasOwn(card._serverCfg.spaces[0].settings, 'show_lqi_mode')
    && !Object.hasOwn(card._serverCfg.spaces[0].settings, 'show_lqi');
  await accepted(cfg => { cfg.spaces[0].settings.show_lqi = false; });
  spaceForm = await hp.openSpaceDialog('edit', 'f1');
  results.oldFalseOpensOff = radios()[2].checked;
  await hp.input(spaceForm.querySelector('input[id$="-title"]'), 'Off floor');
  await save('space');
  results.oldFalseSaveKeepsOff = card._serverCfg.spaces[0].settings.show_lqi_mode === 'off'
    && card._serverCfg.spaces[0].settings.show_lqi === false;

  const originalWS = card.hass.callWS;
  general = await openGeneral();
  general.querySelector('#gs-show-lqi').click();
  await hp.settled();
  card.hass = { ...card.hass, callWS: async message => {
    if (message.type === 'houseplan/config/set') throw new Error('synthetic offline');
    return originalWS(message);
  } };
  general.querySelector('[data-hp="dialog-confirm"]').click();
  await wait(() => card._settingsDialog?.busy === false, 'rejected global save settles');
  results.rejectedSaveKeepsAccepted = !Object.hasOwn(card._serverCfg.settings, 'show_lqi')
    && card._settingsDialog.showLqi === false;
  card.hass = { ...card.hass, callWS: originalWS };
  const close = await hp.close(dialog('settings'), { via: 'cancel' });
  if (close.confirm) close.confirm.querySelector('[data-hp="dialog-confirm"]').click();
  await wait(() => !dialog('settings'), 'discard closes');

  for (const [tag, ctor] of [['houseplan-card-editor', card.constructor], ['houseplan-space-card-editor', mini.constructor]]) {
    const editor = await ctor.getConfigElement();
    editor.setConfig({ type: `custom:${tag.replace('-editor', '')}`, show_signal: false, future: { keep: 1 } });
    editor.hass = card.hass;
    document.body.append(editor);
    await wait(() => editor.shadowRoot?.querySelector('ha-form'), `${tag} form`);
    const forms = [...editor.shadowRoot.querySelectorAll('ha-form')];
    results[`${tag}NoSelector`] = forms.every(form => !form.schema.some(row => row.name === 'show_signal'));
    let emitted;
    editor.addEventListener('config-changed', event => { emitted = event.detail.config; });
    forms[0].dispatchEvent(new CustomEvent('value-changed', { detail: { value: { title: 'Changed' } } }));
    results[`${tag}PreservesYaml`] = emitted?.show_signal === false && emitted?.future?.keep === 1;
    editor.remove();
  }

  const seed = structuredClone(card._serverCfg);
  await accepted(cfg => { cfg.spaces = []; cfg.markers = []; });
  const onboarding = await hp.openSpaceDialog();
  results.onboardingStartsInherited = [...onboarding.querySelectorAll('input[name$="-show-lqi"]')][0]?.checked;
  await hp.close(onboarding, { via: 'cancel' });
  await hp.setServerConfig(seed);
  peer.remove(); mini.remove(); kiosk.remove();
  return results;
});
checkAll(out);
await finish(browser, out);
