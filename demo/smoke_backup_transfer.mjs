import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const result = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  card._openSettingsDialog();
  await card.updateComplete;
  root().querySelector('[data-section-target="data"]').click(); await card.updateComplete;
  const groupNode = root().querySelector('[data-card="data"]');
  const group = groupNode?.querySelector('h3')?.textContent.trim() === 'Backups and maintenance';
  const actions = groupNode?.querySelector('.hpf-actions')?.querySelectorAll('.btn').length ?? 0;
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
  // #1033 AC1: the export button names no format, for a full ZIP and a space JSON.
  const exportConfirm = () => root().querySelector('hp-dialog[data-kind="backup"] [data-hp="dialog-confirm"]')
    ?.textContent.trim();
  const downloadLabel = { full: exportConfirm() };
  root().querySelector('input[name="backup-kind"][value="space"]')?.click();
  await card.updateComplete;
  downloadLabel.space = exportConfirm();
  downloadLabel.key = card._t('backup.download');
  root().querySelector('input[name="backup-kind"][value="full"]')?.click();
  await card.updateComplete;

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
  await window.__hpTest.settled();
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
  // #1033 AC11: repaired openings are reported, and keeping them off walls is confirmed.
  const OPENINGS_CONFIRM = 'Openings that do not fit their walls will be kept off walls.';
  const openingPreview = (repairs, content = []) => ({
    filename: 'houseplan-full.json', size: 4096, token: 'openings',
    preview: {
      kind: 'full', source: 'same', created_at: '2026-10-23T00:00:00Z',
      counts: { spaces: 1, rooms: 1, markers: 0, layout: 0, openings: 3 },
      confirmation_required: !!repairs.detached || content.length > 0,
      content, opening_repairs: repairs,
    },
    expectedConfigRev: 1, expectedLayoutRev: 2, duplicatePolicy: 'skip',
    confirmMissing: false, busy: false, error: '',
  });
  const dialogText = () => root().querySelector('hp-dialog[data-kind="backup"]')?.textContent || '';
  card._backupImportDialog = openingPreview({ // private-ok: #1033 a server preview with opening_repairs; the demo has no HA import backend (same seam as the previews above)
    rehosted: 1, detached: 2, legacy_detached: 0,
    examples: [
      { space_id: 'f1', space_title: 'Ground', opening_id: 'd1', type: 'door', result: 'detached' },
      { space_id: 'f1', space_title: 'Ground', opening_id: 'w1', type: 'window', result: 'detached' },
      { space_id: 'f1', space_title: 'Ground', opening_id: 'p1', type: 'passage', result: 'rehosted' },
    ],
  });
  await card.updateComplete;
  const openingsApply = () => root().querySelector('hp-dialog[data-kind="backup"] [data-hp="dialog-confirm"]');
  const summary = root().querySelector('[data-hp="action"][data-action="backup-openings-details"]');
  const openingsReport = {
    rehosted: dialogText().includes('Openings put back onto their wall: 1.'),
    detached: [...root().querySelectorAll('.backupwarn')]
      .some((node) => node.textContent.includes('Openings kept off walls: 2. They stay where they were')),
    details: summary?.textContent.trim() === 'Show openings',
    examples: [...(summary?.parentElement?.querySelectorAll('span') || [])].map((node) => node.textContent.trim()),
    confirmText: root().querySelector('.backupconfirm span')?.textContent.trim()
      === OPENINGS_CONFIRM,
    disabledUntilConfirmed: openingsApply()?.disabled === true,
  };
  const confirmBox = root().querySelector('[data-field="backup-confirm-missing"]');
  confirmBox?.click();
  await card.updateComplete;
  openingsReport.enabledAfterConfirm = openingsApply()?.disabled === false;
  openingsReport.noHorizontalOverflow = root().querySelector('hp-dialog').scrollWidth
    <= root().querySelector('hp-dialog').clientWidth;
  card._backupImportDialog = openingPreview( // private-ok: #1033 a server preview with opening_repairs; the demo has no HA import backend (same seam as the previews above)
    { rehosted: 0, detached: 1, legacy_detached: 0, examples: [] },
    [{ url: '/api/houseplan/content/plans/_/floor.svg', state: 'detach_required' }],
  );
  await card.updateComplete;
  openingsReport.joinedConfirmText = root().querySelector('.backupconfirm span')?.textContent.trim()
    === `${card._t('backup.confirm_detach')} ${OPENINGS_CONFIRM}`;
  card._backupImportDialog = openingPreview({ rehosted: 0, detached: 0, legacy_detached: 0, examples: [] }); // private-ok: #1033 a server preview with opening_repairs; the demo has no HA import backend (same seam as the previews above)
  await card.updateComplete;
  openingsReport.silentWhenNothingRepaired = !dialogText().includes('Show openings')
    && !root().querySelector('[data-action="backup-openings-details"]')
    && !root().querySelector('.backupconfirm');
  return {
    group, actions, keyboardImport, exportRadios, exportWarning, downloadLabel, openingsReport,
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
  downloadLabel: { full: 'Download', space: 'Download', key: 'Download' },
  openingsReport: {
    rehosted: true, detached: true, details: true,
    examples: ['Ground — Door (d1)', 'Ground — Window (w1)', 'Ground — Open passage (p1)'],
    confirmText: true, disabledUntilConfirmed: true, enabledAfterConfirm: true,
    noHorizontalOverflow: true, joinedConfirmText: true, silentWhenNothingRepaired: true,
  },
  planOnlyRequest: { kind: 'space', planOnly: true, space: 'f1' },
  importSafe: { danger: true, disabledUntilConfirmed: true, noHorizontalOverflow: true },
  planOnlyPreview: {
    visible: true, noDuplicatePolicy: true, noHorizontalOverflow: true,
    hasReferenceReport: true, warnsWithoutDiscarding: true,
  },
});
await finish(browser, result);
