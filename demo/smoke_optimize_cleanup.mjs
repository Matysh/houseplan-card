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
  await settings().locator('button:has(ha-icon[icon="mdi:broom"])').click();
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
  await hp.waitForWrites(); await hp.setServerConfig(clean.config); await hp.waitForWrites();
  await hp.setLayout({ ...clean.layout,
    grp_obsolete: { s: 'deleted', x: 0.25, y: 0.5, k: 1.6 },
    future_widget: { s: 'deleted', x: 0.5, y: 0.5, future: true },
  });
  await hp.settled();
}, clean);
await open();
let before = await page.evaluate(() => ({ config: JSON.stringify(window.__card._serverCfg),
  layout: JSON.stringify(window.__card._layout), writer: window.__card._canEdit,
  admin: window.__card.hass.user.is_admin, eligible: window.__card._alignDialog.report.invalidPositionsEligible.length }));
record('ordinaryWriterNotAdminCanOpen', before.writer && !before.admin);
record('onlyProvenObsoletePositionEligible', before.eligible === 1);
await optimize().locator('.optimize-invalid-cleanup').click();
let selected = await page.evaluate(() => ({ removed: window.__card._alignDialog.report.invalidPositionsRemoved.map(x => x.id),
  future: window.__card._alignDialog.layout.future_widget,
  unchanged: JSON.stringify(window.__card._layout), writes: window.__892.writes.length }));
record('cleanupOnlyPreviewsWholeRecord', selected.removed.length === 1 && selected.removed[0] === 'grp_obsolete'
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
  return !card._layout.grp_obsolete && card._layout.future_widget?.future === true
    && card._alignDialog.report.invalidPositionsEligible.length === 0
    && !card._alignDialog.changed && card._canOptimizeUndo && card._undoKind === 'optimize';
}));
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
  const icons = ['mdi:broom', 'mdi:undo-variant'];
  return !window.__card._canEdit && icons.every(icon => {
    const button = dialog?.querySelector(`button:has(ha-icon[icon="${icon}"])`);
    return icon === 'mdi:broom' ? button?.disabled === true : !button || button.disabled;
  });
}));
record('denialHintDoesNotClaimAdminOnly', await settings().locator('.rhint').filter({ hasText: /write permission|права на изменение/ }).count() > 0);
record('onlyRequestedApplyWasSent', await page.evaluate(() => window.__892.writes.length === 1));
await finish(browser, results);
