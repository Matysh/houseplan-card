/** #1022: native offline file/paste/download and delayed local image ownership. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { readPicture } from '../../scripts/sh3d-convert/picture.mjs';

export async function exercisePictureConverter(page, root) {
  const source = readFileSync(root('fixtures/picture-elements.yaml'), 'utf8');
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.locator('[data-lang=en]').click();
  await page.locator('#format').selectOption('picture');
  await page.locator('#paste').fill(source);
  await page.locator('#convert-paste').click();
  assert.match(await page.locator('#error-text').innerText(), /image size/i);
  assert.equal(await page.locator('.level button').count(), 0);
  await page.locator('#picture-width').fill('1600');
  await page.locator('#picture-height').fill('1000');
  assert.match(await page.locator('#picture-size-status').innerText(), /typed in/);
  await page.locator('#convert-paste').click();
  await page.locator('#result').waitFor({ state: 'visible' });
  assert.match(await page.locator('.stats').innerText(), /11 devices.*2 decor/);
  assert.match(await page.locator('#shared-notes').innerText(), /transferred 8, partial 5, skipped 5/);
  assert.match(await page.locator('#levels').innerText(), /element_image_skipped; #8/);
  assert.match(await page.locator('#levels').innerText(), /action_fallback_info; #6/);
  const downloadDocument = async () => {
    const event = page.waitForEvent('download');
    await page.locator('.level button').click();
    const download = await event;
    const document = JSON.parse(readFileSync(await download.path(), 'utf8'));
    const cli = spawnSync(process.execPath, ['scripts/sh3d-convert/cli.mjs', '--format', 'picture',
      '--width', '1600', '--height', '1000', '--now', document.created_at,
      'scripts/sh3d-convert/fixtures/picture-elements.yaml'], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(document, JSON.parse(cli.stdout)[0], 'page/CLI include identical explicit-clock metadata');
    const night = document.payload.config.markers.find(marker => marker.name === 'Night script');
    assert.equal(night.binding, 'virtual'); assert.equal(night.tap_action, 'run');
    assert.equal(night.tap_target, 'script.night'); assert.equal(night.tap_confirm, true);
    return document;
  };
  await downloadDocument();
  await page.screenshot({ path: root('.build/picture-page-en.png'), fullPage: true });

  // Decode a real, locally generated PNG. Only dimensions leave the decoder.
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1000;
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const image = { name: 'plan.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };
  await page.locator('#picture-image-file').setInputFiles(image);
  await page.waitForFunction(() => document.getElementById('picture-size-status').textContent.includes('from the file'));
  assert.equal(await page.locator('#picture-width').inputValue(), '1600');
  assert.equal(await page.locator('#picture-height').inputValue(), '1000');
  await page.locator('#convert-paste').click();
  assert.match(await page.locator('#shared-notes').innerText(), /picture_size_measured/);
  await downloadDocument();
  await page.locator('#picture-width').fill('800');
  await page.locator('#picture-height').fill('500');
  await page.locator('#drop').evaluate((zone, png) => {
    const bytes = Uint8Array.from(atob(png), char => char.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], 'dropped-plan.png', { type: 'image/png' }));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
  }, png);
  await page.waitForFunction(() => document.getElementById('picture-size-status').textContent.includes('from the file'));
  assert.equal(await page.locator('#picture-width').inputValue(), '1600');
  assert.equal(await page.locator('#picture-height').inputValue(), '1000');

  await page.locator('[data-lang=ru]').click();
  await page.locator('#file').setInputFiles({ name: 'picture.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(readPicture(source))) });
  await page.locator('#result').waitFor({ state: 'visible' });
  assert.match(await page.locator('#shared-notes').innerText(), /перенесено 8, частично 5, пропущено 5/);
  await downloadDocument();
  await page.setViewportSize({ width: 360, height: 800 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: root('.build/picture-page-ru.png'), fullPage: true });

  // Hold actual image completion until a newer manual edit/source has won.
  await page.evaluate(() => {
    const original = window.createImageBitmap.bind(window);
    window.createImageBitmap = async file => {
      const bitmap = await original(file);
      if (file.name === 'slow-image.png') {
        const close = bitmap.close.bind(bitmap);
        bitmap.close = () => { window.closedSlowImages = (window.closedSlowImages || 0) + 1; close(); };
        await new Promise(resolve => { window.releaseSlowImage = resolve; });
      }
      return bitmap;
    };
  });
  const slow = { ...image, name: 'slow-image.png' };
  await page.locator('#picture-image-file').setInputFiles(slow);
  await page.waitForFunction(() => typeof window.releaseSlowImage === 'function');
  assert.equal(await page.locator('#convert-paste').isDisabled(), true, 'pending image cannot use the previous aspect');
  await page.locator('#picture-width').fill('800');
  await page.locator('#picture-height').fill('500');
  assert.equal(await page.locator('#convert-paste').isDisabled(), false, 'explicit manual dimensions replace pending decode');
  await page.evaluate(() => window.releaseSlowImage());
  await page.waitForFunction(() => window.closedSlowImages === 1);
  assert.equal(await page.locator('#picture-width').inputValue(), '800');
  assert.equal(await page.locator('#picture-height').inputValue(), '500');
  assert.match(await page.locator('#picture-size-status').innerText(), /вручную/);

  await page.evaluate(() => { delete window.releaseSlowImage; });
  await page.locator('#picture-image-file').setInputFiles(slow);
  await page.waitForFunction(() => typeof window.releaseSlowImage === 'function');
  await page.locator('#paste').fill('type: vertical-stack\ncards: []');
  await page.locator('#convert-paste').click();
  assert.match(await page.locator('#error-text').innerText(), /одна карточка/);
  await page.evaluate(() => window.releaseSlowImage());
  await page.waitForFunction(() => window.closedSlowImages === 2);
  assert.equal(await page.locator('#picture-width').inputValue(), '800');
  assert.equal(await page.locator('#result').isVisible(), false);
  assert.equal(await page.locator('#error').isVisible(), true);

  // An untrusted local SVG is decoded as an image, never a document/script.
  await page.locator('#picture-image-file').setInputFiles({ name: 'untrusted.svg', mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24">'
      + '<image href="https://evil.invalid/never-fetch" width="32" height="24"/>'
      + '<script>window.userFileScriptExecuted=true</script></svg>') });
  await page.waitForFunction(() => document.getElementById('picture-width').value !== '800');
  assert.equal(await page.evaluate(() => window.userFileScriptExecuted), undefined);
  await page.locator('#picture-width').fill('1600');
  await page.locator('#picture-height').fill('1000');

  await page.locator('#paste').fill(JSON.stringify({ type: 'picture-elements', image: '/local/plan.png',
    elements: [{ type: 'image', id: '<img src=https://evil.invalid/never>', image: '/local/a.png' }] }));
  await page.locator('#convert-paste').click();
  assert.equal(await page.locator('#error').isVisible(), true);
  assert.equal(await page.locator('.level button').count(), 0);
  assert.match(await page.locator('#levels').innerText(), /element_image_skipped; #1/);
  assert.equal(await page.locator('img').count(), 0, 'report is text, never source HTML');
  console.log('PASS #1022: YAML/JSON, manual/measured dimensions, exact-clock CLI parity, losses/counts, RU/EN, stale-image ownership/close, no refused download');
}
