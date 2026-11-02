// Copied into the companion's private lab by prepareConverterSuite, never its checkout.
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONVERTER_CASES, CONVERTER_URL } from './process-next-converter-cases.mjs';
import { openMaintenance, chooseBackup, previewReply } from './lib/backup.mjs';
import { planConfig } from './lib/ha-ws.mjs';
import { expectPlanDrawn, evidence } from './lib/ha-page.mjs';
import { selectSpace, field } from './lib/plan.mjs';
import { HP, hp } from './lib/hooks.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const values = (rows, key) => (rows ?? []).map(row => row[key]).sort();
const roomNames = space => values(space.rooms, 'name');

for (const fixture of CONVERTER_CASES) test(fixture.title, async ({ page, browser }, testInfo) => {
  const report = { format: fixture.id, status: 'unavailable', phase: 'published-page',
    startedAt: new Date().toISOString(), candidate: process.env.HOUSEPLAN_REF,
    expectedVersion: process.env.HOUSEPLAN_EXPECTED_VERSION, fixture: fixture.file };
  let external;
  try {
    // Never give the public converter the HA browser's authentication/storage.
    external = await browser.newContext({ storageState: { cookies: [], origins: [] }, acceptDownloads: true, locale: 'en-US' });
    const converter = await external.newPage();
    const resources = [], pending = [];
    converter.on('response', response => {
      if (new URL(response.url()).origin === new URL(CONVERTER_URL).origin
          && ['script', 'stylesheet'].includes(response.request().resourceType())) {
        pending.push(response.body().then(bytes => resources.push({ url: response.url(), sha256: hash(bytes) }))
          .catch(error => resources.push({ url: response.url(), unavailable: error.message })));
      }
    });
    const response = await converter.goto(CONVERTER_URL, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) throw Error(`Published converter HTTP ${response?.status() ?? 'no response'}`);
    const html = await response.body();
    report.published = { requestedUrl: CONVERTER_URL, url: response.url(), sha256: hash(html),
      etag: response.headers().etag ?? null, lastModified: response.headers()['last-modified'] ?? null, resources };
    await testInfo.attach('published-converter.html', { body: html, contentType: 'text/html' });
    report.phase = 'conversion'; report.status = 'failed';
    await converter.locator('[data-lang="en"]').click();
    await converter.locator('#format').selectOption(fixture.id);
    if (fixture.width) {
      await converter.locator('#picture-width').fill(String(fixture.width));
      await converter.locator('#picture-height').fill(String(fixture.height));
    }
    await converter.locator('#file').setInputFiles(fileURLToPath(new URL(`../fixtures/process-next-converters/${fixture.file}`, import.meta.url)));
    await expect(converter.locator('#result')).toBeVisible();
    await expect(converter.locator('.level button')).toHaveCount(1);
    const downloaded = converter.waitForEvent('download');
    await converter.locator('.level button').click();
    const download = await downloaded;
    const downloadedPath = testInfo.outputPath(`${fixture.id}.json`);
    await download.saveAs(downloadedPath);
    const bytes = readFileSync(downloadedPath), document = JSON.parse(bytes);
    report.download = { name: download.suggestedFilename(), sha256: hash(bytes), bytes: bytes.length,
      converterVersion: document.card_version, modelVersion: document.model_version };
    await testInfo.attach(download.suggestedFilename(), { body: bytes, contentType: 'application/json' });
    expect(document.kind).toBe('space');
    expect(document.payload.config.spaces).toHaveLength(1);
    const source = document.payload.config.spaces[0], sourceMarkers = document.payload.config.markers ?? [];
    expect(source.title).toBe(fixture.space);
    expect(roomNames(source)).toEqual([...fixture.rooms].sort());
    expect(values(source.openings, 'type')).toEqual([...fixture.openings].sort());
    expect(sourceMarkers).toHaveLength(fixture.markers);
    if (fixture.id === 'sh3d') expect(source.wall_segments).toHaveLength(7);
    if (fixture.id === 'easy') {
      expect(source.decor.some(item => item.kind === 'furniture')).toBe(true);
      expect(sourceMarkers.find(item => item.binding === 'entity:light.strip')).toMatchObject({
        is_light: true, glow_radius_cm: 150, glow_color: { c: '#aabbcc' },
      });
    }
    if (fixture.id === 'picture') {
      expect(source.decor).toHaveLength(2);
      expect(sourceMarkers.find(item => item.name === 'Night script')).toMatchObject({ binding: 'virtual', tap_action: 'run', tap_target: 'script.night' });
      report.dimensions = { width: fixture.width, height: fixture.height };
    }
    await Promise.allSettled(pending); report.published.resources = resources.sort((a, b) => a.url.localeCompare(b.url));
    await converter.screenshot({ path: testInfo.outputPath('published-result.png'), fullPage: true });
    await external.close(); external = null;

    report.phase = 'houseplan-import';
    const before = (await planConfig()).config;
    const { host, settings } = await openMaintenance(page);
    const previewed = previewReply(page);
    // Exactly the downloaded bytes, passed to the native file chooser unchanged.
    const dialog = await chooseBackup(page, host, settings, { name: download.suggestedFilename(), mimeType: 'application/json', buffer: bytes });
    const reply = await (await previewed).json();
    expect(reply.preview.kind).toBe('space');
    await expect(dialog).toContainText(download.suggestedFilename());
    await expect(dialog).toContainText(source.title);
    report.preview = { kind: reply.preview.kind, missingAreas: reply.preview.missing_areas, bindings: reply.preview.bindings };
    const confirmation = field(dialog, 'backup-confirm-missing');
    if (await confirmation.count() && await confirmation.isVisible()) await confirmation.check();
    await expect(dialog.locator(HP.dialogConfirm).first()).toBeEnabled();
    await dialog.locator(HP.dialogConfirm).first().click();
    await expect(host.locator(hp('toast', { id: 'backup.space_done' }))).toBeVisible();
    const imported = (await planConfig()).config;
    const added = imported.spaces.filter(space => !before.spaces.some(old => old.id === space.id));
    expect(added).toHaveLength(1);
    const space = added[0];
    const markers = imported.markers.filter(marker => marker.space === space.id);
    expect(space.title).toBe(source.title);
    expect(roomNames(space)).toEqual(roomNames(source));
    expect(values(space.openings, 'type')).toEqual(values(source.openings, 'type'));
    expect(values(space.decor, 'kind')).toEqual(values(source.decor, 'kind'));
    expect(values(markers, 'binding')).toEqual(values(sourceMarkers, 'binding'));
    await page.reload();
    await expectPlanDrawn(page, host);
    await selectSpace(host, space.id);
    const persisted = (await planConfig()).config;
    expect(persisted.spaces.find(item => item.id === space.id)).toEqual(space);
    expect(persisted.markers.filter(item => item.space === space.id)).toEqual(markers);
    for (const room of space.rooms ?? []) await expect(host.locator(hp('room', { id: room.id })).first()).toBeAttached();
    for (const opening of space.openings ?? []) await expect(host.locator(hp('opening', { id: opening.id })).first()).toBeVisible();
    for (const marker of markers) await expect(host.locator(hp('device', { id: marker.id })).first()).toBeVisible();
    await evidence(testInfo, page, `converter-${fixture.id}-reopened`);
    report.imported = { space: space.id, rooms: space.rooms?.length ?? 0, markers: markers.length,
      openings: space.openings?.length ?? 0, decor: space.decor?.length ?? 0 };
    report.phase = 'complete'; report.status = 'passed';
  } catch (error) {
    report.error = error.message;
    throw error;
  } finally {
    await external?.close();
    report.finishedAt = new Date().toISOString();
    const directory = process.env.HP_CONVERTER_REPORT_DIR;
    if (!directory) throw Error('Private converter report directory is required');
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, `${fixture.id}.json`), JSON.stringify(report, null, 2));
    await testInfo.attach('converter-result', { body: Buffer.from(JSON.stringify(report, null, 2)), contentType: 'application/json' });
  }
});
