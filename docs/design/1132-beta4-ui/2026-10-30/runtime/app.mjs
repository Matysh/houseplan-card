import { installNetworkGuard, MAX_SESSION_BYTES, parseSession, saveSession, serializeSession } from './session.mjs';

installNetworkGuard(window);
const notice = document.querySelector('#lab-notice');
let noticeTimer;
function notify(text) {
  notice.textContent = text; notice.hidden = false; clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 6000);
}
const preferencesKey = 'houseplan-ui-lab:preferences:v2';
let preferences = {};
try { preferences = JSON.parse(localStorage.getItem(preferencesKey)) || {}; } catch { /* Keep malformed storage intact until an explicit preference change. */ }
window.__labLanguage = ['ru', 'en', 'de', 'fr'].includes(preferences.language) ? preferences.language : 'ru';
document.documentElement.lang = window.__labLanguage;
document.documentElement.dataset.theme = preferences.theme === 'light' ? 'light' : 'dark';
const savePreferences = () => {
  try { localStorage.setItem(preferencesKey, JSON.stringify(preferences)); }
  catch (error) { notify(`Настройки стенда не сохранены: ${error.message}`); }
};

try {
  await import('/assets/icons.js');
  await import('/ha-bootstrap.mjs');
  const { createMockHa } = await import('/mock-ha.mjs');
  const mock = await createMockHa(notify);
  mock.setDarkMode(document.documentElement.dataset.theme !== 'light');
  await import('/assets/houseplan-panel.js');
  const panel = document.createElement('houseplan-panel');
  panel.hass = mock.hass; panel.narrow = matchMedia('(max-width: 870px)').matches;
  document.querySelector('#product').replaceChildren(panel); mock.attach(panel);
  await panel.updateComplete;
  const card = panel.shadowRoot.querySelector('houseplan-card');
  window.__lab = { panel, card, mock, notify, safety: window.__labSafety };
  const provenance = await (await fetch('/provenance.json')).json();
  document.querySelector('#lab-provenance').textContent = `House Plan ${provenance.productVersion}\nCommit ${provenance.productCommit}\nFingerprint ${provenance.productFingerprint}\nHA Frontend ${provenance.frontendVersion}\nDataset ${provenance.datasetId}\n${provenance.privateDataset ? 'Частный локальный снимок' : 'Синтетический демонстрационный план'}\nПодключение к HA отсутствует`;
  const tools = document.querySelector('#lab-tools');
  document.querySelector('#lab-launcher').onclick = () => { tools.hidden = !tools.hidden; };
  document.querySelector('#lab-close').onclick = () => { tools.hidden = true; };
  document.addEventListener('keydown', event => {
    if (event.ctrlKey && event.shiftKey && event.code === 'KeyL') { event.preventDefault(); tools.hidden = !tools.hidden; }
  });
  const theme = document.querySelector('#lab-theme');
  theme.value = document.documentElement.dataset.theme;
  theme.onchange = () => {
    document.documentElement.dataset.theme = theme.value; preferences.theme = theme.value;
    mock.setDarkMode(theme.value === 'dark'); savePreferences();
  };
  const language = document.querySelector('#lab-language'); language.value = mock.hass.language;
  language.onchange = () => {
    mock.persist(); preferences.language = language.value; savePreferences(); location.reload();
  };

  const confirmDialog = document.querySelector('#lab-confirm');
  let pendingConfirmation;
  const confirm = (title, message, action) => {
    if (confirmDialog.open) return;
    pendingConfirmation = action;
    document.querySelector('#lab-confirm-title').textContent = title;
    document.querySelector('#lab-confirm-message').textContent = message;
    confirmDialog.showModal();
  };
  document.querySelector('#lab-confirm-cancel').onclick = () => confirmDialog.close();
  confirmDialog.addEventListener('close', () => { pendingConfirmation = undefined; });
  document.querySelector('#lab-confirm-accept').onclick = () => {
    const action = pendingConfirmation; pendingConfirmation = undefined; confirmDialog.close();
    try { action?.(); } catch (error) { notify(error.message); }
  };
  document.querySelector('#lab-reset').onclick = () => confirm('Вернуть исходный снимок?',
    'Текущие локальные правки этого набора данных будут заменены исходными. Другие сессии и настоящий HA не изменятся. При необходимости сначала экспортируйте сессию.',
    () => { localStorage.removeItem(mock.sessionKey); location.reload(); });
  document.querySelector('#lab-export').onclick = () => {
    try {
      const url = URL.createObjectURL(new Blob([serializeSession(mock.identity, mock.snapshot())], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'houseplan-ui-lab-session.json'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { notify(error.message); }
  };
  const importInput = document.querySelector('#lab-import-file');
  document.querySelector('#lab-import').onclick = () => { importInput.value = ''; importInput.click(); };
  importInput.onchange = async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_SESSION_BYTES) throw Error('Файл сессии превышает 8 MiB');
      const snapshot = parseSession(await file.text(), mock.identity);
      confirm('Заменить текущую локальную сессию?',
        'Правки и состояния этого стенда будут заменены импортированной сессией. Набор данных и сборка проверены. Это не импорт в настоящий House Plan.',
        () => { saveSession(localStorage, mock.identity, snapshot); location.reload(); });
    } catch (error) { notify(`Импорт отклонён: ${error.message}`); }
  };

  const deep = (selector, root = card.shadowRoot) => {
    const direct = root?.querySelector(selector); if (direct) return direct;
    for (const element of root?.querySelectorAll('*') || []) if (element.shadowRoot) {
      const found = deep(selector, element.shadowRoot); if (found) return found;
    }
    return null;
  };
  async function click(selector) {
    const element = deep(selector);
    if (!element) { notify('Закройте текущий диалог или выберите подходящее пространство'); return false; }
    element.click(); await card.updateComplete; return true;
  }
  async function shortcut(kind) {
    tools.hidden = true;
    const simple = { settings: '[data-hp="settings"]', space: '[data-hp="space-settings"]', summary: '.summary-control button:first-child', pdf: '[data-hp="pdf"]' };
    if (simple[kind]) return click(simple[kind]);
    if (kind === 'device') {
      if (!await click('[data-hp="mode-tab"][data-mode="devices"]')) return;
      await new Promise(resolve => setTimeout(resolve, 450));
      const marker = deep('[data-hp="device"][data-id="lab_ceiling"]') || deep('[data-hp="device"][data-id]');
      if (marker) marker.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 2 }));
      else notify('В этом пространстве нет устройства для предпросмотра');
    } else if (kind === 'room') {
      if (!await click('[data-hp="mode-tab"][data-mode="plan"]')) return;
      await new Promise(resolve => setTimeout(resolve, 450));
      await click('[data-hp="room-settings"]');
    }
  }
  for (const button of document.querySelectorAll('[data-open]')) button.onclick = () => shortcut(button.dataset.open).catch(error => notify(error.message));

  // Only explicit, opt-in CSS experiments. No prototype DOM surgery or private
  // product method replacement; the real bundle remains the sole renderer.
  const tags = ['houseplan-card', 'houseplan-panel', 'hp-dialog', 'ha-dialog'];
  // UI-010: shared device faces also live in isolated preview/space roots.
  const markerRoots = ['hp-device-preview', 'houseplan-space-card'];
  const overrides = new Map(), roots = new Map();
  const enabled = document.querySelector('#lab-styles');
  const apply = () => {
    // UI-011: use the constructor's own change handler to save controls=false.
    // Keep the Lit-owned field mounted; the local stylesheet removes its UI.
    for (const root of roots.keys()) {
      const controls = root.querySelector('hp-dialog[data-kind="external-screen-constructor"] #screen-controls');
      if (controls && controls.value !== 'false') {
        controls.value = 'false';
        controls.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    for (const [root, entry] of roots) {
      if (!tags.includes(entry.name) && !markerRoots.includes(entry.name)) continue;
      if (!entry.style || !root.contains(entry.style)) {
        entry.style = document.createElement('style'); entry.style.dataset.labOverride = entry.name; root.append(entry.style);
      }
      const text = enabled.checked ? overrides.get(markerRoots.includes(entry.name) ? 'houseplan-card' : entry.name) || '' : '';
      if (entry.style.textContent !== text) entry.style.textContent = text;
    }
  };
  const scan = root => {
    if (!roots.has(root)) {
      const observer = new MutationObserver(() => { scan(root); apply(); });
      roots.set(root, { name: root.host?.localName || '', style: null, observer });
      observer.observe(root, { childList: true, subtree: true });
    }
    for (const element of root.querySelectorAll('*')) if (element.shadowRoot) scan(element.shadowRoot);
  };
  enabled.onchange = apply;
  async function refreshStyles() {
    await Promise.all(tags.map(async name => {
      const response = await fetch(`/overrides/${name}.css`, { cache: 'no-store' });
      if (response.ok) overrides.set(name, await response.text());
    }));
    scan(document);
    for (const [root, entry] of roots) if (root.host && !root.host.isConnected) { entry.observer.disconnect(); roots.delete(root); }
    apply();
    document.querySelector('#lab-status').textContent = `Локально · ${mock.snapshot().config.spaces.length} пространства · CSS ${new Date().toLocaleTimeString()}`;
  }
  await refreshStyles();
  const poll = async () => { try { await refreshStyles(); } catch (error) { notify(`CSS не обновлён: ${error.message}`); } finally { setTimeout(poll, 1200); } };
  setTimeout(poll, 1200);
  document.addEventListener('hass-more-info', event => {
    event.stopPropagation(); notify(`Только предпросмотр: карточка HA (${event.detail?.entityId || 'устройство'}) не эмулируется`);
  });
  document.addEventListener('hass-toggle-menu', () => { tools.hidden = !tools.hidden; });
  addEventListener('resize', () => { panel.narrow = matchMedia('(max-width: 870px)').matches; });
} catch (error) {
  const loading = document.querySelector('#loading');
  if (loading) loading.textContent = `Не удалось запустить стенд: ${error.message}`;
  notify(`Стенд не запущен: ${error.message}`); console.error(error);
}


// UI-006 r1. Local visual adapter; reuse the beta4 shared UI Kit stylesheet.
// Keep Lit nodes and their change/disabled/save handlers intact.
void customElements.whenDefined('hp-pdf-dialog').then(async PdfDialog => {
  const { e: ensureFormKitStyles } = await import('/assets/houseplan-assets/form-kit-styles-Cadt5rxn.js');
  const wired = new WeakSet();
  const decorate = host => {
    const root = host.shadowRoot;
    if (!root) return;
    ensureFormKitStyles(host);
    root.querySelector('.body')?.classList.add('hpf-form');
    for (const input of root.querySelectorAll('.body > label > input[type="checkbox"]')) {
      input.parentElement.classList.add('hpf-toggle', 'hpf-noicon', 'hpf-compact');
      input.parentElement.querySelector('span')?.classList.add('hpf-toggle-title');
    }
    const dialog = root.querySelector('hp-dialog');
    if (dialog && !wired.has(dialog)) {
      wired.add(dialog);
      const syncPointer = event => {
        if (!event.pointerType) return;
        dialog.toggleAttribute('data-pointer-hover', event.pointerType === 'mouse'
          && !event.sourceCapabilities?.firesTouchEvents
          && matchMedia('(any-hover: hover) and (any-pointer: fine)').matches);
      };
      dialog.addEventListener('pointerover', syncPointer, true);
      dialog.addEventListener('pointerdown', syncPointer, true);
      dialog.addEventListener('pointermove', syncPointer, true);
    }
  };
  const updated = PdfDialog.prototype.updated;
  PdfDialog.prototype.updated = function(changed) {
    updated?.call(this, changed);
    decorate(this);
  };
  for (const dialog of window.__lab?.card?.shadowRoot?.querySelectorAll('hp-pdf-dialog') || []) decorate(dialog);
});

