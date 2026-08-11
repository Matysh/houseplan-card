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
  return { group, actions, keyboardImport, exportRadios, exportWarning, importSafe };
});

checkAll(result, {
  group: true,
  actions: 2,
  keyboardImport: true,
  exportRadios: 2,
  exportWarning: true,
  importSafe: { danger: true, disabledUntilConfirmed: true, noHorizontalOverflow: true },
});
await finish(browser, result);
