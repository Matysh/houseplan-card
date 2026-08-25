import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const result = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  card._openSettingsDialog();
  await card.updateComplete;
  const group = [...root().querySelectorAll('.dispsection')]
    .some((node) => node.textContent.trim() === card._t('gs.backup_group'));
  const actions = root().querySelectorAll('.backupactions .btn').length;
  const importTrigger = root().querySelector('.backupupload > button');
  importTrigger?.focus();
  const keyboardImport = importTrigger?.tagName === 'BUTTON'
    && importTrigger.tabIndex === 0
    && importTrigger.matches(':focus');

  card._openBackupExport();
  await card.updateComplete;
  const exportRadios = root().querySelectorAll('input[name="backup-kind"]').length;
  const exportWarning = !!root().querySelector('.backupwarn');
  const planOnlyHiddenForFull = !root().querySelector('.backupplanonly');
  root().querySelector('input[name="backup-kind"][value="space"]')?.click();
  await card.updateComplete;
  const planOnly = root().querySelector('.backupplanonly input[type="checkbox"]');
  planOnly?.click();
  await card.updateComplete;
  const planOnlySpace = {
    visible: !!planOnly,
    checked: card._backupExportDialog?.planOnly === true,
    labelled: root().querySelector('.backupplanonly')?.textContent
      .includes(card._t('backup.plan_only')) === true,
  };
  root().querySelector('input[name="backup-kind"][value="full"]')?.click();
  await card.updateComplete;
  const planOnlyResetForFull = card._backupExportDialog?.planOnly === false
    && !root().querySelector('.backupplanonly');

  let sentExport = null;
  card.hass = {
    ...card.hass,
    callWS: async (message) => {
      sentExport = message;
      return { document: { smoke: true }, filename: 'plan-only-smoke.json' };
    },
  };
  card._backupExportDialog = {
    kind: 'space', planOnly: true, busy: false, error: '',
  };
  await card._runBackupExport();
  const planOnlyRequest = {
    kind: sentExport?.kind,
    planOnly: sentExport?.plan_only,
    space: sentExport?.space_id,
  };

  card._backupExportDialog = null;
  card._backupImportDialog = {
    filename: 'backup.json', size: 1024, token: 'opaque',
    preview: {
      kind: 'full', source: 'foreign', created_at: '2026-08-11T00:00:00Z',
      counts: { spaces: 1, rooms: 2, markers: 3, layout: 4 },
      confirmation_required: true,
      content: [{ url: '/api/houseplan/content/plans/_/floor.svg', state: 'detach_required' }],
    },
    expectedConfigRev: 1, expectedLayoutRev: 2, duplicatePolicy: 'skip',
    confirmMissing: false, busy: false, error: '',
  };
  await card.updateComplete;
  const apply = root().querySelector('hp-dialog .btn.danger');
  const importSafe = {
    danger: !!apply,
    disabledUntilConfirmed: !!apply?.disabled,
    noHorizontalOverflow: root().querySelector('hp-dialog').scrollWidth
      <= root().querySelector('hp-dialog').clientWidth,
  };
  card._backupImportDialog = {
    filename: 'houseplan-space-plan-only.json', size: 2048, token: 'plan-only',
    preview: {
      kind: 'space', plan_only: true, source: 'same',
      created_at: '2026-08-17T00:00:00Z', space_title: 'Ground (2)',
      counts: { spaces: 1, rooms: 2, markers: 0, layout: 2 },
      bindings: { device: 0, entity: 0, virtual: 0, active: 0, disabled: 0, missing: 0 },
      duplicates: 0, confirmation_required: false, content: [],
      repaired_target_refs: 2, preserved_unresolved_refs: 1,
      reference_report: {
        remapped: {
          incoming: { 'layout.space': 2 }, target: { 'marker.space': 2 },
        },
        collisions: {}, preservedUnresolved: { 'marker.room_id': 1 },
        droppedIncomingLinks: {}, boundedLineages: 0,
        examples: [{
          bucket: 'preservedUnresolved', category: 'marker.room_id',
          owner: 'legacy-marker', reference: 'room_old_deadbeef',
        }],
      },
    },
    expectedConfigRev: 1, expectedLayoutRev: 2, duplicatePolicy: 'skip',
    confirmMissing: false, busy: false, error: '',
  };
  await card.updateComplete;
  const planOnlyPreview = {
    visible: root().querySelector('.backupplanonlystatus')?.textContent
      === card._t('backup.plan_only_preview'),
    noDuplicatePolicy: !root().querySelector('.backupchoices'),
    noHorizontalOverflow: root().querySelector('hp-dialog').scrollWidth
      <= root().querySelector('hp-dialog').clientWidth,
    hasReferenceReport: !!root().querySelector('.backupdetails')
      && root().querySelector('.backupdetails')?.textContent
        .includes(card._t('backup.import_details')),
    warnsWithoutDiscarding: root().querySelector('.backupwarn')?.textContent
      .includes(card._t('backup.preserved_unresolved_hint')) === true,
  };
  return {
    group, actions, keyboardImport, exportRadios, exportWarning,
    planOnlyHiddenForFull, planOnlySpace, planOnlyResetForFull, planOnlyRequest,
    importSafe, planOnlyPreview,
  };
});

checkAll(result, {
  group: true,
  actions: 2,
  keyboardImport: true,
  exportRadios: 2,
  exportWarning: true,
  planOnlyHiddenForFull: true,
  planOnlySpace: { visible: true, checked: true, labelled: true },
  planOnlyResetForFull: true,
  planOnlyRequest: { kind: 'space', planOnly: true, space: 'f1' },
  importSafe: { danger: true, disabledUntilConfirmed: true, noHorizontalOverflow: true },
  planOnlyPreview: {
    visible: true, noDuplicatePolicy: true, noHorizontalOverflow: true,
    hasReferenceReport: true, warnsWithoutDiscarding: true,
  },
});
await finish(browser, result);
