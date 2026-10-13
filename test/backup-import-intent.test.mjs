import assert from 'node:assert/strict';
import test from 'node:test';
import { BackupImportIntent, backupImportAllowed } from '../test-build/backup-import-intent.js';
import { ensureLanguage, dictionaryFor } from '../test-build/i18n/registry.js';

test('empty-screen import label exists in the four core locales without settings chunks', async () => {
  const expected = { en: 'Import backup', ru: 'Импорт резервной копии',
    de: 'Sicherung importieren', fr: 'Importer une sauvegarde' };
  for (const [locale, label] of Object.entries(expected)) {
    await ensureLanguage(locale);
    assert.equal(dictionaryFor(locale)['empty.import_backup'], label);
  }
});

test('backup ACL requires authoritative writer access, not an active space', () => {
  const access = { connected: true, loaded: true, server: true, writer: true, kiosk: false };
  assert.equal(backupImportAllowed(access), true);
  for (const key of ['connected', 'loaded', 'server', 'writer']) {
    assert.equal(backupImportAllowed({ ...access, [key]: false }), false, key);
  }
  assert.equal(backupImportAllowed({ ...access, kiosk: true }), false);
});

test('cancel and replacement revoke delayed loader, preview, error and apply ownership', () => {
  const intent = new BackupImportIntent();
  let focus = 0;
  const first = intent.begin(() => focus++);
  assert.equal(intent.loading, true);
  intent.cancel();
  assert.equal(intent.owns(first), false);
  assert.equal(intent.loading, false);
  assert.equal(focus, 1);
  intent.cancel();
  assert.equal(focus, 1, 'cancel must not restore focus twice');
  const second = intent.begin();
  const third = intent.begin();
  assert.equal(intent.owns(second), false);
  intent.opened(second);
  assert.equal(intent.loading, true, 'late loader cannot settle the replacement');
  intent.opened(third);
  assert.equal(intent.loading, false);
  assert.equal(intent.owns(third), true);
  intent.cancel(false);
  assert.equal(intent.owns(third), false);
});

test('disconnect/success discard the focus callback, so a later dialog cannot inherit it', () => {
  const intent = new BackupImportIntent();
  let focus = 0;
  intent.begin(() => focus++);
  intent.cancel(false);
  intent.begin();
  intent.cancel();
  assert.equal(focus, 0);
});
