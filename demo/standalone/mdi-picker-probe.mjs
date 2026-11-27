/** Exercise the shipped picker in a plan-only document without enabling device commands. */
import assert from 'node:assert/strict';

export async function verifyStandaloneMdiPicker(page, manifest, requests) {
  const mdiChunk = manifest.modules.find(module => module.modules.includes('src/mdi-icon-catalog.ts'))?.path;
  assert.ok(mdiChunk, 'the standalone distribution includes the full MDI catalog');
  const usedCatalog = () => requests.some(url => url.endsWith('/' + mdiChunk));
  assert.equal(usedCatalog(), false, 'cold standalone View does not request the MDI catalog');

  await page.evaluate(async () => {
    await customElements.whenDefined('hp-icon-picker');
    const picker = document.createElement('hp-icon-picker');
    picker.id = 'standalone-mdi-probe';
    picker.value = 'mdi:fan';
    picker.labels = {search:'Find icon',clear:'Clear',use:'Use',loading:'Loading',error:'Unavailable',retry:'Retry'};
    document.querySelector('.houseplan-standalone').prepend(picker);
  });
  const picker = page.locator('#standalone-mdi-probe');
  try {
    await page.waitForFunction(() => document.querySelector('#standalone-mdi-probe')._catalog?.size > 7000);
    await picker.locator('.trigger').click();
    const search = picker.locator('input[type=search]');
    await search.fill('alarm light');
    const option = picker.locator('[role="option"][data-icon="mdi:alarm-light"]');
    const shape = await option.locator('path').getAttribute('d');
    assert.ok(shape?.length > 80, 'standalone search results paint the bundled glyph');
    await search.press('Enter');
    assert.equal(await picker.evaluate(element => element.value), 'mdi:alarm-light');
    assert.ok(usedCatalog(), 'the standalone picker requests its packaged MDI chunk');
    assert.equal(requests.some(url => url.includes('/static/mdi/')), false, 'standalone uses its own catalog');
  } finally {
    await picker.evaluate(element => element.remove());
  }
}
