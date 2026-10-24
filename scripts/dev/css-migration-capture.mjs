/** Bounded, ordinary dialog states for CSS-only before/after comparisons (#1019).
 * Build and bundle-sync each checkout first. Use the SAME script and pinned
 * browser for --root=<immutable before> and --root=<candidate>; --compare reads
 * those captures, never accepts a global golden baseline.
 */
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {launchHaDialogFixture, applyHaDialogTypography} from '../../demo/helpers/ha-dialog-fixture.mjs';
import {DETERMINISTIC_ARGS} from '../../demo/docs/browser-args.mjs';

const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = resolve(option('root') || '.');
const output = resolve(option('out') || 'artifacts/css-migration');
const comparison = option('compare') && resolve(option('compare'));
const fromRoot = path => import(pathToFileURL(join(root, path)).href);
const {installHpTestOnPage} = await fromRoot('demo/helpers/hp-test.mjs');
const {ensureHarnessEditorRuntime} = await fromRoot('demo/editor-runtime-compat.mjs');
const {installSettingsDeviceFixture, openSettingsDeviceDialog} = await fromRoot('demo/helpers/settings-device-947-fixture.mjs');
const {settingsSection} = await fromRoot('demo/helpers/settings-section.mjs');
const {assertFreshDemoBundle} = await fromRoot('demo/bundle-freshness.mjs');
const {attestLaunchedBrowser} = await fromRoot('scripts/browser-attestation.mjs');
const fixture = await launchHaDialogFixture({authentic: true, repoRoot: root,
  viewport: {width: 1280, height: 900},
  browserArgs: DETERMINISTIC_ARGS});
const {page, browser} = fixture;
const card = page.locator('houseplan-card');
const receipt = {root, node: process.version,
  scriptSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  captures: [], compared: Boolean(comparison), completed: false};
mkdirSync(output, {recursive: true});
const settle = async () => {
  await page.evaluate(() => window.__hpTest.settled());
  // Native HA entry/resize and common action transitions settle naturally.
  await page.waitForTimeout(300);
};
const save = async (dialog, id) => {
  await settle();
  await dialog.evaluate(async el => {
    const roots = [el];
    for (let i = 0; i < roots.length; i++) for (const node of roots[i].querySelectorAll('*'))
      if (node.shadowRoot) roots.push(node.shadowRoot);
    const finite = roots.flatMap(root => root.getAnimations?.({subtree: true}) || [])
      .filter(animation => animation.effect?.getTiming().iterations !== Infinity);
    await Promise.allSettled(finite.map(animation => animation.finished));
    await document.fonts.ready;
  });
  const snapshot = await dialog.evaluate(el => {
    const properties = ['display','position','boxSizing','width','height','minWidth','maxWidth','minHeight',
      'padding','margin','gap','rowGap','columnGap','alignItems','justifyContent','flex','flexWrap','flexDirection',
      'gridTemplateColumns','gridColumn','overflow','overflowWrap','whiteSpace','resize','cursor','opacity',
      'border','borderRadius','backgroundColor','color','font','lineHeight','textDecoration','boxShadow','outline'];
    const nodes = [el, ...el.querySelectorAll('*')];
    return nodes.map(node => {
      const style = getComputedStyle(node), rect = node.getBoundingClientRect();
      return {tag: node.localName, classes: node.getAttribute('class'), field: node.getAttribute('data-field'),
        geometry: [rect.x, rect.y, rect.width, rect.height].map(value => Math.round(value * 1000) / 1000),
        paint: Object.fromEntries(properties.map(name => [name, style[name]])),
        iconSize: style.getPropertyValue('--mdc-icon-size').trim()};
    });
  });
  const bytes = await dialog.locator('ha-dialog wa-dialog dialog').screenshot({animations: 'disabled', caret: 'hide'});
  writeFileSync(join(output, `${id}.json`), JSON.stringify(snapshot, null, 2) + '\n');
  writeFileSync(join(output, `${id}.png`), bytes);
  if (comparison) {
    const before = JSON.parse(readFileSync(join(comparison, `${id}.json`), 'utf8'));
    if (!isDeepStrictEqual(snapshot, before)) {
      const differences = snapshot.flatMap((entry, i) => isDeepStrictEqual(entry, before[i]) ? [] :
        [{index: i, tag: entry.tag, classes: entry.classes, before: before[i], after: entry}]);
      writeFileSync(join(output, `${id}.differences.json`), JSON.stringify({beforeCount: before.length, afterCount: snapshot.length, differences}, null, 2));
      throw new Error(`Computed style/geometry differs: ${id}; see ${id}.differences.json`);
    }
    if (!bytes.equals(readFileSync(join(comparison, `${id}.png`)))) throw new Error(`Image differs: ${id}`);
  }
  receipt.captures.push({id, elements: snapshot.length, imageSha256: createHash('sha256').update(bytes).digest('hex')});
  console.log(`captured ${id}: ${snapshot.length} elements${comparison ? ', computed/geometry/PNG identical' : ''}`);
};
const close = async () => {
  await page.evaluate(() => window.__hpTest.close());
  await settle();
};

