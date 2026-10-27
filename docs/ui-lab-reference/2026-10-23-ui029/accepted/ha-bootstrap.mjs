// Genuine HA custom elements, offline. Never import core.* or start HA auth.
window.hassConnection = new Promise(() => {});
window.frontendVersion = '20260930.4';
await import('/frontend_latest/app.c430fdd756496c9c.js');
const require = window.__hpHaRequire;
if (!require?.m) throw Error('Official HA component loader unavailable');
const modules = await (await fetch('/ha-modules.json')).json();
const visited = new Set(), loaded = new Set();
async function prepare(id) {
  if (visited.has(id)) return;
  visited.add(id);
  const item = modules[id];
  if (!item) { if (!require.m[id]) throw Error(`Missing HA module ${id}`); return; }
  if (!require.m[id] && !loaded.has(item.file)) {
    const chunk = await import(`/frontend_latest/${item.file}`);
    Object.assign(require.m, chunk.__webpack_modules__);
    chunk.__rspack_esm_runtime?.(require);
    loaded.add(item.file);
  }
  for (const dependency of item.dependencies) await prepare(dependency);
}
// Global HA design tokens are not part of ha-dialog's own shadow CSS.
// Reuse their genuine upstream export rather than approximate spacing/radii.
await prepare('3184');
const themeDefaults = require('3184').I;
const baseStyle = document.createElement('style');
baseStyle.id = 'lab-official-ha-tokens';
baseStyle.textContent = ':root{' + Object.entries(themeDefaults).map(([key, value]) => `${key.startsWith('--') ? key : '--' + key}:${value}`).join(';') + '}';
document.head.prepend(baseStyle);
await prepare('37334');
await require('37334');
await customElements.whenDefined('ha-dialog');
for (const id of ['33396', '95788', '53214']) { await prepare(id); await require(id); }
await Promise.all(['ha-icon', 'ha-card'].map(name => customElements.whenDefined(name)));
// Supply the same public Lit contexts HA normally provides above its panels.
// There is no hass-app or auth/bootstrap on this page.
const contexts = require('66572');
const lang = localStorage.getItem('houseplan-ui-lab:language') || 'ru';
const translations = await (await fetch(`/static/translations/${lang}-b27f4a665b84ba27560f1d90c56bfd6a.json`)).json();
const localize = key => translations[key] || key.split('.').reduce((v, k) => v?.[k], translations) || null;
window.__labLocalize = localize;
document.addEventListener('context-request', e => {
  if (e.context === contexts.D5) { e.stopPropagation(); e.callback({ language: lang, locale: { language: lang }, localize }, () => {}); }
  if (e.context === contexts.WF) { e.stopPropagation(); e.callback({ auth: { external: null }, config: { time_zone: 'Europe/Moscow', version: '2026.10.2' } }, () => {}); }
});
window.__labHa = { version: '20260930.4', authenticDialog: true, authenticIcon: true, authenticCard: true, chunks: [...loaded] };
