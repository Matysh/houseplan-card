/**
 * Export and import as the journeys drive them (houseplan-card#1010, rows
 * 21–22): the General settings «Maintenance» section, the backup dialogs, and
 * the integration's own transfer endpoints for setup and for oracles.
 */
import { randomBytes } from 'node:crypto';
import { expect } from '@playwright/test';
import { HA_URL } from '../../scripts/users.mjs';
import { accessToken } from './ha-api.mjs';
import { planConfig, planLayout, wsCall } from './ha-ws.mjs';
import { HP, hp } from './hooks.mjs';
import { action, field, openPlan } from './plan.mjs';
import { readZip } from './zip.mjs';

/** The plan page with General settings open on «Maintenance». */
export async function openMaintenance(page) {
  const host = await openPlan(page);
  await host.locator(HP.settings).first().click();
  const settings = host.locator(HP.dialog('settings')).first();
  await expect(settings).toBeVisible();
  await settings.locator(hp('settings-section', { kind: 'general', section: 'data' })).first().click();
  await expect(action(settings, 'backup-export-open')).toBeVisible();
  return { host, settings };
}

/** Picks a file in «Import…» the way a user does, and returns the backup dialog it opens. */
export async function chooseBackup(page, host, settings, file) {
  const chooser = page.waitForEvent('filechooser');
  await action(settings, 'backup-import-open').click();
  await (await chooser).setFiles(file);
  const dialog = host.locator(HP.dialog('backup')).first();
  await expect(dialog).toBeVisible();
  return dialog;
}

/** The footer «Cancel» of a backup dialog (the header close button carries the same hook). */
export const footerCancel = (dialog) => dialog.locator(HP.dialogCancel).filter({ hasText: /cancel/i }).last();

/** The preview reply the dialog is built from, captured as the card receives it. */
export const previewReply = (page) => page.waitForResponse((r) => /\/api\/houseplan\/(backup\/)?import\/preview/.test(r.url()) && r.request().method() === 'POST');

async function post(path, body, headers) {
  const response = await fetch(`${HA_URL}${path}`, {
    method: 'POST', body, headers: { Authorization: `Bearer ${await accessToken('admin')}`, ...headers },
  });
  const reply = await response.json().catch(() => ({}));
  return { status: response.status, reply };
}

/** Setup path: a full ZIP restored through the integration (not a journey step). */
export async function restoreArchive(zip, { confirm = false } = {}) {
  const { status, reply } = await post('/api/houseplan/backup/import/preview', zip, {
    'content-type': 'application/zip', 'x-houseplan-operation': randomBytes(16).toString('hex'),
  });
  if (status !== 200) throw new Error(`archive preview: HTTP ${status} ${JSON.stringify(reply)}`);
  const applied = await wsCall({
    type: 'houseplan/import/apply', token: reply.token, expected_config_rev: reply.expected_config_rev,
    expected_layout_rev: reply.expected_layout_rev, confirm_missing_content: confirm,
  });
  return { ...applied, preview: reply.preview };
}

/** Setup path: a JSON export previewed by the integration; the preview is the oracle. */
export async function previewJson(document) {
  return post('/api/houseplan/import/preview?duplicate_policy=skip', JSON.stringify(document), { 'content-type': 'application/json' });
}

/** The full ZIP the product writes right now, read back: entries, manifest, document, topics. */
export async function exportArchive() {
  const prepared = await wsCall({ type: 'houseplan/export/create', kind: 'full', card_version: 'e2e', archive: true });
  const response = await fetch(`${HA_URL}/api/houseplan/backup/export/${prepared.token}`, {
    method: 'POST', body: JSON.stringify({ confirm_missing_content: !prepared.complete }),
    headers: { Authorization: `Bearer ${await accessToken('admin')}`, 'content-type': 'application/json' },
  });
  if (!response.ok) throw new Error(`archive download: HTTP ${response.status}`);
  return { prepared, ...openArchive(Buffer.from(await response.arrayBuffer())) };
}

/** A House Plan ZIP opened: every entry, the manifest and the document parsed. */
export function openArchive(zip) {
  const entries = readZip(zip);
  const manifest = JSON.parse(entries['manifest.json']);
  const document = JSON.parse(entries['document.json']);
  const topics = entries['zigbee.json'] ? JSON.parse(entries['zigbee.json']).topics : null;
  return { zip, entries, manifest, document, topics };
}

/**
 * A document with every packed image reference replaced by the hash of the
 * bytes it points to: an import renames backdrop files, so two archives of
 * the same plan agree on content, not on file names.
 */
export function byContent({ manifest, document }) {
  const byUrl = new Map(manifest.images.filter((row) => row.blob).map((row) => [row.ref.url, manifest.blobs[row.blob].sha256]));
  const copy = JSON.parse(JSON.stringify(document.payload));
  for (const space of copy.config.spaces) if (byUrl.has(space.plan_url)) space.plan_url = `sha256:${byUrl.get(space.plan_url)}`;
  return copy;
}

/** The revisions the integration reports: unchanged revisions mean nothing was written. */
export async function revisions() {
  const [config, layout] = await Promise.all([planConfig(), planLayout()]);
  return { config: config.rev, layout: layout.rev };
}

/** The value of one radio/checkbox field of the export dialog. */
export const kindField = (dialog, value) => field(dialog, 'backup-kind', value);
