// #1170: native settings/Apply/Close/Help, held public transport, persisted
// synthetic pair. This is not a claim about real HA ACL or disk failures.
import { mkdirSync } from 'node:fs';
import { launch, check, finish } from './serve.mjs';

const output = 'artifacts/1170-native'; mkdirSync(output, { recursive: true });
const { page, browser } = await launch({ width: 1100, height: 900 });
const optimize = () => page.locator('hp-dialog[icon="mdi:broom"]');
const settings = () => page.locator('hp-dialog[data-kind="settings"][icon="mdi:cog-outline"]');
const cfg = { spaces: [{ id: 'lab', title: 'Optimize lab', cell_cm: 5, view_box: [0,0,1,1],
  rooms: [{ id: 'room', name: 'Kitchen', area: null, poly: [[.125,.125],[.625,.125],[.625,.625],[.125,.625]] }] }],
  markers: [], settings: {} };
const open = async () => {
  if (!await settings().count()) await page.locator('[data-hp="settings"]').click();
  await settings().locator('[data-section-target="data"]').click();
  await settings().getByRole('button', { name: await page.evaluate(() => window.__card._t('gs.align_all')), exact: true }).click();
  await optimize().waitFor();
};
const ready = () => page.waitForFunction(() => !!window.__card._alignDialog?.report && !window.__card._alignDialog.busy);
const close = () => optimize().locator('.btn[data-hp="dialog-cancel"]').click();
const seed = async () => page.evaluate(async config => {
  await window.__hpTest.waitForWrites(); await window.__hpTest.setServerConfig(config);
  await window.__hpTest.setLayout({}); await window.__hpTest.settled();
  await window.__hpTest.waitForWrites(); await window.__hpTest.settled();
}, cfg);
try {
  await seed();
  let releaseModule; const heldModule = new Promise(resolve => { releaseModule = resolve; });
  let moduleRequests = 0;
  await page.route('**/optimize-plans-dialog-*.js', async route => { moduleRequests++; await heldModule; await route.fallback(); });
  await open();
  await page.waitForFunction(() => window.__card._alignDialog?.phase === 'loading');
  check('busy shell is painted before lazy optimizer arrival', /Checking plans/.test(await optimize().innerText()));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  check('reduced motion retains text without spinner animation', await optimize().locator('.hpf-spinner').evaluate(el => getComputedStyle(el).animationName === 'none'));
  await page.screenshot({ path: `${output}/loading-reduced-motion.png` });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  releaseModule(); await ready();
  check('optimizer really crossed the held module request', moduleRequests === 1);
  await page.evaluate(() => {
    const card = window.__card, base = card.hass;
    window.__1170 = { mode: 'hold', writes: 0, helpRequests: 0, blockReads: false, postFrame: false };
    new MutationObserver(() => {
      const body = card.renderRoot.querySelector('hp-dialog[icon="mdi:broom"] .body');
      if (body?.textContent.includes('Checking the result')) requestAnimationFrame(() => {
        if (body.isConnected && body.getBoundingClientRect().height > 0 && body.textContent.includes('Checking the result')) window.__1170.postFrame = true;
      });
    }).observe(card.renderRoot, { subtree: true, childList: true, characterData: true });
    card.hass = { ...base, callWS: async message => {
      const state = window.__1170;
      if (message.type.startsWith('houseplan/support')) state.helpRequests++;
      if (state.blockReads && ['houseplan/config/get','houseplan/layout/get'].includes(message.type)) throw Error('synthetic offline');
      if (message.type === 'houseplan/config/get') return { ...await base.callWS(message), support_api: 1, support_package_versions: [1,2] };
      if (message.type !== 'houseplan/plan/optimize') return base.callWS(message);
      state.writes++;
      if (state.mode === 'hold') await new Promise(resolve => { state.release = resolve; });
      if (state.mode === 'reject') throw { code: 'invalid_format', message: 'PRIVATE technical error' };
      if (state.mode === 'incomplete') state.blockReads = true;
      const reply = await base.callWS(message);
      if (state.mode === 'incomplete') { const partial = { ...reply }; delete partial.layout; return partial; }
      return reply;
    } };
  });
  // Deliver the Help capability through the same public config response used
  // in production; do not force the card's private capability flag.
  await close();
  await page.evaluate(async () => { await window.__hpTest.setServerConfig(config => config); await window.__hpTest.waitForWrites(); await window.__hpTest.settled(); });
  await open(); await ready();
  await optimize().locator('[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(() => typeof window.__1170.release === 'function');
  check('Apply shows saving and is disabled until the pair ACK', await optimize().locator('[data-hp="dialog-confirm"]').isDisabled()
    && /Saving changes|Closing this window/.test(await optimize().innerText()));
  await close(); await open();
  check('reopening restores one sent operation', await page.evaluate(() => window.__1170.writes === 1 && window.__card._alignDialog.phase === 'saving'));
  await page.evaluate(() => { window.__1170.mode = 'normal'; window.__1170.release(); });
  await page.waitForFunction(() => !!window.__card._alignDialog?.outcome);
  check('confirmed save retains a clean result', await page.evaluate(() => window.__card._alignDialog.outcome === 'clean'));
  check('postcheck had a presented status frame', await page.evaluate(() => window.__1170.postFrame));
  check('postcheck made no extra write', await page.evaluate(() => window.__1170.writes === 1));
  check('result is not another Apply target', await optimize().locator('[data-hp="dialog-confirm"]').count() === 0);
  for (const theme of ['light','dark']) {
    await page.emulateMedia({ colorScheme: theme });
    // The demo's root variables are dark by default; colorScheme alone does
    // not turn an HA theme light. Supply real theme inputs as well.
    await page.evaluate(theme => {
      const values = theme === 'light' ? ['#0b73b8','#202124','#5f6368','#ffffff','#d7d9de']
        : ['#3ea6ff','#e1e1e1','#9aa4ad','#1c2530','#33404d'];
      for (const [index,key] of ['--primary-color','--primary-text-color','--secondary-text-color','--card-background-color','--divider-color'].entries())
        document.documentElement.style.setProperty(key, values[index]);
      document.documentElement.style.setProperty('--ha-card-background', values[3]);
    }, theme);
    for (const lang of ['ru','en','de','fr']) {
      await page.setViewportSize({ width: lang === 'de' ? 360 : 1100, height: 900 });
      await page.evaluate(async lang => {
        const c = window.__card; c.hass = { ...c.hass, language: lang, locale: { language: lang } };
        await window.__hpTest.settled(); await document.fonts.ready;
      }, lang);
      check(`result remains readable ${theme}/${lang}`, await optimize().evaluate(dialog => {
        const body = dialog.querySelector('.body'), button = dialog.querySelector('.btn[data-hp="dialog-cancel"]');
        const box = button.getBoundingClientRect();
        return body.scrollWidth <= body.clientWidth + 1 && box.width >= 44 && box.height >= 44
          && box.left >= -1 && box.right <= innerWidth + 1 && !body.textContent.includes('gs.optimize_');
      }));
      if (lang === 'ru') {
        await optimize().evaluate(async dialog => {
          const surface = dialog.shadowRoot?.querySelector('.surface');
          const animations = [...dialog.getAnimations({subtree:true}), ...(surface?.getAnimations({subtree:true}) || [])]
            .filter(animation => animation.effect?.getTiming().iterations !== Infinity);
          await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        await page.screenshot({ path: `${output}/success-${theme}-ru.png` });
      }
    }
  }
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.evaluate(async () => { const c=window.__card; c.hass={...c.hass,language:'en',locale:{language:'en'}}; await window.__hpTest.settled(); });
  await close(); await open(); await ready();
  check('reopening the saved pair is a no-op', await optimize().locator('[data-hp="dialog-confirm"]').count() === 0
    && /No optimization needed/.test(await optimize().innerText()));
  await close(); await seed(); await open(); await ready();
  await page.evaluate(() => { window.__1170.mode = 'reject'; });
  await optimize().locator('[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(() => !!window.__card._alignDialog && !window.__card._alignDialog.busy);
  const rejection = await page.evaluate(() => ({ phase: window.__card._alignDialog.phase, failure: window.__card._alignDialog.failure, outcome: window.__card._alignDialog.outcome }));
  if (rejection.phase !== 'failure') throw Error(`Unexpected rejection outcome: ${JSON.stringify(rejection)}`);
  check('a confirmed rejection explains non-application without raw backend text',
    /This optimization was not applied/.test(await optimize().innerText()) && !/PRIVATE/.test(await optimize().innerText()));
  await close(); await open(); await ready();
  await page.evaluate(() => { window.__1170.mode = 'incomplete'; });
  await optimize().locator('[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(() => window.__card._alignDialog?.phase === 'unknown');
  check('incomplete ACK cannot claim success or non-application', /Changes may have been saved/.test(await optimize().innerText())
    && !/This optimization was not applied/.test(await optimize().innerText()));
  await close(); await open();
  check('unknown outcome survives dialog closure', await page.evaluate(() => window.__card._alignDialog.phase === 'unknown'));
  await optimize().locator('.optimize-refresh').click();
  await page.waitForFunction(() => window.__card._alignDialog?.refreshFailed === true);
  check('failed pair refresh keeps the unknown barrier', await optimize().locator('[data-hp="dialog-confirm"]').count() === 0);
  await optimize().locator('.optimize-support').click();
  const support = page.locator('#support-dialog'); await support.waitFor();
  check('Help receives context without submitting or attaching the plan',
    /houseplan-optimize/.test(await support.locator('#support-message').inputValue())
      && !await support.locator('[data-field="support-attach"]').isChecked()
      && await page.evaluate(() => window.__1170.helpRequests === 0));
  await page.screenshot({ path: `${output}/support-prefill.png` });
} finally { await finish(browser, { issue: 1170 }); }
