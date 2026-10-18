// #892: production bundle, real settings/Optimize buttons and HA event facade.
// Transport observation and can_write fault injection are at the public HA boundary.
// This demo proves UI/adoption, not live-HA persistence; real WS tests cover storage/ACL/Undo.
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 950 });
const results = {};
const record = (name, value) => { results[name] = value; check(name, value); };
const settings = () => page.locator('hp-dialog[data-kind="settings"][icon="mdi:cog-outline"]');
const optimize = () => page.locator('hp-dialog[data-kind="settings"][icon="mdi:broom"]');
async function open() {
  if (!await settings().count()) await page.locator('[data-hp="settings"]').click();
  await settings().locator('[data-section-target="data"]').click();
  await settings().getByRole('button',{name:await page.evaluate(()=>window.__card._t('gs.align_all')),exact:true}).click();
  await optimize().waitFor();
  await page.evaluate(() => window.__hpTest.settled());
}
async function close() {
  await optimize().locator('.btn[data-hp="dialog-cancel"]').click();
  await page.evaluate(() => window.__hpTest.settled());
}
await page.evaluate(() => {
  const card = window.__card, base = card.hass;
  window.__892 = { writes: [], canWrite: true };
  card.hass = { ...base, user: { ...base.user, is_admin: false }, callWS: async message => {
    if (message.type === 'houseplan/plan/optimize') window.__892.writes.push(structuredClone(message));
    const reply = await base.callWS(message);
    return message.type === 'houseplan/config/get' ? { ...reply, can_write: window.__892.canWrite } : reply;
  } };
});
await open();
const clean = await page.evaluate(() => ({ config: structuredClone(window.__card._alignDialog.config),
  layout: structuredClone(window.__card._alignDialog.layout) }));
await close();
await page.evaluate(async clean => {
  const hp = window.__hpTest;
  const room = clean.config.spaces[0].rooms[0];
  window.__892.roomId = room.id;
  clean.config.markers ||= [];
  clean.config.markers.push({ id: 'kept892', binding: 'virtual',
    space: clean.config.spaces[0].id, name: 'Retained marker' },
  { id: 'vacuum892', binding: 'virtual', space: clean.config.spaces[0].id,
    name: 'Vacuum892', vacuum: { segment_map: { '1': 'deleted-room892' },
      calibration: { 'floor': [1, 0, 0, 1, 0, 0] } } });
  await hp.waitForWrites(); await hp.setServerConfig(clean.config); await hp.waitForWrites();
  await hp.setLayout({ ...clean.layout,
    grp_obsolete: { s: 'deleted', x: 0.25, y: 0.5, k: 1.6 },
    grp_second_obsolete: { s: 'deleted', x: 0.5, y: 0.5 },
    'aa892000000000000000000000000000': { s: 'deleted', x: 0.75, y: 0.5 },
    future_widget: { s: 'deleted', x: 0.5, y: 0.5, future: true },
    kept892: { s: clean.config.spaces[0].id, x: 0.25, y: 0.25 },
    ['rl_' + room.id]: { s: 'deleted', x: 0.25, y: 0.5, k: 1.75 },
  });
  await hp.settled();
}, clean);
await open();
let before = await page.evaluate(() => ({ config: JSON.stringify(window.__card._serverCfg),
  layout: JSON.stringify(window.__card._layout), writer: window.__card._canEdit,
  admin: window.__card.hass.user.is_admin, eligible: window.__card._alignDialog.report.invalidPositionsEligible.length }));
record('ordinaryWriterNotAdminCanOpen', before.writer && !before.admin);
record('exactOwnerExampleHasThreeEligibleRecords', before.eligible === 3);
record('vacuumWarningNamesObjectAndRealGuiPath', /Vacuum892.*Device editor.*Maps/.test(await optimize().innerText()));
const retained = await page.evaluate(() => {
  const card = window.__card;
  const room = card._serverCfg.spaces[0].rooms.find(r => r.id === window.__892.roomId);
  const device = card._devices.find(d => d.id === 'kept892');
  return { scale: card._labelScale(room), position: card._pos(device),
    vacuum: JSON.stringify(card._serverCfg.markers.find(m => m.id === 'vacuum892').vacuum) };
});
record('liveRoomActuallyUsesRetainedScale', retained.scale === 1.75);
for (const theme of ['light', 'dark']) {
  await page.emulateMedia({ colorScheme: theme });
  for (const [lang, width] of [['ru', 1280], ['ru', 360], ['en', 360], ['en', 1280]]) {
    await page.setViewportSize({ width, height: 950 });
    await page.evaluate(async lang => {
      window.__card.hass = { ...window.__card.hass, language: lang, locale: { language: lang } };
      await window.__hpTest.settled(); await document.fonts.ready;
    }, lang);
    const fits = await optimize().evaluate(dialog => {
      const surface = dialog.shadowRoot?.querySelector('.surface, ha-dialog') || dialog;
      const body = dialog.querySelector('.body'), action = dialog.querySelector('.optimize-invalid-cleanup');
      const box = surface.getBoundingClientRect(), target = action.getBoundingClientRect();
      return box.left >= -1 && box.right <= innerWidth + 1 && body.scrollWidth <= body.clientWidth + 1
        && target.width >= 44 && target.height >= 44 && target.left >= box.left - 1 && target.right <= box.right + 1;
    });
    record(`cleanup_layout_${theme}_${lang}_${width}`, fits);
  }
}
await optimize().locator('.optimize-invalid-cleanup').focus();
await page.keyboard.press('Space');
record('keyboardSelectPreviewsWithoutWriting', await page.evaluate(() => window.__892.writes.length === 0
  && window.__card._alignDialog.removeInvalidMissingPositions === true));
