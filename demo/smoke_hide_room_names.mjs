// #203: `show_names:false` means no permanent room labels in every read-only
// renderer. Plan keeps its editor-only card and saving never discards layout.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 850 });
const out = await page.evaluate(async () => {
  const card = window.__card;
  const root = (node = card) => node.renderRoot || node.shadowRoot;
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const settle = async () => { await card.updateComplete; await frame(); };
  const waitMode = async () => {
    await settle();
    while (card._modeTransitionBusy) await frame();
  };
  const labels = (node = card) => root(node).querySelectorAll('[data-hp="room-label"]');
  const htmlLabels = (node = card) => root(node).querySelectorAll('div.roomlabel[data-hp="room-label"]');
  const svgLabels = (node = card) => root(node).querySelectorAll('text.rlabel[data-hp="room-label"]');

  card._setMode('view');
  await waitMode();
  const space = card._serverCfg.spaces.find((item) => item.id === card._space);
  delete space.plan_url;
  delete space.plan_aspect;
  const room = space.rooms.find((item) => item.name && item.id && item.area)
    || space.rooms.find((item) => item.name && item.id);
  if (!room) throw new Error('fixture has no named room');
  space.settings = {
    ...(space.settings || {}), show_borders: true, show_names: true,
    label_temp: true, label_hum: true, label_lqi: true, label_light: true,
  };
  const layoutKey = `rl_${room.id}`;
  card._layout[layoutKey] = { s: space.id, x: 0.23, y: 0.31, k: 1.6 };
  card._cfgEpoch++;
  card._regSignature = '';
  card.requestUpdate();
  await settle();

  const first = root().querySelector(`[data-hp="room-label"][data-id="${room.id}"]`);
  const savedLayout = JSON.stringify(card._layout[layoutKey]);
  const trueState = {
    oneHtmlPerNamedRoom: htmlLabels().length === space.rooms.filter((item) => item.name).length,
    noLegacySvg: svgLabels().length === 0,
    savedScaleApplied: first?.getAttribute('style')?.includes('--rl-scale:1.6') === true,
    areaIconKept: !room.area || !!first?.querySelector('.rlgo'),
  };

  // Cancel: the live preview follows the pending false, but persisted config
  // and the room-label layout return untouched when the dialog is dismissed.
  card._openSpaceDialog('edit', space.id);
  card._spaceDialog = { ...card._spaceDialog, showNames: false };
  card.requestUpdate();
  await settle();
  const livePreviewHidesAll = labels().length === 0;
  card._spaceDialog = null;
  card.requestUpdate();
  await settle();
  const cancelRestoresTrue = space.settings.show_names === true && htmlLabels().length > 0
    && JSON.stringify(card._layout[layoutKey]) === savedLayout;

  // Save + reopen: exercise the real existing-space persistence path.
  card._openSpaceDialog('edit', space.id);
  card._spaceDialog = { ...card._spaceDialog, showNames: false };
  await card._saveSpaceDialog();
  await settle();
  card._openSpaceDialog('edit', space.id);
  const reopenReadsFalse = card._spaceDialog?.showNames === false
    && space.settings.show_names === false;
  card._spaceDialog = null;
  card.requestUpdate();
  await settle();

  const flatFalseHasNoLabels = labels().length === 0
    && htmlLabels().length === 0 && svgLabels().length === 0;

  card._setMode('plan');
  await waitMode();
  const planFalseKeepsEditorCard = htmlLabels().length > 0
    && svgLabels().length === 0 && !!root().querySelector('.rlgearbtn');
  card._setMode('view');
  await waitMode();
  const viewAfterPlanStillHidden = labels().length === 0;

  // The Labs registry flag is intentionally expired; use the same dormant
  // renderer fixture hook as the canonical Stage 2 smokes.
  const active = Object.freeze(['iso']);
  card._onLabsSnapshot({ active, space: '' });
  window.__hpLabs = active;
  await settle();
  card._setProjection('iso');
  await window.__hpEnsureHarnessIsoRuntime(card);
  await settle();
  const isoFalseHasNoLabels = !!root().querySelector('[data-hp="iso-walls"]')
    && labels().length === 0;
  card._setProjection('flat');
  await settle();

  await customElements.whenDefined('houseplan-space-card');
  const cfgFalse = structuredClone(card._serverCfg);
  const layout = structuredClone(card._layout);
  const staticHass = {
    ...card.hass,
    callWS: async (message) => {
      if (message.type === 'houseplan/config/get') return { config: cfgFalse, rev: 1 };
      if (message.type === 'houseplan/layout/get') return { layout, rev: 1 };
      return { ok: true };
    },
  };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const compact = document.createElement('houseplan-space-card');
  compact.setConfig({ type: 'custom:houseplan-space-card', space: space.id, show_button: false });
  compact.hass = staticHass;
  host.appendChild(compact);
  const deadline = Date.now() + 6000;
  while (!root(compact)?.querySelector('.hp-static-stage') && Date.now() < deadline) {
    await new Promise((done) => setTimeout(done, 60));
  }
  await compact.updateComplete;
  const compactFalseHasNoLabels = labels(compact).length === 0
    && htmlLabels(compact).length === 0 && svgLabels(compact).length === 0;

  // Turning names back on restores the existing HTML card and saved layout.
  space.settings.show_names = true;
  card._cfgEpoch++;
  card.requestUpdate();
  await settle();
  const restored = root().querySelector(`[data-hp="room-label"][data-id="${room.id}"]`);
  const trueRestoresExistingCard = !!restored
    && restored.tagName.toLowerCase() === 'div'
    && restored.getAttribute('style')?.includes('--rl-scale:1.6') === true
    && JSON.stringify(card._layout[layoutKey]) === savedLayout;

  host.remove();
  card._onLabsSnapshot({ active: Object.freeze([]), space: '' });
  window.__hpLabs = Object.freeze([]);
  await settle();

  return {
    ...trueState,
    livePreviewHidesAll,
    cancelRestoresTrue,
    reopenReadsFalse,
    flatFalseHasNoLabels,
    planFalseKeepsEditorCard,
    viewAfterPlanStillHidden,
    isoFalseHasNoLabels,
    compactFalseHasNoLabels,
    trueRestoresExistingCard,
  };
});

checkAll(out);
await finish(browser, out);
