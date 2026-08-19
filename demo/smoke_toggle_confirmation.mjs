// #103: Toggle confirmation explains the current snapshot and the exact
// nextEffect while execution still resolves the current intent again.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 390, height: 760 });
const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const calls = [];
  const coverState = (state, entityId = 'cover.gate', deviceClass = 'curtain') => ({
    entity_id: entityId,
    state,
    attributes: {
      friendly_name: entityId === 'cover.gate'
        ? 'Very long living-room curtain name that must wrap on a phone'
        : 'Other curtain',
      device_class: deviceClass,
      supported_features: 11,
    },
  });
  const setCover = async (state, extraStates = {}, deviceClass = 'curtain') => {
    card.hass = {
      ...card.hass,
      states: { ...card.hass.states, 'cover.gate': coverState(state, 'cover.gate', deviceClass), ...extraStates },
      services: {
        ...card.hass.services,
        cover: {
          ...card.hass.services?.cover,
          open_cover: {}, close_cover: {}, stop_cover: {}, toggle: {},
        },
      },
      // The demo fallback returns raw states; #103 must still localize the
      // known vocabulary instead of exposing those tokens in confirmation.
      formatEntityState: (entity) => entity.state,
      callService: async (domain, service, data) => {
        calls.push([domain, service, data]);
        return {};
      },
    };
    card.requestUpdate();
    await card.updateComplete;
  };
  const setLanguage = async (language) => {
    card._config = { ...card._config, language };
    card.requestUpdate();
    await card.updateComplete;
  };
  const rebuildGate = async () => {
    card._serverCfg = {
      ...card._serverCfg,
      markers: [{
        id: 'm_gate', binding: 'device:d_gate', tap_action: 'cover',
        tap_confirm: true, display: 'icon_ripple',
      }],
    };
    card._cfgEpoch++;
    card._regSignature = '';
    card._maybeRebuildDevices();
    card._space = 'garden';
    card._setMode('view');
    card.requestUpdate();
    await card.updateComplete;
  };
  const gate = () => card._devices.find((item) => item.bindingRef === 'd_gate');
  const tap = async () => {
    card._clickDevice({ stopPropagation() {} }, gate());
    await card.updateComplete;
    return card._tapConfirm;
  };
  const renderedLines = () => [...root().querySelectorAll('.tapconfirm-line')]
    .map((node) => node.textContent.trim());

  await setLanguage('en');
  await setCover('closed');
  await rebuildGate();

  const english = await tap();
  result.englishSnapshotIsStructured = english?.kind === 'toggle'
    && english.initialIntent?.nextEffect === 'open'
    && english.deviceId === gate()?.id;
  result.englishCurrentExpected = JSON.stringify(renderedLines()) === JSON.stringify([
    'Current state: Closed', 'After switching: Open',
  ]);
  const groupLines = card._toggleConfirmationLines({
    origin: 'explicit-toggle', kind: 'group', semantics: 'group-power',
    targets: [
      { entityId: 'switch.one', name: 'One', state: 'on', via: 'control-entity' },
      { entityId: 'light.two', name: 'Two', state: 'off', via: 'control-entity' },
    ],
    skippedTargets: [{
      ref: 'switch.missing', entityId: 'switch.missing', name: 'Missing', reason: 'unavailable',
    }],
    noneReason: null, nextEffect: 'turn-off',
    command: {
      domain: 'homeassistant', service: 'turn_off',
      data: { entity_id: ['switch.one', 'light.two'] },
    },
  });
  const virtualLines = card._toggleConfirmationLines({
    origin: 'explicit-toggle', kind: 'single', semantics: 'power',
    targets: [{ entityId: '', name: 'Virtual lamp', state: 'on', via: 'virtual-light' }],
    skippedTargets: [], noneReason: null, nextEffect: 'turn-off', command: null,
    operation: { kind: 'virtual-light', markerId: 'virtual-lamp' },
  });
  result.englishGroupAndVirtualCopy = JSON.stringify(groupLines) === JSON.stringify([
    'Current state: on 1 of 2', 'After switching: all are off', 'Unavailable: 1',
  ]) && JSON.stringify(virtualLines) === JSON.stringify([
    'Current state: On', 'After switching: Off',
  ]);
  const body = root().querySelector('.tapconfirm-body');
  const dialog = root().querySelector('hp-dialog');
  const titleText = dialog?.shadowRoot?.querySelector('.title-text');
  const footer = root().querySelector('hp-dialog [slot="footer"]');
  const buttons = [...(footer?.querySelectorAll('button') || [])];
  result.accessibleDomOrder = dialog?.title === english.text
    && body?.children[0]?.getAttribute('data-line') === '0'
    && body?.children[1]?.getAttribute('data-line') === '1'
    && buttons.length === 2;
  result.narrowDialogDoesNotScrollHorizontally = !!body
    && body.scrollWidth <= body.clientWidth + 1
    && !!titleText && titleText.scrollWidth <= titleText.clientWidth + 1
    && buttons.every((button) => {
      const rect = button.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth + 1;
    });

  // Same target, changed state: execute the newly resolved direction.
  calls.length = 0;
  await setCover('open');
  english.exec();
  await new Promise((resolve) => setTimeout(resolve, 10));
  result.sameTargetUsesCurrentDirection = calls.length === 1
    && calls[0][0] === 'cover' && calls[0][1] === 'close_cover';

  // Different operation target: preserve #94's cancellation/toast contract.
  await setCover('closed');
  const changed = await tap();
  const beforeChange = gate();
  const other = coverState('closed', 'cover.other');
  card.hass = { ...card.hass, states: { ...card.hass.states, 'cover.other': other } };
  card._devices = card._devices.map((item) => item.id === beforeChange.id ? {
    ...item,
    primary: 'cover.other', entities: ['cover.other'], allEntities: ['cover.other'],
    bindingKind: 'entity', bindingRef: 'cover.other',
    marker: { ...item.marker, binding: 'entity:cover.other' },
  } : item);
  calls.length = 0;
  changed.exec();
  await card.updateComplete;
  result.changedTargetCancels = calls.length === 0
    && card._toast === card._t('toast.tap_target_changed');

  await setLanguage('ru');
  await setCover('closed');
  await rebuildGate();
  await tap();
  result.russianCurrentExpected = JSON.stringify(renderedLines()) === JSON.stringify([
    'Текущее состояние: Закрыто', 'После переключения: Открыто',
  ]);

  // A secure/no-operation resolver result must not open a confirmation.
  card._tapConfirm = null;
  await setCover('closed', {}, 'garage');
  await tap();
  result.noOperationDoesNotOpen = card._tapConfirm == null && calls.length === 0;

  return result;
});

checkAll(out);
await finish(browser, out);
