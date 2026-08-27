import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const state = () => ({
    source: c._spaceDialog?.source,
    showBorders: c._spaceDialog?.showBorders,
    showNames: c._spaceDialog?.showNames,
    displayTouched: c._spaceDialog?.displayTouched,
  });
  const choose = async (source) => {
    const radios = [...sr().querySelectorAll('hp-dialog input[name="plansrc"]')];
    radios[source === 'file' ? 0 : 1].click();
    await c.updateComplete;
  };
  const toggle = async (key) => {
    const label = [...sr().querySelectorAll('hp-dialog label.srcrow')]
      .find((row) => row.textContent.includes(c._t(key)));
    label.querySelector('input[type="checkbox"], ha-switch').click();
    await c.updateComplete;
  };

  c._openSpaceDialog('create'); await c.updateComplete;
  out.freshFile = state();
  await choose('draw');
  out.untouchedDraw = state();
  await choose('file');
  out.untouchedFileAgain = state();
  await choose('draw');
  await toggle('space.show_borders');
  out.mixedTouched = state();
  await choose('file');
  out.mixedFile = state();
  await choose('draw');
  out.mixedDrawAgain = state();

  c._spaceDialog = { ...c._spaceDialog, title: 'Mixed display defaults' };
  await c._saveSpaceDialog(); await c.updateComplete;
  const mixed = c._serverCfg.spaces.find((s) => s.title === 'Mixed display defaults');
  out.savedMixed = [mixed?.settings?.show_borders, mixed?.settings?.show_names];
  out.savedMixedHasEmptyWallCatalog = Array.isArray(mixed?.wall_segments)
    && mixed.wall_segments.length === 0;
  c._openSpaceDialog('edit', mixed.id); await c.updateComplete;
  out.reopenedMixed = state();
  await choose('file');
  out.editSourcePreservesPair = state();

  const beforeCancel = JSON.stringify(c._serverCfg);
  c._spaceDialog = null; await c.updateComplete;
  c._openSpaceDialog('create'); await c.updateComplete;
  await choose('draw');
  await toggle('space.show_names');
  c._spaceDialog = null; await c.updateComplete;
  out.cancelDidNotWrite = JSON.stringify(c._serverCfg) === beforeCancel;
  c._openSpaceDialog('create'); await c.updateComplete;
  out.freshAfterCancel = state();

  c._spaceDialog = null;
  c._importQueue = ['Floor one', 'Floor two'];
  c._importTotal = 2;
  c._openNextImport(); await c.updateComplete;
  out.onboardingFirst = { title: c._spaceDialog.title, ...state() };
  await choose('draw');
  await toggle('space.show_borders');
  c._skipImport(); await c.updateComplete;
  out.onboardingSecond = { title: c._spaceDialog.title, ...state() };

  c._importQueue = [];
  c._importTotal = 0;
  c._spaceDialog = null;
  c._openSpaceDialog('create'); await c.updateComplete;
  const existingPlan = c._serverCfg.spaces.find((s) => s.plan_url)?.plan_url;
  c._spaceDialog = {
    ...c._spaceDialog, title: 'File display defaults', planUrl: existingPlan || '/local/houseplan/plan.svg',
  };
  await c._saveSpaceDialog(); await c.updateComplete;
  const file = c._serverCfg.spaces.find((s) => s.title === 'File display defaults');
  out.savedFileDefaults = [file?.settings?.show_borders, file?.settings?.show_names];

  // #324: a server-rejected create must not survive merely because the dialog
  // mutated the reactive config before config/set.  Reproduce invalid_format,
  // then let config/get return the last accepted document.
  const serverTruth = structuredClone(c._serverCfg);
  const baseCall = c.hass.callWS.bind(c.hass);
  let rejectedCandidate = null;
  let authoritativeReads = 0;
  c.hass = { ...c.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/set') {
      rejectedCandidate = structuredClone(message.config);
      const error = new Error('v8+ space requires wall_segments');
      error.code = 'invalid_format';
      throw error;
    }
    if (message.type === 'houseplan/config/get') {
      authoritativeReads++;
      return { config: structuredClone(serverTruth), rev: c._cfgRev, can_write: true };
    }
    return baseCall(message);
  } };
  c._openSpaceDialog('create'); await c.updateComplete;
  await choose('draw');
  c._spaceDialog = { ...c._spaceDialog, title: 'Rejected ghost' };
  await c._saveSpaceDialog(); await c.updateComplete;
  const rejectedSpace = rejectedCandidate?.spaces?.find((s) => s.title === 'Rejected ghost');
  out.rejectedCandidateHasEmptyWallCatalog = Array.isArray(rejectedSpace?.wall_segments)
    && rejectedSpace.wall_segments.length === 0;
  out.rejectedCreateReloadsServerTruth = authoritativeReads === 1
    && !c._serverCfg.spaces.some((s) => s.title === 'Rejected ghost');
  out.rejectedCreateKeepsDialogForRetry = c._spaceDialog?.title === 'Rejected ghost'
    && c._spaceDialog.busy === false;

  return out;
});

checkAll(res, {
  freshFile: { source: 'file', showBorders: false, showNames: false, displayTouched: false },
  untouchedDraw: { source: 'draw', showBorders: true, showNames: true, displayTouched: false },
  untouchedFileAgain: { source: 'file', showBorders: false, showNames: false, displayTouched: false },
  mixedTouched: { source: 'draw', showBorders: false, showNames: true, displayTouched: true },
  mixedFile: { source: 'file', showBorders: false, showNames: true, displayTouched: true },
  mixedDrawAgain: { source: 'draw', showBorders: false, showNames: true, displayTouched: true },
  savedMixed: [false, true],
  reopenedMixed: { source: 'draw', showBorders: false, showNames: true, displayTouched: true },
  editSourcePreservesPair: { source: 'file', showBorders: false, showNames: true, displayTouched: true },
  freshAfterCancel: { source: 'file', showBorders: false, showNames: false, displayTouched: false },
  onboardingFirst: {
    title: 'Floor one', source: 'file', showBorders: false, showNames: false, displayTouched: false,
  },
  onboardingSecond: {
    title: 'Floor two', source: 'file', showBorders: false, showNames: false, displayTouched: false,
  },
  savedFileDefaults: [false, false],
});
await finish(browser, res);