await page.keyboard.press('Space');
await optimize().locator('.optimize-invalid-cleanup').click();
let selected = await page.evaluate(() => ({ removed: window.__card._alignDialog.report.invalidPositionsRemoved.map(x => x.id),
  future: window.__card._alignDialog.layout.future_widget,
  unchanged: JSON.stringify(window.__card._layout), writes: window.__892.writes.length }));
record('cleanupOnlyPreviewsWholeRecord', selected.removed.length === 3 && selected.removed.includes('grp_obsolete')
  && selected.unchanged === before.layout && selected.writes === 0 && selected.future?.future === true);
record('applyIsExplicit', await optimize().locator('[data-hp="dialog-confirm"]').count() === 1);
await close();
record('cancelWritesNothing', await page.evaluate(before => window.__892.writes.length === 0
  && JSON.stringify(window.__card._layout) === before.layout
  && JSON.stringify(window.__card._serverCfg) === before.config, before));

await open(); await optimize().locator('.optimize-invalid-cleanup').click();
await page.evaluate(async () => {
  await window.__hpTest.setServerConfig(cfg => { cfg.spaces[0].title += ' changed'; });
  await window.__hpTest.settled();
});
await optimize().locator('[data-hp="dialog-confirm"]').click();
record('newRevisionResetsConsentWithoutWrite', await page.evaluate(() => window.__892.writes.length === 0
  && window.__card._alignDialog.removeInvalidMissingPositions === false
  && window.__card._alignDialog.config.spaces[0].title.endsWith(' changed')));
await optimize().locator('.optimize-invalid-cleanup').click();
const proposed = await page.evaluate(() => ({ config: structuredClone(window.__card._alignDialog.config),
  layout: structuredClone(window.__card._alignDialog.layout),
  configRev: window.__card._cfgRev, layoutRev: window.__card._layoutRev }));
await optimize().locator('[data-hp="dialog-confirm"]').click();
await page.evaluate(() => window.__hpTest.waitForWrites());
record('oneAtomicWriteUsesExactPreviewAndFrozenRevisions', await page.evaluate(expected => {
  const writes = window.__892.writes;
  return writes.length === 1 && JSON.stringify(writes[0].config) === JSON.stringify(expected.config)
    && JSON.stringify(writes[0].layout) === JSON.stringify(expected.layout)
    && writes[0].expected_config_rev === expected.configRev && writes[0].expected_layout_rev === expected.layoutRev;
}, proposed));
record('postAdoptionReportIsCleanAndUndoAvailable', await page.evaluate(() => {
  const card = window.__card;
  return !card._layout.grp_obsolete && !card._layout.grp_second_obsolete
    && !card._layout.aa892000000000000000000000000000 && card._layout.future_widget?.future === true
    && card._alignDialog.report.invalidPositionsEligible.length === 0
    && !card._alignDialog.changed && card._canOptimizeUndo && card._undoKind === 'optimize';
}));
record('retainedViewPlacementScaleAndVacuumUnchanged', await page.evaluate(expected => {
  const card = window.__card;
  const room = card._serverCfg.spaces[0].rooms.find(r => r.id === window.__892.roomId);
  return card._labelScale(room) === expected.scale
    && JSON.stringify(card._pos(card._devices.find(d => d.id === 'kept892'))) === JSON.stringify(expected.position)
    && JSON.stringify(card._serverCfg.markers.find(m => m.id === 'vacuum892').vacuum) === expected.vacuum;
}, retained));
await close();

// Revoking the authoritative capability while General settings remains open
// must disable both Optimize and its paired Undo, not merely hide an admin-only route.
await page.evaluate(async () => {
  window.__892.canWrite = false;
  await window.__hpTest.setServerConfig(cfg => cfg);
  await window.__hpTest.settled();
});
record('currentReadOnlyCapabilityDisablesOptimizeAndUndo', await page.evaluate(() => {
  const dialog = (window.__card.shadowRoot || window.__card.renderRoot)
    .querySelector('hp-dialog[icon="mdi:cog-outline"]');
  const buttons=[...(dialog?.querySelectorAll('[data-card="data"] .hpf-actions button') || [])];
  const prepare=buttons.find(button=>button.textContent.trim()===window.__card._t('gs.align_all'));
  return !window.__card._canEdit && prepare?.disabled===true && buttons.every(button=>button.disabled);
}));
record('denialHintDoesNotClaimAdminOnly', await settings().locator('.rhint').filter({ hasText: /write permission|права на изменение/ }).count() > 0);
record('onlyRequestedApplyWasSent', await page.evaluate(() => window.__892.writes.length === 1));
await finish(browser, results);
