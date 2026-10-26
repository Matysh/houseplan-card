// #1070: real cold module requests and real Lovelace editor hosts. ha-form is
// observed through its public schema/computeLabel/value-changed wire contract;
// this fixture does not claim to paint Home Assistant's own form widgets.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { launchPanelCold, check, finish, requirePinnedBrowser } from './serve.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
requirePinnedBrowser();
const proof = 'artifacts/plan-rotation-1070';
mkdirSync(proof, { recursive: true });
const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const settingsLocales = manifest.lazyNamespaceLocaleFiles.filter(file => /\/settings-(ru|de|fr)-/.test(file));
const dictionaryFiles = manifest.files.map(file => file.path).filter(file =>
  readFileSync(`dist/${file}`, 'utf8').includes('Plan rotation must be'));
if (!dictionaryFiles.length || settingsLocales.length !== 3) throw Error('Cannot identify the settings dictionary graph');
const settingsFiles = new Set([...settingsLocales, ...dictionaryFiles].map(file => `/assets/${file}`));
const catalog = Object.fromEntries(['en','ru','de','fr'].map(lang =>
  [lang, JSON.parse(readFileSync(`src/i18n/settings/${lang}.json`, 'utf8'))]));
const records = [];
const requestsOf = page => {
  const list = []; page.on('request', request => list.push(new URL(request.url()).pathname)); return list;
};
const snapshot = page => page.evaluate(() => {
  const editor = window.__localeEditor, forms = [...editor.renderRoot.querySelectorAll('ha-form')];
  const fields = rows => rows.flatMap(row => [...(row.name ? [row] : []), ...fields(row.schema || [])]);
  const rows = forms.flatMap(form => fields(form.schema || []).map(row => ({ row, form })));
  const label = name => rows.find(item => item.row.name === name);
  return { inert: editor.inert, busy: editor.getAttribute('aria-busy'),
    names: rows.map(({row}) => row.name), labels: forms.length ? rows.map(({row, form}) => form.computeLabel(row)) : null,
    rotation: label('rotation')?.form.computeLabel({ name: 'rotation' }), title: label('title')?.form.computeLabel({ name: 'title' }),
    error: editor.renderRoot.querySelector('.card-config-error')?.textContent.trim(),
    saves: window.__localeSaves.length, value: window.__localeSaves.at(-1)?.rotation };
});
const settled = page => page.waitForFunction(() => {
  const editor = window.__localeEditor;
  return editor && !editor.inert && editor.renderRoot.querySelector('ha-form')?.schema?.length > 0;
});
const createEditor = async (page, tag, lang) => {
  await page.evaluate(() => import('/assets/houseplan-card.js'));
  await assertFreshDemoBundle(page);
  return page.evaluate(async ({ tag, lang }) => {
  const editor = await customElements.get(tag).getConfigElement();
  editor.id = 'locale-editor';
  editor.hass = { ...window.__mkHass(), language: lang, locale: { language: lang } };
  editor.setConfig({ type: `custom:${tag}`, space: 'home', rotation: 45 });
  window.__localeSaves = []; window.__localeFrames = [];
  editor.addEventListener('config-changed', event => window.__localeSaves.push(event.detail.config));
  window.__localeEditor = editor;
  document.getElementById('host').replaceChildren(editor);
  const record = () => {
    const forms = [...editor.renderRoot.querySelectorAll('ha-form')];
    const fields = rows => rows.flatMap(row => [...(row.name ? [row] : []), ...fields(row.schema || [])]);
    const rows = forms.flatMap(form => fields(form.schema || []).map(row => ({row, form})));
    if (rows.length) window.__localeFrames.push({ inert: editor.inert,
      names: rows.map(({row}) => row.name), labels: rows.map(({row, form}) => form.computeLabel(row)) });
  };
  new MutationObserver(record).observe(editor.renderRoot, { childList: true, subtree: true, characterData: true });
  await editor.updateComplete; record();
  }, { tag, lang });
};
const validLabels = state => state.labels?.length > 0 && state.labels.every((label, index) =>
  typeof label === 'string' && label.trim() && !label.startsWith('editor.') && label !== state.names[index]);

