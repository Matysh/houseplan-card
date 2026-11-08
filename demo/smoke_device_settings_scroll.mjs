// #1354: content scroll cannot move the device-section navigation.
import { launch, check, finish, requirePinnedBrowser, watchPage } from './serve.mjs';
import { installSettingsDeviceFixture, openSettingsDeviceDialog } from './helpers/settings-device-947-fixture.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';

requirePinnedBrowser('#1354 device settings scroll');
for (const authentic of process.argv.includes('--authentic') ? [true] : [false, true]) {
const fixture = authentic
  ? await (await import('./helpers/ha-dialog-fixture.mjs')).launchHaDialogFixture({ viewport: { width: 1280, height: 900 }, cacheDir: process.env.HP_HA_DIALOG_CACHE })
  : await launch({ width: 1280, height: 900 });
const { page, browser } = fixture;
try {
  if (authentic) {
    watchPage(page);
    await (await import('../scripts/browser-attestation.mjs')).enforcePinnedBrowser(browser);
    await page.goto(fixture.url + '/product.html');
    await page.waitForFunction(() => window.__card?._model?.length && !window.__card._booting);
    await page.evaluate(() => window.__card._ensureEditorRuntime());
    await installHpTestOnPage(page);
    await assertFreshDemoBundle(page, process.cwd());
  }
  await installSettingsDeviceFixture(page);
  await openSettingsDeviceDialog(page, 'demo_living_climate');
  const dialog = page.locator('houseplan-card hp-dialog[data-kind="marker"]');
  await dialog.evaluate(element => {
    window.__scroll1354 = { dialog: element, name: element.querySelector('#marker-name'), config: JSON.stringify(window.__card._serverCfg) };
  });
  for (const viewport of [{ width: 1280, height: 900 }, { width: 1000, height: 380 }, { width: 390, height: 700 }]) {
    await page.setViewportSize(viewport);
    const mobile = viewport.width <= 550;
    const section = async id => {
      if (mobile) await dialog.locator('[data-field="settings-section"]').selectOption(id);
      else await dialog.locator(`[data-section-target="${id}"]`).click();
      await page.evaluate(() => window.__hpTest.settled());
    };
    await section('appearance');
    const measure = () => dialog.evaluate(element => {
      const box = node => { const r = node.getBoundingClientRect(); return { y: r.y, bottom: r.bottom, height: r.height }; };
      const content = element.querySelector('.hpf-settings-content');
      const navigation = element.querySelector('.hpf-settings-nav');
      const hr = navigation.querySelector('hr'), style = getComputedStyle(hr);
      return { navigation: box(navigation), first: box(navigation.querySelector('button')),
        mobile: box(element.querySelector('.hpf-settings-mobile')), content: box(content), top: content.scrollTop,
        footer: box(element.querySelector('[slot="footer"]')), header: box(element.shadowRoot.querySelector('.header')),
        divider: { after: hr.previousElementSibling?.dataset.section, width: parseFloat(style.borderTopWidth),
          style: style.borderTopStyle, margin: parseFloat(style.marginTop) },
        fits: content.scrollWidth <= content.clientWidth + 1 };
    });
    const before = await measure();
    await dialog.locator('.hpf-settings-content').hover({ position: { x: 80, y: Math.min(60, before.content.height / 2) } });
    await page.mouse.wheel(0, 900);
    await page.waitForFunction(() => {
      const content = window.__scroll1354.dialog.querySelector('.hpf-settings-content');
      return content.scrollTop > 0 || content.getBoundingClientRect().top < 0;
    });
    const after = await measure(), label = `${authentic ? 'ha' : 'fallback'}-${viewport.width}x${viewport.height}`;
    check(`${label}-main-content-scrolls`, after.top > 0);
    check(`${label}-navigation-stays`, mobile
      ? Math.abs(after.mobile.y - before.mobile.y) < .5
      : Math.abs(after.first.y - before.first.y) < .5);
    check(`${label}-header-footer-stay`, Math.abs(after.header.y - before.header.y) < .5 && Math.abs(after.footer.y - before.footer.y) < .5);
    check(`${label}-content-fits`, after.fits && after.content.height > 0);
    if (!mobile) {
      check(`${label}-compact-visible-divider-after-details`, after.divider.after === 'details'
        && after.divider.width === 1 && after.divider.style === 'solid' && after.divider.margin <= 6);
      const nav = dialog.locator('.hpf-settings-nav');
      await nav.evaluate(element => { element.scrollTop = element.scrollHeight; });
      check(`${label}-last-navigation-item-reachable`, await nav.evaluate(element => {
        const bounds = element.getBoundingClientRect(), last = element.querySelector('button:last-child').getBoundingClientRect();
        return last.y >= bounds.y - 1 && last.bottom <= bounds.bottom + 1;
      }));
      await dialog.locator('[data-section-target="alarms"]').click();
    }
    await section('basics');
    check(`${label}-draft-controls-stay-mounted`, await dialog.evaluate(element => element.querySelector('#marker-name') === window.__scroll1354.name));
    console.log(JSON.stringify({ deviceSettingsScroll: { authentic, viewport, before, after } }));
  }
  check(`${authentic ? 'ha' : 'fallback'}-scroll-and-navigation-do-not-write`, await page.evaluate(() => JSON.stringify(window.__card._serverCfg) === window.__scroll1354.config));
  await dialog.locator('.hpf-footer [data-hp="dialog-cancel"]').click();
  await dialog.waitFor({ state: 'detached' });
  if (authentic) await fixture.assertClean();
} finally {
  await finish(browser);
  if (authentic) await fixture.close();
}
}
