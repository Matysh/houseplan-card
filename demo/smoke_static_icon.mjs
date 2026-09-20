// Always-static display contract across resolver, plan DOM, preview, static
// space card and live-vacuum overlays. The existing dynamic mode still reacts.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const card = window.__card;
  const saved = card.hass;
  const root = () => card.shadowRoot || card.renderRoot;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const update = async () => {
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const domFace = (node) => node && ({
    classes: [...node.classList].filter((name) => [
      'static-icon', 'on', 'open', 'alarm', 'unavail', 'valonly',
      'activity-running', 'activity-event', 'activity-presence', 'activity-transition',
    ].includes(name)),
    icon: node.querySelector('.device-core > ha-icon')?.getAttribute('icon') || '',
    satellites: node.querySelectorAll('.tval,.hval,.lqi,.valtext').length,
    scale: node.style.getPropertyValue('--dev-scale'),
    angle: node.querySelector('.device-core > ha-icon')?.style.transform || '',
  });
  const show = (device, states) => {
    const visibleSnapshot = card._visibleDeviceSnapshot;
    const candidateSnapshot = card._candidateDeviceSnapshot;
    card.hass = {
      ...saved,
      entities: {
        ...saved.entities,
        ...Object.fromEntries(Object.keys(states).map((entity_id) => [entity_id, {
          entity_id, device_id: device.id, platform: 'demo', disabled_by: null,
        }])),
      },
      states: { ...saved.states, ...states },
    };
    card._visibleDeviceSnapshot = null;
    card._candidateDeviceSnapshot = null;
    const presentation = card._devicePresentation(device);
    card.hass = saved;
    card._visibleDeviceSnapshot = visibleSnapshot;
    card._candidateDeviceSnapshot = candidateSnapshot;
    return {
      classes: presentation.classes,
      icon: presentation.icon,
      status: presentation.visual.status,
      activity: presentation.activity,
      temp: presentation.tempText,
      lqi: presentation.lqiText,
      vacuumLive: presentation.vacuumLive,
    };
  };

  const smoke = {
    id: 'static-smoke', name: 'Smoke', icon: 'mdi:smoke-detector',
    entities: ['binary_sensor.static_smoke'], primary: 'binary_sensor.static_smoke',
    marker: {
      binding: 'device:static-smoke', display: 'static_icon',
      vacuum: { live: true },
    },
  };
  const relay = {
    // Reuse the harness registry entry: `_planHass` deliberately resolves
    // against the acquired HA registry, so an invented entity would correctly
    // be absent even if it were injected into `hass.states` for this frame.
    id: 'd_kettle', name: 'Relay', icon: 'mdi:toggle-switch',
    entities: ['switch.kettle'], primary: 'switch.kettle',
    marker: { binding: 'device:d_kettle', display: 'badge' },
  };
  const smokeOn = show(smoke, {
    'binary_sensor.static_smoke': {
      state: 'on', attributes: { device_class: 'smoke', linkquality: 180 },
    },
  });
  const smokeUnavailable = show(smoke, {
    'binary_sensor.static_smoke': {
      state: 'unavailable', attributes: { device_class: 'smoke', linkquality: 180 },
    },
  });
  const relayOn = show(relay, {
    'switch.kettle': { state: 'on', attributes: {} },
  });

  const markerId = 'static-vacuum';
  card._serverCfg.markers.push({
    id: markerId,
    // Rebind the registered demo mower into f1. A made-up entity would be
    // correctly absent from the authoritative HA registry and could not prove
    // that the live-vacuum renderer itself was suppressed.
    binding: 'device:d_mower',
    space: 'f1',
    area: 'living_room',
    display: 'static_icon',
    icon: 'mdi:robot-vacuum',
    size: 1.4,
    angle: 27,
    vacuum: {
      source: 'camera.static_robot_map',
      live: true,
      trail_mode: 'always',
      calibration: { m1: [0.001, 0, 0, 0.001, 0, 0] },
    },
  });
  card._layout[markerId] = { s: 'f1', x: 0.3, y: 0.3 };
  card.hass = {
    ...saved,
    states: {
      ...saved.states,
      'vacuum.mower': {
        entity_id: 'vacuum.mower', state: 'cleaning',
        attributes: { friendly_name: 'Static robot' },
      },
      'camera.static_robot_map': {
        entity_id: 'camera.static_robot_map', state: 'idle',
        attributes: {
          map_name: 'm1', vacuum_position: { x: 500, y: 500, a: 0 },
          path: [[200, 200], [350, 350], [500, 500]],
        },
      },
    },
  };
  card._regSignature = '';
  card._cfgEpoch++;
  card._setMode('view');
  await update();
  const planFace = domFace(root().querySelector(`.dev[data-id="${markerId}"]`));
  const noPlanVacuumOverlay = !root().querySelector(`.vacpuck[data-mid="${markerId}"]`)
    && !root().querySelector('.vactrail');

  card._setMode('devices');
  const staticDevice = card._devices.find((item) => item.id === markerId);
  card._openMarkerDialog(staticDevice);
  await update();
  const preview = root().querySelector('hp-device-preview');
  await preview?.updateComplete;
  const previewFace = domFace(preview?.renderRoot?.querySelector('.dev'));
  const staticPreviewHasNoDemo = !preview?.renderRoot?.querySelector('.previewdemo');

  const savedMarker = card._serverCfg.markers.find((marker) => marker.id === markerId);
  savedMarker.display = 'badge';
  card._markerDialog = null;
  card._cfgEpoch++;
  card._setMode('view');
  card.hass = { ...card.hass };
  await update();
  const dynamicNode = root().querySelector(`.dev[data-id="${markerId}"]`);
  const switchedBackToDynamic = dynamicNode?.classList.contains('on')
    && !dynamicNode?.classList.contains('static-icon');
  const dynamicVacuumOverlayRestored = !!root().querySelector(`.vacpuck[data-mid="${markerId}"]`)
    && !!root().querySelector('.vactrail');
  savedMarker.display = 'static_icon';
  card._cfgEpoch++;
  card.hass = { ...card.hass };
  await update();
  const returnedNode = root().querySelector(`.dev[data-id="${markerId}"]`);
  const returnCreatesNoActivity = returnedNode?.classList.contains('static-icon')
    && ![...returnedNode.classList].some((name) => name.startsWith('activity-'));
  const returnHidesVacuumOverlay = !root().querySelector(`.vacpuck[data-mid="${markerId}"]`)
    && !root().querySelector('.vactrail');

  await customElements.whenDefined('houseplan-space-card');
  const staticCard = document.createElement('houseplan-space-card');
  staticCard.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  staticCard.hass = card.hass;
  document.body.appendChild(staticCard);
  const started = Date.now();
  while (!staticCard.renderRoot?.querySelector(`.dev[data-id="${markerId}"]`)
      && Date.now() - started < 6000) {
    await wait(60);
  }
  await staticCard.updateComplete;
  const staticCardFace = domFace(staticCard.renderRoot?.querySelector(`.dev[data-id="${markerId}"]`));
  // ------------------ #588: значение при неизменном цвете ------------------
  // AC6 (К2а). Три ветки живого пылесоса сравнивают режим строкой и общей
  // политики не читают, поэтому зелёная политика их не гарантирует. Тот же
  // маркер, который выше доказал подавление для «Всегда статичный значок»,
  // проходит их и для нового режима — и каждый раз возвращается в `badge`,
  // иначе отсутствие puck доказывало бы лишь сломанную фикстуру.
  const vacPuck = () => root().querySelector(`.vacpuck[data-mid="${markerId}"]`);
  const vacTrail = () => root().querySelector('.vactrail');
  const vacWarn = () => root().querySelector('.vacwarn');
  const setVacDisplay = async (mode) => {
    savedMarker.display = mode;
    card._cfgEpoch++;
    card.hass = { ...card.hass };
    await update();
  };
  const setMapName = async (name) => {
    const camera = card.hass.states['camera.static_robot_map'];
    card.hass = {
      ...card.hass,
      states: {
        ...card.hass.states,
        'camera.static_robot_map': {
          ...camera, attributes: { ...camera.attributes, map_name: name },
        },
      },
    };
    await update();
  };
  // Сопоставленная карта (калибровка знает `m1`): puck и след существуют.
  await setVacDisplay('badge');
  const mappedBadgeShowsLive = !!vacPuck() && !!vacTrail();
  await setVacDisplay('value_static_icon');
  const valueStaticHidesLive = !vacPuck() && !vacTrail();
  const valueStaticKeepsBufferEmpty = !card._vacRt.get(markerId);
  // Несопоставленная карта (`m9` нет в калибровке): только здесь появляется
  // бейдж маршрута. При совпадающей калибровке маршрут `ready`, предупреждения
  // нет ни в одном режиме — и третий факт был бы тавтологией.
  await setVacDisplay('badge');
  await setMapName('m9');
  const unmappedBadgeWarns = !!vacWarn();
  // Режим меняется БЕЗ нового снимка hass: `_vacTick` живёт на приёме hass,
  // поэтому буфер позиций остаётся наполненным, а `moving` — истинным. Это
  // важно: иначе исчезнувший бейдж объяснялся бы пустым буфером (его чистит
  // первая ветка), и дефектная третья ветка прошла бы свидетеля зелёной.
  savedMarker.display = 'value_static_icon';
  card._cfgEpoch++;
  card._regSignature = '';
  card._maybeRebuildDevices();
  await update();
  const valueStaticHidesRouteWarn = !vacWarn();
  const routeBufferStillMoving = card._vacRt.get(markerId)?.moving === true;
  await setMapName('m1');
  await setVacDisplay('static_icon');

  // AC5/AC7. Маркер со значением: число видно на плане, а цвет не отзывается
  // ни на включённую лампу, ни на недоступность источника. Источник — лампа, а
  // не дверь: у крышки состояние живёт в значке, подложка нейтральна в обоих
  // режимах, и контраст ниже ничего бы не доказал.
  const valueId = 'value-static-light';
  card._serverCfg.markers.push({
    id: valueId, binding: 'device:d_light1', space: 'f1', area: 'living_room',
    display: 'value_static_icon', icon: 'mdi:ceiling-light', size: 1.4,
    value_source: {
      kind: 'entity_attribute', entity_id: 'light.ceiling', attribute: 'brightness',
    },
  });
  card._layout[valueId] = { s: 'f1', x: 0.62, y: 0.3 };
  const alarmId = 'value-static-leak';
  card._serverCfg.markers.push({
    id: alarmId, binding: 'device:d_leak', space: 'f1', area: 'living_room',
    display: 'value_static_icon', icon: 'mdi:water',
  });
  card._layout[alarmId] = { s: 'f1', x: 0.72, y: 0.5 };
  const setLight = async (state, attributes) => {
    card.hass = {
      ...card.hass,
      states: {
        ...card.hass.states,
        'light.ceiling': {
          entity_id: 'light.ceiling', state,
          attributes: { friendly_name: 'Ceiling light', ...attributes },
        },
      },
    };
    await update();
  };
  const setValueDisplay = async (mode) => {
    card._serverCfg.markers.find((marker) => marker.id === valueId).display = mode;
    card._cfgEpoch++;
    card.hass = { ...card.hass };
    await update();
  };
  const valueNode = () => root().querySelector(`.dev[data-id="${valueId}"]`);
  const valueText = () => valueNode()?.querySelector('.valtext')?.textContent?.trim() || '';
  // Собственные классы режима не считаются состоянием: `static-icon` —
  // стилевой хук нейтральной подложки, `valonly` — форма лица значения.
  const stateClasses = (node) => [...(node?.classList || [])].filter((name) => [
    'on', 'open', 'alarm', 'unavail',
    'activity-running', 'activity-event', 'activity-presence', 'activity-transition',
  ].includes(name));
  card._regSignature = '';
  card._cfgEpoch++;
  await setLight('on', { brightness: 128, rgb_color: [255, 196, 112] });
  const valueOnText = valueText();
  const valueOnClasses = stateClasses(valueNode());
  const valueOnNoPulse = !valueNode()?.querySelector('.pulse,.ripple')
    && !valueNode()?.querySelector('.lqi');
  await setLight('off', { brightness: 0 });
  const valueOffText = valueText();
  const valueOffClasses = stateClasses(valueNode());
  await setLight('unavailable', {});
  const valueUnavailableClasses = stateClasses(valueNode());
  // Контраст: тот же маркер и тот же источник в «Значение + состояние» красится
  // включённой лампой — нейтральность выше принадлежит режиму, а не фикстуре.
  await setLight('on', { brightness: 128, rgb_color: [255, 196, 112] });
  await setValueDisplay('value');
  const dynamicText = valueText();
  const dynamicClasses = stateClasses(valueNode());
  await setValueDisplay('value_static_icon');

  // AC7. Редактор: новая опция последняя, поле источника значения показано,
  // предупреждение о тревоге показано, секция внешнего бейджа выключена.
  card._setMode('devices');
  const valueDevice = card._devices.find((item) => item.id === valueId);
  card._openMarkerDialog(valueDevice);
  await update();
  const displayOptions = [...root().querySelectorAll('#marker-display option')]
    .map((option) => option.value);
  const editorShowsValueSource = !!root().querySelector('#marker-value-source');
  // #600: блок бейджа — .hpf-block с тумблером набора и callout'ом состояния
  const badgeToggle = root().querySelector('.markerbadgegroup input[type="checkbox"]');
  const editorDisablesBadge = !!badgeToggle?.disabled
    && !!root().querySelector('.markerbadgegroup .hpf-callout');
  card._markerDialog = null;
  await update();
  const alarmDevice = card._devices.find((item) => item.id === alarmId);
  card._openMarkerDialog(alarmDevice);
  await update();
  // #600: предупреждение о тревоге — callout набора в карточке Appearance
  const alarmWarning = () => [...root().querySelectorAll('.hpf-card[data-card="appearance"] .hpf-callout')]
    .some((node) => node.textContent.includes(card._t('marker.static_alarm_warning')));
  const editorWarnsAboutAlarm = alarmWarning();
  card._markerDialog = { ...card._markerDialog, display: 'badge' };
  await update();
  const badgeHidesAlarmWarning = !alarmWarning();
  card._markerDialog = null;
  await update();

  return {
    staticAlarmNeutral: smokeOn.status === 'neutral'
      && smokeOn.activity === 'none'
      && smokeOn.classes.join(' ') === 'static-icon',
    staticUnavailableSame: JSON.stringify(smokeOn) === JSON.stringify(smokeUnavailable),
    staticSuppressesVacuum: smokeOn.vacuumLive === false,
    liveSwitchStillDynamic: relayOn.status === 'working' && relayOn.classes.includes('on'),
    planPreviewStaticParity: !!planFace && !!previewFace
      && planFace.classes.includes('static-icon')
      && previewFace.classes.includes('static-icon')
      && JSON.stringify(planFace) === JSON.stringify(previewFace),
    planStaticCardParity: !!planFace && !!staticCardFace
      && planFace.classes.includes('static-icon')
      && staticCardFace.classes.includes('static-icon')
      && JSON.stringify(planFace) === JSON.stringify(staticCardFace),
    noPlanVacuumOverlay,
    staticPreviewHasNoDemo,
    switchedBackToDynamic,
    dynamicVacuumOverlayRestored,
    returnCreatesNoActivity,
    returnHidesVacuumOverlay,
    // #588 AC6
    mappedBadgeShowsLive,
    valueStaticHidesLive,
    valueStaticKeepsBufferEmpty,
    valueStaticHidesRouteWarn,
    routeBufferStillMoving,
    unmappedBadgeWarns,
    // #588 AC5
    valueStaticShowsValue: valueOnText === '50 %',
    valueStaticNeverColoured: valueOnClasses.length === 0
      && valueOffClasses.length === 0 && valueUnavailableClasses.length === 0,
    valueStaticFollowsSource: valueOffText === '0 %',
    valueStaticHasNoPulseOrLqi: valueOnNoPulse,
    dynamicValueColoured: dynamicText === '50 %' && dynamicClasses.includes('on'),
    // #588 AC7
    editorListsNewModeLast: displayOptions.join(',')
      === 'badge,icon_ripple,value,static_icon,value_static_icon',
    editorShowsValueSource,
    editorDisablesBadge,
    editorWarnsAboutAlarm,
    badgeHidesAlarmWarning,
  };
});

await finish(browser, checkAll(out));
