import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const base = window.__card;
  const ids = base._model.map((space) => space.id);
  const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
  const mount = async (config) => {
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', ...config });
    card.hass = base.hass;
    document.body.appendChild(card);
    await wait(450);
    card.hass = { ...base.hass };
    await card.updateComplete;
    return card;
  };
  const root = (card) => card.shadowRoot || card.renderRoot;

  localStorage.setItem('houseplan_card_nav_v1', JSON.stringify({ space: ids[1] }));
  location.hash = `#space=${ids[1]}`;

  const fixedId = await mount({ floor: ids[0] });
  out.idWinsEveryInitialSource = fixedId._space === ids[0]
    && fixedId._fixedFloorState().kind === 'valid';
  out.onlyFixedTab = root(fixedId).querySelectorAll('[data-hp="space-tab"]').length === 1
    && root(fixedId).querySelector('[data-hp="space-tab"]')?.dataset.id === ids[0]
    && !root(fixedId).querySelector('.tabadd');
  fixedId._pickSpace(ids[1]);
  await fixedId.updateComplete;
  out.tabAndTransitionBlocked = fixedId._space === ids[0]
    && fixedId._commitSpace(ids[1]) === false;
  fixedId._saveNav();
  out.fixedDoesNotWriteNav = JSON.parse(localStorage.getItem('houseplan_card_nav_v1')).space === ids[1];

  location.hash = `#space=${ids[1]}`;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await fixedId.updateComplete;
  out.hashIgnored = fixedId._space === ids[0];

  const fixedIndex = await mount({ floor: 1, kiosk: true, cycle: 1 });
  out.indexUsesServerOrder = fixedIndex._loadOk === true && fixedIndex._space === ids[1];
  const indexStart = fixedIndex._space;
  fixedIndex._cyclePausedUntil = 0;
  fixedIndex._cycleTick();
  await fixedIndex.updateComplete;
  out.fixedKioskCycleDisabled = fixedIndex._space === indexStart && fixedIndex._cycleTimer == null;
  out.fixedKioskDotsHidden = !root(fixedIndex).querySelector('.kioskdots');
  const stage = root(fixedIndex).querySelector('.stage');
  stage.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, composed: true, pointerId: 41, clientX: 600, clientY: 300,
  }));
  stage.dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true, composed: true, pointerId: 41, clientX: 420, clientY: 305,
  }));
  await fixedIndex.updateComplete;
  out.fixedKioskSwipeDisabled = fixedIndex._space === indexStart;

  const remount = await mount({ floor: ids[0] });
  out.remountStillFixed = remount._space === ids[0];

  const invalid = await mount({ floor: '__missing_fixed_floor__' });
  const invalidRoot = root(invalid);
  out.invalidFailsVisibly = invalidRoot.querySelector('[data-fixed-floor-state="invalid"]')
    ?.dataset.fixedFloorReason === 'unknown-id'
    && !!invalidRoot.querySelector('[role="alert"]')
    && !invalidRoot.querySelector('.stage');

  location.hash = '';
  const ordinary = await mount({});
  out.legacyCardStillRestoresNav = ordinary._space === ids[1]
    && ordinary._fixedFloorState().kind === 'absent';

  const editor = document.createElement('houseplan-card-editor');
  editor.hass = base.hass;
  editor.setConfig({ type: 'custom:houseplan-card', floor: 1, title: 'Fixed' });
  document.body.appendChild(editor);
  await wait(150);
  let changed = null;
  editor.addEventListener('config-changed', (event) => { changed = event.detail.config; });
  editor._valueChanged(new CustomEvent('value-changed', {
    detail: { value: { ...editor._formData, title: 'Changed' } },
  }));
  out.editorPreservesYamlIndex = changed?.floor === 1 && changed?.title === 'Changed';
  editor._valueChanged(new CustomEvent('value-changed', {
    detail: { value: { ...editor._formData, floor: '' } },
  }));
  out.editorClearDeletesKey = changed && !Object.hasOwn(changed, 'floor');

  for (const card of [fixedId, fixedIndex, remount, invalid, ordinary, editor]) card.remove();
  location.hash = '';
  return out;
});

checkAll(res);
await finish(browser, res);