try {
  receipt.browser = await attestLaunchedBrowser(browser, {reason: '#1019 CSS migration visual comparison'});
  await page.emulateMedia({reducedMotion: 'reduce'});
  const palettes = {
    light: ['#fff','#eceeef','#223039','#64747e','#dce2e6','#008aa5'],
    dark: ['#17222e','#0f1822','#e7eef4','#a6b6c3','#354755','#67cfe8'],
    custom: ['#fff6e9','#f0e2d0','#35291d','#75634e','#d6c3ac','#9b45b7'],
  };
  const themes = option('themes')?.split(',') || Object.keys(palettes);
  const widths = option('widths')?.split(',').map(Number) || [1280, 600, 390];
  if (themes.some(theme => !palettes[theme]) || widths.some(width => !Number.isInteger(width) || width < 280))
    throw new Error('Unknown theme or invalid viewport width');
  receipt.matrix = {themes, widths};
  for (const theme of themes) for (const width of widths) {
    const palette = palettes[theme];
    await page.setViewportSize({width, height: 900});
    // A fresh document per viewport prevents earlier native-HA/SVG resize raster
    // history from becoming the comparison oracle. No product style override.
    await page.goto(fixture.url + '/product.html');
    await applyHaDialogTypography(page);
    await page.waitForFunction(() => window.__card?._booting === false && window.__card?._devices?.length > 0);
    receipt.sourceFingerprint = await assertFreshDemoBundle(page, root);
    if (!await page.evaluate(ensureHarnessEditorRuntime)) throw new Error('Editor preload failed');
    await installHpTestOnPage(page);
    await installSettingsDeviceFixture(page);
    await card.evaluate((el, palette) => {
      ['--card-background-color','--primary-background-color','--primary-text-color','--secondary-text-color','--divider-color','--primary-color'].forEach((key, i) => el.style.setProperty(key, palette[i]));
      el.style.setProperty('--secondary-background-color', palette[1]);
    }, palette);
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.__hpTest.setMode('devices'));
    await card.locator('[data-tool=icon-rules]').click();
    const rules = card.locator('hp-dialog[data-kind=rules]');
    await rules.waitFor();
    await save(rules, `${theme}-${width}-rules-valid`);
    await rules.locator('[data-field=icon-rule-pattern]').first().fill('[');
    await page.mouse.move(0, 0);
    if (await rules.locator('.rpat.bad').count() !== 1) throw new Error('Invalid-pattern state was not reached');
    await save(rules, `${theme}-${width}-rules-invalid`);
    await rules.locator('[data-action=icon-rule-delete]').first().hover();
    await save(rules, `${theme}-${width}-rules-delete-hover`);
    await page.mouse.move(0, 0);
    await rules.locator('[data-field=icon-rule-pattern]').first().focus();
    await save(rules, `${theme}-${width}-rules-focus`);
    await close();

    await card.locator('[data-tool=device-inbox]').click();
    const inbox = card.locator('hp-dialog[data-kind=device-inbox]');
    await inbox.waitFor();
    for (const tab of ['on_plan', 'available', 'hidden', 'readd']) {
      await inbox.locator(`[data-field=device-catalog-tab][data-value=${tab}]`).click();
      await page.mouse.move(0, 0);
      await save(inbox, `${theme}-${width}-inbox-${tab}`);
      if (tab === 'available') {
        const summary = inbox.locator('.device-inbox-discovery > summary');
        await summary.click();
        await page.mouse.move(0, 0);
        await save(inbox, `${theme}-${width}-inbox-discovery`);
      }
    }
    await inbox.locator('[data-field=device-catalog-search]').fill('no-such-device-1019');
    await page.mouse.move(0, 0);
    await save(inbox, `${theme}-${width}-inbox-empty`);
    await close();

    await openSettingsDeviceDialog(page, 'demo_radar');
    const radar = card.locator('hp-dialog[data-kind=marker]');
    await settingsSection(radar, 'radar');
    await page.mouse.move(0, 0);
    await save(radar, `${theme}-${width}-radar-active`);
    // The existing public fields expose both select and numeric coordinate rows.
    const coordinate = radar.locator('[data-field=radar-mount-x]');
    await coordinate.scrollIntoViewIfNeeded();
    await coordinate.focus();
    await save(radar, `${theme}-${width}-radar-coordinate-focus`);
    await radar.locator('[data-action=radar-configure]').click();
    const wizard = radar.locator('.radarsetup');
    await wizard.waitFor();
    await page.mouse.move(0, 0);
    await save(radar, `${theme}-${width}-radar-wizard`);
    await wizard.locator('.radarsetup-head button').click();
    await wizard.waitFor({state: 'detached'});
    await close();
  }
  await fixture.assertClean();
  receipt.completed = true;
} finally {
  writeFileSync(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  await fixture.close();
}
