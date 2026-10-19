// Genuine pinned HA custom elements, offline. Never start HA auth or core.
const runtime = await (await fetch('/ha-runtime.json')).json();
window.hassConnection = new Promise(() => {});
window.frontendVersion = runtime.version;
await import(`/frontend_latest/${runtime.app}`);
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
await prepare(runtime.modules.theme);
const themeDefaults = require(runtime.modules.theme).I;
const baseStyle = document.createElement('style');
baseStyle.id = 'lab-official-ha-tokens';
baseStyle.textContent = ':root{' + Object.entries(themeDefaults).map(([key, value]) => `${key.startsWith('--') ? key : '--' + key}:${value}`).join(';') + '}';
document.head.prepend(baseStyle);
for (const id of [runtime.modules.dialog, runtime.modules.icon, runtime.modules.card, runtime.modules.contexts]) {
  await prepare(id); await require(id);
}
await Promise.all(['ha-dialog', 'ha-icon', 'ha-card'].map(name => customElements.whenDefined(name)));
// Public Lit contexts normally supplied by hass-app, without an auth object.
const contexts = require(runtime.modules.contexts);
const lang = window.__labLanguage;
const translations = await (await fetch(`/static/translations/${runtime.translations[lang]}`)).json();
const localize = key => translations[key] || key.split('.').reduce((value, part) => value?.[part], translations) || null;
window.__labLocalize = localize;
document.addEventListener('context-request', event => {
  if (event.context === contexts.D5) { event.stopPropagation(); event.callback({ language: lang, locale: { language: lang }, localize }, () => {}); }
  if (event.context === contexts.WF) { event.stopPropagation(); event.callback({ auth: { external: null }, config: { time_zone: 'UTC', version: '2026.10.2' } }, () => {}); }
});
window.__labHa = { version: runtime.version, authenticDialog: true, authenticIcon: true, authenticCard: true, chunks: [...loaded] };
