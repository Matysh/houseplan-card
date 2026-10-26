const notice = document.querySelector('#lab-notice');
let noticeTimer;
function notify(text) { notice.textContent = text; notice.hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.hidden = true; }, 5000); }
try {
  await import('/ha-bootstrap.mjs');
  if (!['ha-dialog', 'ha-icon', 'ha-card'].every(name => customElements.get(name))) throw Error('Настоящие компоненты HA не загрузились');
  const { createMockHa } = await import('/mock-ha.mjs');
  const mock = await createMockHa(notify);
  await import('/assets/houseplan-panel.js');
  const panel = document.createElement('houseplan-panel');
  panel.hass = mock.hass; panel.narrow = matchMedia('(max-width: 870px)').matches;
  document.querySelector('#product').replaceChildren(panel); mock.attach(panel);
  const card = panel.shadowRoot.querySelector('houseplan-card');
  window.__lab = { panel, card, mock, notify, safety: window.__labSafety };
  window.__card = card;
  const provenance = await (await fetch('/provenance.json')).json();
  document.querySelector('#lab-styles').checked = provenance.styleOverrides ?? (provenance.prototypeOverrides !== false);
  if (provenance.prototypeOverrides !== false) {
    const { installVacuumSettings } = await import('/overrides/vacuum-settings.mjs');
    installVacuumSettings(card, () => document.querySelector('#lab-styles').checked);
    const { installDeviceContacts } = await import('/overrides/device-contacts.mjs');
    installDeviceContacts(card, () => document.querySelector('#lab-styles').checked);
  }
  document.querySelector('#lab-provenance').textContent = `House Plan ${provenance.productVersion}\n${provenance.productCommit.slice(0, 12)}\nHA Frontend ${provenance.frontendVersion}\nСнимок: ${mock.capturedAt || 'демо'}\nНикакого подключения к твоему HA`;
  const tools = document.querySelector('#lab-tools');
  if(provenance.prototypeOverrides !== false && new URLSearchParams(location.search).get('contacts')==='1003')
    tools.querySelector(':scope > p').textContent='Тестовая сцена #1003: виртуальные, физические и разные по размеру значки. Перетаскивай их к стенам и друг к другу. Сессия хранится отдельно от твоего плана.';
  document.querySelector('#lab-launcher').onclick = () => { tools.hidden = !tools.hidden; };
  document.querySelector('#lab-close').onclick = () => { tools.hidden = true; };
  document.addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && e.code === 'KeyL') { e.preventDefault(); tools.hidden = !tools.hidden; } });
  const theme = document.querySelector('#lab-theme'); theme.value = localStorage.getItem('houseplan-ui-lab:theme') || 'owner';
  const applyTheme = () => {
    document.documentElement.dataset.theme = theme.value;
    localStorage.setItem('houseplan-ui-lab:theme', theme.value);
    mock.hass.themes = { ...mock.hass.themes, darkMode: theme.value !== 'light' };
    card.requestUpdate();
  };
  theme.onchange = applyTheme; applyTheme();
  const language = document.querySelector('#lab-language'); language.value = mock.hass.language;
  language.onchange = () => { mock.persist(); localStorage.setItem('houseplan-ui-lab:language', language.value); location.reload(); };
  const resetDialog = document.querySelector('#lab-reset-confirm');
  document.querySelector('#lab-reset').onclick = () => resetDialog.showModal();
  document.querySelector('#lab-reset-cancel').onclick = () => resetDialog.close();
  document.querySelector('#lab-reset-accept').onclick = () => { localStorage.removeItem(mock.sessionKey); location.reload(); };
  const download = (name, value) => { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  document.querySelector('#lab-export').onclick = () => download('houseplan-ui-lab-session.json', mock.snapshot());
  if (mock.vacuumReplay) {
    const replay = mock.vacuumReplay;
    document.querySelector('#lab-vacuum').hidden = false;
    const paintReplay = () => {
      const state = replay.getState();
      document.querySelector('#lab-vacuum-seek').value = String(state.progress);
      document.querySelector('#lab-vacuum-progress').textContent = `${Math.round(state.progress)}%`;
      document.querySelector('#lab-vacuum-play').textContent = state.playing ? 'Замереть для просмотра' : 'Продолжить движение';
      document.querySelector('#lab-vacuum-status').textContent = `${state.points} из ${state.totalPoints} точек. ${state.playing ? 'Идёт локальное воспроизведение.' : 'Кадр уборки зафиксирован для просмотра.'}`;
    };
    document.querySelector('#lab-vacuum-seek').oninput = event => { replay.setProgress(Number(event.target.value)); paintReplay(); };
    document.querySelector('#lab-vacuum-play').onclick = () => { replay.togglePlaying(); paintReplay(); };
    document.querySelector('#lab-vacuum-reset').onclick = () => { replay.setProgress(1); paintReplay(); };
    window.addEventListener('lab-vacuum-replay', paintReplay);
    paintReplay();
  }
  const deep = (selector, root = card.shadowRoot) => { const direct = root?.querySelector(selector); if (direct) return direct; for (const el of root?.querySelectorAll('*') || []) if (el.shadowRoot) { const found = deep(selector, el.shadowRoot); if (found) return found; } return null; };
  async function click(selector) { const el = deep(selector); if (!el) return notify('Сначала закрой текущий диалог или выбери подходящее пространство'); el.click(); }
  async function shortcut(kind) {
    tools.hidden = true;
    const simple = { settings: '[data-hp="settings"]', space: '[data-hp="space-settings"]', summary: '.summary-control button:first-child', pdf: '[data-hp="pdf"]' };
    if (simple[kind]) return click(simple[kind]);
    if (kind === 'device') {
      await click('[data-hp="mode-tab"][data-mode="devices"]');
      await new Promise(r => setTimeout(r, 450));
      const marker = deep('[data-hp="device"][data-id="lab_ceiling"]') || deep('[data-hp="device"][data-id]');
      // Wide desktop: one click selects the properties pane; the product's
      // second-click contract opens the full dialog, without a private API.
      if (marker) marker.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 2 }));
      else notify('Демонстрационный светильник не найден');
      return;
    }
    if (kind === 'room') {
      await click('[data-hp="mode-tab"][data-mode="plan"]');
      await new Promise(r => setTimeout(r, 450));
      return click('[data-hp="room-settings"]');
    }
  }
  for (const button of document.querySelectorAll('[data-open]')) button.onclick = () => shortcut(button.dataset.open);
  // No product styles are changed until a file in overrides/ is edited.
  const overrides = new Map(), roots = new Map();
  const installColorPicker = provenance.prototypeOverrides === false ? () => {}
    : (await import('/overrides/color-picker.mjs')).installColorPicker;
  const scan = (root, name = '') => {
    if (roots.has(root)) return;
    const entry = { name, style: null, observer: null };
    roots.set(root, entry);
    // Paint newly opened surfaces immediately, rather than at the next 1.2s CSS refresh.
    if (tags.includes(name)) {
      entry.style = document.createElement('style');
      entry.style.dataset.labOverride = name;
      entry.style.textContent = enabled.checked ? overrides.get(name) || '' : '';
      root.append(entry.style);
    }
    if (name === 'hp-color-opacity') installColorPicker(root, () => document.querySelector('#lab-styles').checked);
    const descend = node => { if (node.nodeType !== Node.ELEMENT_NODE) return; if (node.shadowRoot) scan(node.shadowRoot, node.localName); for (const child of node.querySelectorAll('*')) if (child.shadowRoot) scan(child.shadowRoot, child.localName); };
    for (const child of root.querySelectorAll('*')) if (child.shadowRoot) scan(child.shadowRoot, child.localName);
    const observer = new MutationObserver(list => { for (const entry of list) for (const node of entry.addedNodes) descend(node); });
    observer.observe(root, { childList: true, subtree: true }); entry.observer = observer;
  };
  const tags = ['houseplan-card', 'houseplan-panel', 'hp-dialog', 'ha-dialog', 'hp-pdf-dialog', 'hp-color-opacity', 'hp-zigbee-topology-settings'];
  const enabled = document.querySelector('#lab-styles');
  const { installColorPickerMotion } = await import('/overrides/color-picker-motion.mjs');
  installColorPickerMotion(() => enabled.checked);
  const { installDecorSelectionFrames } = await import('/overrides/decor-selection-frames.mjs');
  installDecorSelectionFrames(card, () => enabled.checked);
  const { installSpaceDialog } = await import('/overrides/space-dialog.mjs');
  installSpaceDialog(card, () => enabled.checked);
  const { installFurniturePlacementPan } = await import('/overrides/furniture-placement-pan.mjs');
  installFurniturePlacementPan(card, () => enabled.checked);
  const { installDeviceContextActions } = await import('/overrides/device-context-actions.mjs');
  installDeviceContextActions(card, () => enabled.checked);
  const { installConfirmationKit } = await import('/overrides/confirmation-kit.mjs');
  installConfirmationKit(card, () => enabled.checked);
  const { installHiddenDeviceStatus } = await import('/overrides/hidden-device-status.mjs');
  installHiddenDeviceStatus(card, () => enabled.checked);
  const { installEditorGridCoverage } = await import('/overrides/editor-grid-coverage.mjs');
  installEditorGridCoverage(card, () => enabled.checked);
  const { installFirstSpaceConverter } = await import('/overrides/first-space-converter.mjs');
  installFirstSpaceConverter(card, () => enabled.checked);
  const apply = () => {
    for (const [root, entry] of roots) {
      if (!tags.includes(entry.name)) continue;
      const text = enabled.checked ? overrides.get(entry.name) || '' : '';
      if (!entry.style || !root.contains(entry.style)) { entry.style = document.createElement('style'); entry.style.dataset.labOverride = entry.name; root.append(entry.style); }
      if (entry.style.textContent !== text) entry.style.textContent = text;
    }
  };
  enabled.onchange = () => { apply(); card.requestUpdate(); };
  async function refreshStyles() {
    for (const name of tags) { const response = await fetch(`/overrides/${name}.css`); if (response.ok) overrides.set(name, await response.text()); }
    // Discover shadow roots attached after their host was inserted.
    scan(document); for (const el of document.querySelectorAll('*')) if (el.shadowRoot) scan(el.shadowRoot, el.localName);
    for (const [root, entry] of roots) if (root.host && !root.host.isConnected) { entry.observer.disconnect(); roots.delete(root); }
    apply();
    document.querySelector('#lab-status').textContent = `Локально · ${mock.snapshot().config.spaces.length} пространства · стили обновлены ${new Date().toLocaleTimeString('ru')}`;
  }
  await refreshStyles(); setInterval(refreshStyles, 1200);
  if(provenance.prototypeOverrides !== false && new URLSearchParams(location.search).get('contacts')==='1003') {
    for(let attempt=0;attempt<30;attempt++) {
      const button=deep('[data-hp="mode-tab"][data-mode="devices"]');
      if(button) {button.click();break;}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
  }
  // Known external UI links are inert here; no browser navigation to live HA.
  document.addEventListener('click', e => {
    const a = e.composedPath().find(n => n instanceof HTMLAnchorElement);
    if (a?.href && !a.href.startsWith('blob:') && new URL(a.href).origin !== location.origin) { e.preventDefault(); notify('Демо: внешняя ссылка не открывается'); }
  }, true);
  document.addEventListener('hass-more-info', e => { e.stopPropagation(); notify(`Демо-карточка Home Assistant: ${e.detail?.entityId || 'устройство'}`); });
  document.addEventListener('hass-toggle-menu', () => { tools.hidden = !tools.hidden; });
  addEventListener('resize', () => { panel.narrow = matchMedia('(max-width: 870px)').matches; });
  document.querySelector('#lab-status').textContent = 'Готово · настоящий интерфейс, только локальные данные';
} catch (error) {
  document.querySelector('#loading').textContent = `Не удалось запустить стенд: ${error.message}`;
  console.error(error); throw error;
}