for (const mode of ['view','readonly','kiosk']) {
  const { page, browser } = await launchPanelCold();
  const requests = requestsOf(page);
  try {
    await page.evaluate(async mode => {
      await import('/assets/houseplan-card.js');
      const card = document.createElement('houseplan-card');
      card.setConfig({ type: 'custom:houseplan-card', ...(mode === 'kiosk' ? { kiosk: true } : {}) });
      const base = window.__mkHass();
      const hass = mode !== 'readonly' ? base : { ...base, user: { id: 'reader', name: 'Reader', is_admin: false },
        callWS: async message => {
          const reply = await base.callWS(message);
          return message.type === 'houseplan/config/get' ? { ...reply, can_write: false } : reply;
        } };
      window.__card = card; document.getElementById('host').append(card); card.hass = hass;
    }, mode);
    await assertFreshDemoBundle(page);
    await page.waitForFunction(() => window.__card?._booting === false
      && window.__card.renderRoot.querySelector('[data-hp="room"]'));
    await page.waitForTimeout(800);
    const settings = requests.filter(path => settingsFiles.has(path));
    check(`cold ${mode} paints its plan without a settings dictionary request`, settings.length === 0);
    if (mode === 'readonly') check('cold readonly has no editor navigation', await page.locator('[data-editor-navigation]').count() === 0);
    records.push({ mode, requests, settings });
  } finally { await browser.close(); }
}

for (const tag of ['houseplan-card','houseplan-space-card']) {
  for (const lang of ['en','ru','de','fr']) {
    const { page, browser } = await launchPanelCold(); const requests = requestsOf(page);
    let release; const gate = new Promise(resolve => { release = resolve; });
    const locale = settingsLocales.find(file => file.includes(`settings-${lang}-`));
    try {
      if (locale) await page.route(`**/${locale.split('/').at(-1)}*`, async route => { await gate; await route.fallback(); });
      await createEditor(page, tag, lang);
      if (locale) {
        const pending = await snapshot(page);
        check(`${tag} ${lang} cold readiness hides the incomplete form`, pending.inert && pending.busy === 'true' && !pending.labels);
        release();
      }
      await settled(page);
      const state = await snapshot(page), frames = await page.evaluate(() => window.__localeFrames);
      check(`${tag} ${lang} cold labels are complete and localized`, validLabels(state)
        && state.rotation === catalog[lang]['editor.rotation'] && state.title === catalog[lang]['editor.title']
        && state.error === catalog[lang]['editor.rotation_invalid'] && frames.every(frame =>
          frame.labels[frame.names.indexOf('rotation')] === catalog[lang]['editor.rotation']
          && frame.labels[frame.names.indexOf('title')] === catalog[lang]['editor.title']));
      check(`${tag} ${lang} never commits a raw or empty label`, frames.length > 0 && frames.every(validLabels));
      records.push({ tag, lang, mode: 'cold-gui', requests, state, frames });
    } finally { release(); await browser.close(); }
  }
  for (const lang of ['ru','de','fr']) {
    const { page, browser } = await launchPanelCold(); const requests = requestsOf(page);
    let release; const gate = new Promise(resolve => { release = resolve; }); let attempts = 0;
    const locale = settingsLocales.find(file => file.includes(`settings-${lang}-`));
    try {
      await page.route(`**/${locale.split('/').at(-1)}*`, async route => { attempts++; await gate; await route.abort('failed'); });
      await createEditor(page, tag, 'en'); await settled(page);
      await page.evaluate(lang => {
        const editor = window.__localeEditor;
        editor.hass = { ...editor.hass, language: lang, locale: { language: lang } };
      }, lang);
      await page.waitForFunction(() => window.__localeEditor.inert);
      await page.evaluate(() => window.__localeEditor.renderRoot.querySelector('ha-form')
        .dispatchEvent(new CustomEvent('value-changed', { detail: { value: { rotation: '90' } } })));
      check(`${tag} ${lang} pending locale blocks a queued ha-form save`, (await snapshot(page)).saves === 0);
      release(); await settled(page);
      const state = await snapshot(page), frames = await page.evaluate(() => window.__localeFrames);
      check(`${tag} ${lang} two failed requests settle to complete English`, attempts === 2 && validLabels(state)
        && state.rotation === catalog.en['editor.rotation'] && state.error === catalog.en['editor.rotation_invalid']
        && frames.every(validLabels));
      await page.evaluate(() => window.__localeEditor.renderRoot.querySelector('ha-form')
        .dispatchEvent(new CustomEvent('value-changed', { detail: { value: { rotation: '90' } } })));
      const saved = await snapshot(page);
      check(`${tag} ${lang} settled fallback permits one numeric save`, saved.saves === 1 && saved.value === 90);
      records.push({ tag, lang, mode: 'warm-fallback', requests, attempts, state, saved, frames });
    } finally { release(); await browser.close(); }
  }
}
writeFileSync(`${proof}/gui-cold-network.json`, JSON.stringify({ fingerprint: manifest.fingerprint, dictionaryFiles, settingsLocales, records }, null, 2));
await finish();
