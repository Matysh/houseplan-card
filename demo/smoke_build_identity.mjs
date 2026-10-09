// #836 AC6: the running build names itself on the production bundle. Both entry
// wrappers record their own URL before any chunk loads (the first one loaded in
// a document wins); the console banner and «About» read `dev=<40 hex>` there and
// show `v<version> · dev <sha8>`, the SHA a link to its commit. Without the
// parameter — the harness, a release, a beta — both texts are exactly as before.
import { readFileSync } from 'node:fs';
import { launchPanelCold, checkAll, finish } from './serve.mjs';
import { assertFreshDemoBundleUnlessAllowed } from './bundle-freshness.mjs';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const SHA = `024b6595${'1'.repeat(32)}`;
const PANEL_SHA = `5555bbbb${'2'.repeat(32)}`;
const COMMIT = `https://github.com/Matysh/houseplan-card/commit/${SHA}`;

const { page, browser } = await launchPanelCold({ width: 1000, height: 900 });
const banners = [];
page.on('console', (message) => {
  if (message.text().includes('HOUSEPLAN-CARD')) banners.push(message.text());
});

/** A fresh document with neither entry loaded: module state starts clean. */
async function coldDocument() {
  banners.length = 0;
  await page.goto('http://demo.local/demo.html?panel-cold=1', { waitUntil: 'domcontentloaded' });
}

/** Import entries in order; report the seam after each, before any card exists. */
const importEntries = (urls) => page.evaluate(async (list) => {
  const seen = [];
  for (const url of list) {
    await import(url);
    seen.push(globalThis.__HOUSEPLAN_ENTRY_URL__);
  }
  return seen;
}, urls);

/** Mount a full card, open «Help & feedback» and read the About section. */
const about = () => page.evaluate(async () => {
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const until = async (probe, label) => {
    for (let index = 0; index < 400; index++) {
      if (probe()) return;
      await wait(25);
    }
    throw new Error(`build identity smoke timed out: ${label}`);
  };
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan', icon_size: 3.4 });
  document.getElementById('host').appendChild(card);
  card.hass = window.__mkHass();
  window.__card = card;
  await until(() => card._loadOk && card._booting === false, 'card view');
  if (!(await card._ensureEditorRuntime())) throw new Error('editor runtime did not load');
  const root = card.renderRoot || card.shadowRoot;
  await card.updateComplete;
  root.querySelector('.support-button').click();
  await until(() => !!root.querySelector('#support-dialog .aboutver'), 'support dialog');
  await card.updateComplete;
  const line = root.querySelector('#support-dialog .aboutver');
  const link = line.querySelector('a');
  link?.focus();
  return {
    text: line.textContent.replace(/\s+/g, ' ').trim(),
    links: line.querySelectorAll('a').length,
    href: link?.getAttribute('href') ?? null,
    target: link?.getAttribute('target') ?? null,
    rel: link?.getAttribute('rel') ?? null,
    linkText: link?.textContent ?? null,
    sameClassAsSectionLinks: !!link && link.classList.contains('aboutlink'),
    inline: !!link && getComputedStyle(link).display === 'inline',
    focusable: !!link && link.tabIndex >= 0 && link.matches(':focus'),
    sectionLinks: root.querySelectorAll('#support-dialog .supportlinks a.aboutlink').length,
  };
});

// 1. Dev build, card entry first: the seam is the card URL even after the panel loads.
await coldDocument();
const cardUrl = `/assets/houseplan-card.js?v=${VERSION}&b=c0ffee00&dev=${SHA}`;
const devSeam = await importEntries([cardUrl, `/assets/houseplan-panel.js?v=${VERSION}&dev=${PANEL_SHA}`]);
await assertFreshDemoBundleUnlessAllowed(page);
const devBanners = banners.slice();
const devAbout = await about();

// 2. Panel entry first: its URL is recorded before the card chunk evaluates —
//    the banner printed by that chunk already names the panel's SHA.
await coldDocument();
const panelSeam = await importEntries([`/assets/houseplan-panel.js?v=${VERSION}&dev=${PANEL_SHA}`, cardUrl]);
const panelBanners = banners.slice();

// 3. No `dev=`: a release/beta registration or the harness itself.
await coldDocument();
const releaseSeam = await importEntries([`/assets/houseplan-card.js?v=${VERSION}&b=c0ffee00`]);
const releaseBanners = banners.slice();
const releaseAbout = await about();

const origin = 'http://demo.local';
// A bundle without the seam leaves `undefined` here: report it, do not crash.
const seamText = (seam, index) => String(seam[index] ?? '');
const out = {
  cardEntryRecordsItsUrlFirstWins: devSeam[0] === `${origin}${cardUrl}` && devSeam[1] === devSeam[0],
  panelEntryRecordsItsUrlBeforeChunks: seamText(panelSeam, 0).startsWith(`${origin}/assets/houseplan-panel.js?`)
    && panelSeam[1] === panelSeam[0]
    && panelBanners.length === 1 && panelBanners[0].includes(`v${VERSION} · dev 5555bbbb `),
  consoleNamesDevBuild: devBanners.length === 1
    && devBanners[0].includes(`HOUSEPLAN-CARD %c v${VERSION} · dev 024b6595 `),
  aboutNamesDevBuildWithCommitLink: devAbout.text === `Houseplan Card v${VERSION} · dev 024b6595`
    && devAbout.links === 1 && devAbout.href === COMMIT && devAbout.linkText === '024b6595'
    && devAbout.target === '_blank' && devAbout.rel === 'noopener noreferrer'
    && devAbout.sameClassAsSectionLinks && devAbout.inline && devAbout.focusable,
  aboutSectionLinksUnchanged: devAbout.sectionLinks === 2 && releaseAbout.sectionLinks === 2,
  releaseSeamRecorded: releaseSeam[0] === `${origin}/assets/houseplan-card.js?v=${VERSION}&b=c0ffee00`,
  releaseConsoleAsBefore: releaseBanners.length === 1
    && releaseBanners[0].includes(`HOUSEPLAN-CARD %c v${VERSION} `)
    && !releaseBanners[0].includes('·'),
  releaseAboutAsBefore: releaseAbout.text === `Houseplan Card v${VERSION}` && releaseAbout.links === 0,
};
checkAll(out);
await finish(browser, {
  ...out, devSeam, panelSeam, releaseSeam, devBanners, panelBanners, releaseBanners, devAbout, releaseAbout,
});
