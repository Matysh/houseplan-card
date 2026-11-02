import { installNetworkGuard, MAX_SESSION_BYTES, parseSession, saveSession, serializeSession } from './session.mjs';

installNetworkGuard(window);
// #1126 visual prototype: decorate the real arrival geometry, without touching
// the destination camera, stored stairs, navigation guards or pointer handling.
function installStairArrival1126(card) {
  let activation = null, revision = 0, timer;
  const overlays = new Set();
  const clear = () => {
    revision++;
    clearTimeout(timer);
    for (const overlay of overlays) overlay.remove();
    overlays.clear();
  };
  const capture = event => {
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    const stair = event.composedPath().find(node => node?.matches?.('.hp-stair-view.navigable'));
    if (!stair || card._mode !== 'view') return;
    const token = { space: card._space };
    activation = token;
    setTimeout(() => { if (activation === token) activation = null; }, 0);
  };
  card.shadowRoot.addEventListener('click', capture, true);
  card.shadowRoot.addEventListener('keydown', capture, true);
  const pick = card._pickSpace;
  card._pickSpace = function(...args) { clear(); return pick.apply(this, args); };
  const navigate = card._tabClick;
  card._tabClick = function(target) {
    const source = activation?.space;
    const result = navigate.call(this, target);
    if (!source || source === target || this._space !== target) return result;
    const token = revision;
    this.updateComplete.then(() => {
      if (revision !== token || this._space !== target || this._mode !== 'view') return;
      const ids = new Set((this._curSpaceCfg?.stairs || [])
        .filter(stair => stair.target_space_id === source).map(stair => stair.id));
      for (const stair of this.shadowRoot.querySelectorAll('.hp-stair-view[data-id]')) {
        if (!ids.has(stair.dataset.id)) continue;
        const outline = stair.querySelector('.hp-stair-outline');
        if (!outline) continue;
        const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        overlay.setAttribute('points', outline.getAttribute('points'));
        overlay.setAttribute('class', 'lab-stair-arrival');
        overlay.setAttribute('aria-hidden', 'true');
        stair.append(overlay);
        overlays.add(overlay);
      }
      timer = setTimeout(clear, 2000);
    });
    return result;
  };
}
const notice = document.querySelector('#lab-notice');
// #1127: shared UI Kit navigation, transient only on the kiosk surface.
function installKioskSwitcher1127(card, html, nothing) {
  let shown = false, timer;
  const eligible = () => card._kiosk && card._mode === 'view' && !card._hasFixedFloor && card._model.length > 1;
  const hide = () => { shown = false; card.requestUpdate(); };
  const touch = () => {
    if (!eligible()) return;
    shown = true;
    clearTimeout(timer);
    timer = setTimeout(hide, 5000);
    card.requestUpdate();
  };
  const interact = event => {
    if (!event.composedPath().some(node => node?.matches?.('.stage, ha-card, .lab-kiosk-spaces'))) return;
    // Hover never reveals the switcher. A continuing drag keeps it awake.
    if (event.type === 'pointermove' && !event.buttons) return;
    if (event.type === 'pointerdown' && event.button !== 0) return;
    touch();
  };
  for (const type of ['pointerdown','pointerup','pointermove','click','wheel','keydown'])
    card.shadowRoot.addEventListener(type, interact, {capture:true,passive:true});
  const render = card.render;
  card.render = function() {
    const content = render.call(this);
    const enabled = eligible();
    this.toggleAttribute('data-lab-kiosk-spaces', enabled);
    if (!enabled) { shown = false; clearTimeout(timer); return content; }
    const spaces = this._model;
    return html`${content}<nav class="hpf-navigation hpf-nav-compact lab-kiosk-spaces ${shown ? 'is-visible' : ''}"
      aria-label="Переключение пространств" aria-hidden=${String(!shown)} .inert=${!shown}
      @pointerdown=${event=>event.stopPropagation()} @click=${event=>event.stopPropagation()}>
      ${spaces.map((space,index)=>html`<button type="button"
        class="hpf-nav-item ${space.id === this._space ? 'active' : ''}"
        aria-label=${space.title} aria-current=${space.id === this._space ? 'page' : 'false'}
        data-hp-tooltip=${space.title}
        @click=${()=>{this._tabClick(space.id);touch();}}>${index+1}</button>`)}
    </nav>`;
  };
}
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
  const dashboard = location.pathname === '/dashboard';
  document.documentElement.dataset.surface = dashboard ? 'dashboard' : 'panel';
  document.title = dashboard ? 'Тестовая дашборда · House Plan 1.84 Beta 2' : 'House Plan · 1.84 Beta 2';
  const panel = document.createElement(dashboard ? 'houseplan-card' : 'houseplan-panel');
  if (dashboard) {
    // Reproduce HA Sections ownership of the card height/layout.
    panel.layout = 'grid';
    panel.setConfig({ type: 'custom:houseplan-card' });
    const header = document.createElement('header');
    header.id = 'dashboard-header';
    header.innerHTML = '<strong>Тестовая дашборда</strong><a href="/HousePlan">Основной план</a>';
    document.body.prepend(header);
  } else {
    panel.narrow = matchMedia('(max-width: 870px)').matches;
    panel.route = { prefix: '/HousePlan', path: '' };
  }
  panel.hass = mock.hass;
  document.querySelector('#product').replaceChildren(panel); mock.attach(panel);
  await panel.updateComplete;
  const card = dashboard ? panel : panel.shadowRoot.querySelector('houseplan-card');
  window.__lab = { panel, card, mock, notify, safety: window.__labSafety };
  const { b: profileHtml, A: profileNothing } = await import('/assets/houseplan-assets/lit-element-c7mGUREn.js');
  installProfile1165(card, profileHtml, profileNothing);
  installStairArrival1126(card);
  installKioskSwitcher1127(card, profileHtml, profileNothing);

  // #1157: permanent UI Kit hint below the toggle; existing help stays intact.
  const zigbeeMapExplanation = {
    ru: 'Карты Zigbee2MQTT и ZHA могут показывать соседские связи, а Houseplan показывает только маршруты, подтверждённые данными интеграции. Поэтому различия между картами нормальны. Если данных недостаточно для определения маршрута, связь может не отображаться. Это само по себе не означает, что устройство недоступно или сеть работает неправильно.',
    en: 'Zigbee2MQTT and ZHA maps may show neighbor links, while Houseplan shows only routes confirmed by integration data. Differences between the maps are therefore normal. If there is not enough data to determine a route, the link may not be displayed. This alone does not mean that the device is unavailable or that the network is malfunctioning.',
    de: 'Die Karten von Zigbee2MQTT und ZHA können Nachbarverbindungen anzeigen, während Houseplan nur Routen anzeigt, die durch Integrationsdaten bestätigt sind. Unterschiede zwischen den Karten sind daher normal. Reichen die Daten zur Bestimmung einer Route nicht aus, wird die Verbindung möglicherweise nicht angezeigt. Das allein bedeutet nicht, dass das Gerät nicht verfügbar ist oder das Netzwerk nicht richtig funktioniert.',
    fr: 'Les cartes Zigbee2MQTT et ZHA peuvent afficher des liaisons de voisinage, tandis que Houseplan affiche uniquement les routes confirmées par les données de l’intégration. Les différences entre les cartes sont donc normales. Si les données ne suffisent pas à déterminer une route, la liaison peut ne pas être affichée. Cela ne signifie pas, à lui seul, que l’appareil est indisponible ou que le réseau fonctionne mal.',
  };
  customElements.whenDefined('hp-zigbee-topology-settings').then(() => {
    const proto = customElements.get('hp-zigbee-topology-settings').prototype;
    const originalUpdated = proto.updated;
    proto.updated = function(changed) {
      originalUpdated?.call(this, changed);
      const toggle = this.shadowRoot.querySelector('[data-field="zigbee-enabled"]')?.closest('label');
      if (!toggle) return;
      let hint = toggle.parentElement.querySelector('[data-lab="zigbee-map-explanation"]');
      if (!hint) {
        hint = document.createElement('p');
        hint.className = 'hpf-hint';
        hint.dataset.lab = 'zigbee-map-explanation';
        toggle.after(hint);
      }
      const lang = this.hass?.language || this.language || window.__labLanguage;
      const text = zigbeeMapExplanation[lang] || zigbeeMapExplanation.en;
      if (hint.textContent !== text) hint.textContent = text;
    };
  });

  // UI-001 prototype: use the product's existing lazy UI Kit tooltip owner.
  // Only migrate header titles; no second tooltip renderer or event handlers.
  await card.updateComplete;
  const migrateHeaderTooltips = () => {
    for (const control of card.shadowRoot.querySelectorAll('.head [title]')) {
      const text = control.getAttribute('title');
      if (text) control.setAttribute('data-hp-tooltip', text);
      control.removeAttribute('title');
    }
  };
  // UI-002: the same inline hint style used by the wall drawing toolbar.
  const syncDecorLineHint = () => {
    const width = card.shadowRoot.querySelector('[data-field="decor-stroke-width"]');
    const label = width?.closest('label');
    const wanted = card._mode === 'decor' && card._decorTool === 'line' && label;
    const existing = card.shadowRoot.querySelector('[data-lab="decor-line-hint"]');
    if (!wanted) { existing?.remove(); return; }
    const texts = { ru: 'Shift — шаг 45°', en: 'Shift — 45° steps', de: 'Shift — 45° Schritte', fr: 'Maj — pas de 45°' };
    const text = texts[mock.hass.language] || texts.ru;
    const hint = existing || document.createElement('span');
    if (!existing) { hint.className = 'hint'; hint.dataset.lab = 'decor-line-hint'; }
    if (hint.textContent !== text) hint.textContent = text;
    if (label.nextElementSibling !== hint) label.after(hint);
  };
  // UI-004: maxlength is native only for text inputs; preserve decimal input
  // and the existing numeric conversion in the product's input handler.
  const limitThicknessInput = () => {
    for (const input of card.shadowRoot.querySelectorAll('.editor-secondary .drawwall > input:is([data-field="decor-stroke-width"], [data-field="wall-thickness"])')) {
      if (input.type !== 'text') input.type = 'text';
      if (input.inputMode !== 'decimal') input.inputMode = 'decimal';
      if (input.maxLength !== 3) input.maxLength = 3;
    }
  };
  // UI-005: prospective wall node has the exact radius of existing wall nodes.
  const syncWallPreviewSize = () => {
    const node = card.shadowRoot.querySelector('.stage.tool-draw .plan-snap-node[data-kind="endpoint"]');
    const active = card.shadowRoot.querySelector('.stage.tool-draw [data-hp="plan-snap-active-marker"]');
    const radius = node ? Number(node.getAttribute('r')) : active ? Number(active.getAttribute('r')) / 2 : 0;
    if (radius > 0) {
      const value = radius + 'px';
      if (card.style.getPropertyValue('--lab-wall-node-radius') !== value) card.style.setProperty('--lab-wall-node-radius', value);
    }
  };
  // UI-008: reuse the product toast when its existing empty-face hover is active.
  let roomCreationHoverKey = '';
  const roomCreationHint = 'Клик создаст комнату';
  const roomCreationToastId = 'lab.room-create-hint';
  // UI-009: shared geometry for every standard card toast, independent of
  // message, ID, severity and the empty-contour hint. Dialog portals retain
  // their own UI Kit positioning because this rule lives in the card root.
  let toastStage = null;
  const positionPlanToasts = () => {
    if (!toastStage) return;
    const rect = toastStage.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportRight = viewportLeft + (viewport?.width || document.documentElement.clientWidth);
    const left = Math.max(viewportLeft, rect.left);
    const right = Math.min(viewportRight, rect.right);
    if (right <= left) return;
    for (const [name, value] of [
      ['--lab-plan-toast-center', ((left + right) / 2) + 'px'],
      ['--lab-plan-toast-max-width', Math.max(0, right - left - 24) + 'px'],
    ]) if (card.style.getPropertyValue(name) !== value) card.style.setProperty(name, value);
  };
  const toastGeometryObserver = new ResizeObserver(positionPlanToasts);
  const syncPlanToastGeometry = () => {
    const stage = card.shadowRoot.querySelector('.stage') || card;
    if (stage !== toastStage) {
      toastGeometryObserver.disconnect(); toastStage = stage;
      toastGeometryObserver.observe(stage);
    }
    positionPlanToasts();
  };
  addEventListener('resize', positionPlanToasts);
  addEventListener('scroll', positionPlanToasts, { capture: true, passive: true });
  window.visualViewport?.addEventListener('resize', positionPlanToasts);
  window.visualViewport?.addEventListener('scroll', positionPlanToasts);
  const syncRoomCreationHint = () => {
    const paths = card._editorRuntime?.roomFaceHoverPaths;
    const key = paths ? card._space + ':' + paths.fillD : '';
    if (key === roomCreationHoverKey) return;
    roomCreationHoverKey = key;
    if (key) {
      // A hover hint must not replace an error or a save notification.
      if (!card._toast || card._toast === roomCreationHint) card._showToast(roomCreationHint, roomCreationToastId);
    } else {
      const toast = card.shadowRoot.querySelector('[data-hp="toast"][data-id="lab.room-create-hint"]');
      if (toast && card._toast === roomCreationHint) {
        clearTimeout(card._toastTimer);
        card._toast = '';
        card._toastPresentation.clear();
      }
    }
  };
  // UI-017: jambs retain the renderer's ordinary opening colour in every
  // state. Reuse it for the leaf; only a sensor-active arc gets theme accent.
  const syncDoorBaseColour = () => {
    for (const opening of card.shadowRoot.querySelectorAll('.opening[data-kind="door"]')) {
      const base = opening.querySelector(':scope > g > line[stroke]')?.getAttribute('stroke');
      if (base && opening.style.getPropertyValue('--lab-door-base') !== base) opening.style.setProperty('--lab-door-base', base);
    }
  };
  const headerTooltipObserver = new MutationObserver(records => {
    if (records.every(record => record.target.closest?.('.lab-scene-snapshot, .lab-header-snapshot'))) return;
    migrateHeaderTooltips(); syncDecorLineHint(); limitThicknessInput(); syncWallPreviewSize(); syncPlanToastGeometry(); syncRoomCreationHint(); syncDoorBaseColour();
  });
  headerTooltipObserver.observe(card.shadowRoot, { subtree: true, childList: true, attributes: true, attributeFilter: ['title', 'r', 'd', 'stroke'] });
  migrateHeaderTooltips(); syncDecorLineHint(); limitThicknessInput(); syncWallPreviewSize(); syncPlanToastGeometry();
  syncDoorBaseColour();

  // UI-011: one measured source -> destination transaction. The destination
  // header gets its FINAL width before the product's overflow measurement.
  // Only presentation transforms change during the mode animation.
  const chromeSurface = () => card.shadowRoot.querySelector('ha-card');
  let chromeTransaction = null;
  let modeScaleAnchor = null;
  const lockModeScale = visual => {
    const anchor = modeScaleAnchor;
    if (!anchor) return null;
    const aspect = visual.stageWidth / visual.stageHeight;
    const vb = card._baseVb(), display = card._displayBase(vb);
    const fitWidth = Math.max(vb[2], vb[3] * aspect);
    const displayFitWidth = Math.max(display.w, display.h * aspect);
    const displayedWidth = visual.stageWidth / anchor.pixelsPerUnit;
    const zoom = displayFitWidth / displayedWidth;
    const w = card._rotation ? fitWidth / zoom : displayedWidth;
    const h = w / aspect;
    visual.viewport = { centerX: anchor.cx, centerY: anchor.cy,
      pixelsPerUnit: visual.stageWidth / w,
      viewBox: { x: anchor.cx-w/2, y: anchor.cy-h/2, w, h } };
    return card._rotation ? zoom : fitWidth / w;
  };
  const headerControls = head => [...head.querySelectorAll('button, select, input, [role="button"], .compact-space-select, .title')]
    .filter(node => !node.parentElement?.closest('button, [role="button"], .compact-space-select'));
  const controlKey = (node, index) => node.dataset.mode ? `mode:${node.dataset.mode}`
    : node.dataset.hp ? `hp:${node.dataset.hp}`
    : node.getAttribute('aria-label') || node.getAttribute('data-hp-tooltip') || node.getAttribute('title')
      || `${node.className}:${node.textContent.trim()}:${index}`;
  const controlSamples = head => headerControls(head).map((node, index) => ({
    node, key: controlKey(node, index), rect: node.getBoundingClientRect(),
    translate: node.style.translate, opacity: node.style.opacity,
  })).filter(item => item.rect.width > 0 && item.rect.height > 0);
  // UI-012: retain the painted source scene until the destination is visible.
  // This covers layers removed from the DOM as well as CSS opacity changes.
  let sceneSnapshotId = 0;
  const captureModeScene = surface => {
    const stage = surface.querySelector('.stage:not(.lab-scene-snapshot)');
    const zoom = stage?.querySelector('.zoomwrap');
    const svg = zoom?.querySelector('.plan-svg');
    if (!stage || !zoom || !svg) return null;
    const view = svg.getAttribute('viewBox')?.trim().split(/\s+/).map(Number);
    if (view?.length !== 4 || !view.every(Number.isFinite) || !view[2] || !view[3]) return null;
    const width = stage.clientWidth, height = stage.clientHeight;
    const snapshot = stage.cloneNode(false);
    snapshot.classList.remove('mode-transition');
    snapshot.classList.add('lab-scene-snapshot');
    snapshot.inert = true;
    snapshot.setAttribute('aria-hidden', 'true');
    snapshot.style.background = getComputedStyle(stage).background;
    const env = stage.querySelector(':scope > .hp-day-cycle-env');
    if (env) snapshot.append(env.cloneNode(true));
    const content = zoom.cloneNode(true);
    content.style.setProperty('width', `${width}px`, 'important');
    content.style.setProperty('height', `${height}px`, 'important');
    content.style.transformOrigin = '0 0';
    content.style.containerType = 'inline-size';
    snapshot.append(content);
    // Snapshot SVG definitions must not collide with the live scene, and live
    // viewport writers must not update this frozen source behind our back.
    const ids = new Map();
    const prefix = `lab-scene-${++sceneSnapshotId}-`;
    for (const node of snapshot.querySelectorAll('[id]')) ids.set(node.id, prefix + node.id);
    for (const node of [snapshot, ...snapshot.querySelectorAll('*')]) {
      for (const attr of [...node.attributes]) {
        if (attr.name.startsWith('data-hp-live')) { node.removeAttribute(attr.name); continue; }
        let value = attr.value;
        if (attr.name === 'id') value = ids.get(value) || value;
        else if (value.includes('url(#')) value = value.replace(/url\(#([^)]*)\)/g, (match, id) => ids.has(id) ? `url(#${ids.get(id)})` : match);
        else if ((attr.name === 'href' || attr.name === 'xlink:href') && value[0] === '#' && ids.has(value.slice(1))) value = '#' + ids.get(value.slice(1));
        if (value !== attr.value) node.setAttribute(attr.name, value);
      }
    }
    const top = stage.getBoundingClientRect().top - surface.getBoundingClientRect().top;
    snapshot.style.top = `${top}px`;
    snapshot.style.width = `${width}px`;
    snapshot.style.height = `${height}px`;
    surface.append(snapshot);
    const opacity = zoom.style.opacity;
    zoom.style.opacity = '0';
    return { snapshot, content, view, width, height, top, live: zoom, opacity };
  };
  const paintModeScene = (tx, state, p) => {
    const scene = tx?.scene;
    if (!scene) return;
    const view = card._presentationView(state.presented.viewport.viewBox);
    const width = state.presented.stageWidth, height = state.presented.stageHeight;
    // Map the frozen source pixels onto the same moving camera as the live
    // scene; cross-fading must not produce two drifting copies of the plan.
    const oldScale = Math.min(scene.width / scene.view[2], scene.height / scene.view[3]);
    const newScale = Math.min(width / view.w, height / view.h);
    const scale = newScale / oldScale;
    const oldX = (scene.width - scene.view[2] * oldScale) / 2;
    const oldY = (scene.height - scene.view[3] * oldScale) / 2;
    const x = (width - view.w * newScale) / 2 + (scene.view[0] - view.x) * newScale - oldX * scale;
    const y = (height - view.h * newScale) / 2 + (scene.view[1] - view.y) * newScale - oldY * scale;
    scene.content.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    if (tx.composite) {
      scene.snapshot.style.clipPath = `inset(0 ${Math.max(0, tx.composite.maxWidth-width)}px ${Math.max(0, tx.composite.maxHeight-height)}px 0)`;
      scene.snapshot.style.transform = `translateY(${state.presented.headerHeight-state.from.headerHeight+state.presented.editorChromeHeight-state.from.editorChromeHeight}px)`;
    } else {
      scene.snapshot.style.width = `${width}px`;
      scene.snapshot.style.height = `${height}px`;
      scene.snapshot.style.top = `${scene.top + state.presented.headerHeight - state.from.headerHeight + state.presented.editorChromeHeight - state.from.editorChromeHeight}px`;
    }
    scene.snapshot.style.opacity = `${1-p}`;
    scene.live.style.opacity = `${p}`;
  };
  const pixelTransform = (source, view, width, height) => {
    const a = Math.min(source.width / source.view[2], source.height / source.view[3]);
    const b = Math.min(width / view.w, height / view.h);
    const s = b/a;
    const x = (width-view.w*b)/2 + (source.view[0]-view.x)*b - (source.width-source.view[2]*a)/2*s;
    const y = (height-view.h*b)/2 + (source.view[1]-view.y)*b - (source.height-source.view[3]*a)/2*s;
    return `translate(${x}px, ${y}px) scale(${s})`;
  };
  const clearChromeMotion = () => {
    const tx = chromeTransaction;
    chromeTransaction = null;
    if (!tx) return;
    for (const item of tx.target || []) {
      item.node.style.translate = item.translate;
      item.node.style.opacity = item.opacity;
    }
    tx.snapshot.remove();
    tx.scene?.snapshot.remove();
    if (tx.scene) tx.scene.live.style.opacity = tx.scene.opacity;
    if (tx.composite) for (const [node, properties] of tx.composite.restore) {
      for (const [name, value, priority] of properties) {
        if (value) node.style.setProperty(name, value, priority); else node.style.removeProperty(name);
      }
    }
    if (tx.composite) {
      card._roViewport?.observe(tx.composite.stage);
      card._roHdr?.observe(tx.composite.head.parentElement);
      card._roHdr?.observe(tx.composite.stage);
    }
    tx.panel?.style.removeProperty('transform');
    if (tx.outgoing?.hasAttribute('data-lab-outgoing')) tx.outgoing.remove();
    tx.surface.removeAttribute('data-lab-header-measuring');
    tx.surface.removeAttribute('data-lab-editor-motion');
    for (const key of ['--lab-editor-width', '--lab-header-width', '--lab-properties-shift']) tx.surface.style.removeProperty(key);
  };
  const prepareMode = card._prepareModeTransition;
  card._prepareModeTransition = function(...args) {
    clearChromeMotion();
    const surface = chromeSurface();
    const header = surface?.querySelector('.hdr');
    const head = header?.querySelector('.head');
    const stage = surface?.querySelector('.stage:not(.lab-scene-snapshot)');
    const sourceView = stage?.querySelector('.plan-svg')?.getAttribute('viewBox')?.trim().split(/\s+/).map(Number);
    modeScaleAnchor = sourceView?.length === 4 && sourceView[2] > 0 ? {
      pixelsPerUnit: Math.min(args[1].stageWidth/sourceView[2], args[1].stageHeight/sourceView[3]),
      cx: args[1].viewport.centerX, cy: args[1].viewport.centerY,
    } : null;
    if (head && !this._reducedMotion) {
      const source = controlSamples(head);
      const snapshot = header.cloneNode(false);
      snapshot.classList.add('lab-header-snapshot');
      snapshot.inert = true;
      snapshot.setAttribute('aria-hidden', 'true');
      const copy = head.cloneNode(true);
      copy.style.setProperty('width', `${head.getBoundingClientRect().width}px`, 'important');
      copy.style.setProperty('height', `${head.getBoundingClientRect().height}px`, 'important');
      snapshot.append(copy);
      for (const node of snapshot.querySelectorAll('[id]')) node.removeAttribute('id');
      surface.append(snapshot);
      const copies = headerControls(copy);
      const originals = headerControls(head);
      for (const item of source) item.copy = copies[originals.indexOf(item.node)];
      chromeTransaction = { surface, surfaceWidth: surface.clientWidth, snapshot, source, target: null, scene: captureModeScene(surface),
        outgoing: args[2] === 'view' ? surface.querySelector('.hp-properties') : null };
      surface.setAttribute('data-lab-header-measuring', '');
      surface.style.setProperty('--lab-properties-shift', args[1].presentedMode === 'view' ? '360px' : '0px');
    }
    return prepareMode.apply(this, args);
  };
  const preserveOutgoingPanel = () => {
    const tx = chromeTransaction;
    if (!tx?.outgoing || tx.outgoing.isConnected || card._mode !== 'view') return;
    tx.outgoing.setAttribute('data-lab-outgoing', '');
    tx.outgoing.setAttribute('aria-hidden', 'true');
    tx.outgoing.inert = true;
    tx.surface.append(tx.outgoing);
  };
  const chromeObserver = new MutationObserver(preserveOutgoingPanel);
  chromeObserver.observe(card.shadowRoot, { childList: true, subtree: true });
  const transitionProgress = state => {
    for (const key of ['stageWidth', 'stageHeight', 'editorWeight']) {
      const delta = state.to[key] - state.from[key];
      if (Math.abs(delta) > .001) return Math.max(0, Math.min(1, (state.presented[key] - state.from[key]) / delta));
    }
    const x = state.duration ? Math.max(0, Math.min(1, (performance.now() - state.startedAt) / state.duration)) : 1;
    const cubic = (t, a, b) => 3 * (1-t) ** 2 * t * a + 3 * (1-t) * t*t * b + t*t*t;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 12; i++) { t = (lo+hi)/2; if (cubic(t,.2,.2) < x) lo = t; else hi = t; }
    return cubic(t,.7,1);
  };
  const modeFrame = card._applyModeTransitionFrame;
  // Render the destination once, behind the retained source. Both cameras
  // then move as composited layers; do not rebuild SVG/devices on every RAF.
  const controllerStart = card._modeTransition.start;
  card._modeTransition.start = function(from, to, mode, duration) {
    const tx = chromeTransaction;
    const zoom = lockModeScale(to);
    if (zoom !== null) {
      card._modeTransitionTargetZoom = zoom;
      card._modeTransitionTargetCenterX = to.viewport.centerX;
      card._modeTransitionTargetCenterY = to.viewport.centerY;
    }
    if (!tx?.scene || duration <= 0) return controllerStart.call(this, from, to, mode, duration);
    card._modeTransitionPreparing = true;
    card._modeTransitionVisual = to;
    card._view = { ...to.viewport.viewBox };
    card.requestUpdate();
    void card.updateComplete.then(() => {
      if (chromeTransaction !== tx || card._mode !== mode) return;
      const stage = tx.surface.querySelector('.stage:not(.lab-scene-snapshot)');
      const zoom = stage.querySelector('.zoomwrap');
      const view = zoom.querySelector('.plan-svg').getAttribute('viewBox').trim().split(/\s+/).map(Number);
      const head = tx.surface.querySelector('.hdr:not(.lab-header-snapshot) > .head');
      const chrome = tx.surface.querySelector('.editorchrome');
      const inner = chrome?.querySelector('.editorchrome-inner');
      const restore = [];
      const remember = (node, names) => { if (node) restore.push([node, names.map(name => [name, node.style.getPropertyValue(name), node.style.getPropertyPriority(name)])]); };
      remember(zoom, ['width','height','transform','transform-origin','container-type','will-change']);
      remember(stage, ['clip-path', 'transform', 'will-change']);
      remember(chrome, ['transform', 'opacity']);
      zoom.style.width = `${to.stageWidth}px`;
      zoom.style.height = `${to.stageHeight}px`;
      zoom.style.transformOrigin = '0 0';
      zoom.style.containerType = 'inline-size';
      zoom.style.willChange = 'transform, opacity';
      const maxWidth = Math.max(from.stageWidth,to.stageWidth), maxHeight = Math.max(from.stageHeight,to.stageHeight);
      stage.style.height = `${maxHeight}px`;
      stage.style.willChange = 'transform, clip-path';
      tx.surface.style.setProperty('--lab-editor-width', `${maxWidth}px`);
      tx.scene.snapshot.style.width = `${maxWidth}px`;
      tx.scene.snapshot.style.height = `${maxHeight}px`;
      tx.composite = { stage, zoom, head, chrome, inner, restore, view, width: to.stageWidth, height: to.stageHeight, maxWidth, maxHeight };
      card._roViewport?.disconnect();
      card._roHdr?.disconnect();
      tx.surface.style.setProperty('--lab-header-width', `${to.stageWidth}px`);
      tx.surface.setAttribute('data-lab-editor-motion', '');
      tx.panel = tx.surface.querySelector('.hp-properties');
      tx.target = controlSamples(head);
      const source = new Map(tx.source.map(item => [item.key, item]));
      const target = new Map(tx.target.map(item => [item.key, item]));
      for (const item of tx.target) item.from = source.get(item.key);
      for (const item of tx.source) item.to = target.get(item.key);
      // Let the retained/target layers be painted before starting the 220 ms
      // clock. Preparation is not allowed to consume the first motion frames.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (chromeTransaction !== tx || card._mode !== mode) return;
        card._modeTransitionPreparing = false;
        controllerStart.call(this, from, to, mode, duration);
      }));
    });
    return 0;
  };
  const shouldUpdate = card.shouldUpdate;
  card.shouldUpdate = function(changed) {
    return chromeTransaction?.composite ? false : shouldUpdate.call(this, changed);
  };
  card._applyModeTransitionFrame = function(state) {
    // Width/height may change, but one world unit must occupy the same number
    // of screen pixels throughout View <-> editor and editor <-> editor moves.
    lockModeScale(state.presented);
    const tx = chromeTransaction;
    if (tx) {
      if (!tx.target) {
        // _prepareModeTransition has already awaited _settlePanelHeader here.
        // Freeze its final width, and capture final controls once, not per RAF.
        tx.surface.style.setProperty('--lab-header-width', `${state.to.stageWidth}px`);
        tx.surface.setAttribute('data-lab-editor-motion', '');
        tx.panel = tx.surface.querySelector('.hp-properties');
        tx.target = controlSamples(tx.surface.querySelector('.hdr:not(.lab-header-snapshot) > .head'));
        const source = new Map(tx.source.map(item => [item.key, item]));
        const target = new Map(tx.target.map(item => [item.key, item]));
        for (const item of tx.target) item.from = source.get(item.key);
        for (const item of tx.source) item.to = target.get(item.key);
      }
      const p = transitionProgress(state);
      if (!tx.composite) tx.surface.style.setProperty('--lab-editor-width', `${state.presented.stageWidth}px`);
      const inset = tx.surfaceWidth - state.presented.stageWidth;
      if (tx.panel) tx.panel.style.transform = `translateX(${Math.max(0, Math.min(360, 360-inset))}px)`;
      for (const item of tx.target) {
        const dx = item.from ? item.from.rect.left - item.rect.left : 0;
        const dy = item.from ? item.from.rect.top - item.rect.top : 0;
        item.node.style.translate = `${dx * (1-p)}px ${dy * (1-p)}px`;
        item.node.style.opacity = `${p}`;
      }
      for (const item of tx.source) if (item.copy) {
        const dx = item.to ? item.to.rect.left - item.rect.left : 0;
        const dy = item.to ? item.to.rect.top - item.rect.top : 0;
        item.copy.style.translate = `${dx * p}px ${dy * p}px`;
      }
      tx.snapshot.style.opacity = `${1-p}`;
      tx.surface.removeAttribute('data-lab-header-measuring');
      preserveOutgoingPanel();
    }
    let result;
    if (tx?.composite) {
      this._modeTransitionVisual = state.presented;
      this._view = { ...state.presented.viewport.viewBox };
      const c = tx.composite, v = state.presented;
      if (c.chrome) {
        c.chrome.style.transform = `translateY(${v.headerHeight-state.to.headerHeight}px)`;
        c.chrome.style.opacity = `${v.editorWeight}`;
      }
      if (c.inner) c.inner.style.opacity = `${v.toolbarContentOpacity}`;
      c.stage.style.clipPath = `inset(0 ${Math.max(0,c.maxWidth-v.stageWidth)}px ${Math.max(0,c.maxHeight-v.stageHeight)}px 0)`;
      c.stage.style.transform = `translateY(${v.headerHeight-state.to.headerHeight+v.editorChromeHeight-state.to.editorChromeHeight}px)`;
      c.zoom.style.transform = pixelTransform(c, this._presentationView(v.viewport.viewBox), v.stageWidth, v.stageHeight);
    } else result = modeFrame.call(this, state);
    if (tx) paintModeScene(tx, state, transitionProgress(state));
    return result;
  };
  const settleMode = card._settleModeTransition;
  card._settleModeTransition = function(state) { clearChromeMotion(); const result = settleMode.call(this, state); modeScaleAnchor = null; return result; };
  const cancelMode = card._cancelModeTransition;
  card._cancelModeTransition = function(...args) { clearChromeMotion(); const result = cancelMode.apply(this, args); modeScaleAnchor = null; return result; };
  // Opt-in local measurement; no observer/timing overhead during normal use.
  if (new URLSearchParams(location.search).has('motionProfile')) {
    let sample;
    const samples = [];
    const longFrames = [];
    if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) longFrames.push({ start: e.startTime, duration: e.duration,
          render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0,
          scripts: e.scripts.map(s => ({ name: s.sourceFunctionName, duration: s.duration, forced: s.forcedStyleAndLayoutDuration })) });
      }).observe({ type: 'long-animation-frame' });
    }
    const prepare = card._prepareModeTransition;
    card._prepareModeTransition = function(...args) {
      sample = { mode: args[2], start: performance.now(), frames: [], work: [], calls: {} };
      const result = prepare.apply(this, args);
      sample.prepareSync = performance.now() - sample.start;
      return result;
    };
    const frame = card._applyModeTransitionFrame;
    card._applyModeTransitionFrame = function(state) {
      const start = performance.now();
      if (sample) sample.frames.push(start);
      const result = frame.call(this, state);
      if (sample) sample.work.push(performance.now() - start);
      return result;
    };
    for (const name of ['render', 'updated', '_panelHeaderChoice', '_syncLiveViewport']) {
      const original = card[name];
      if (typeof original !== 'function') continue;
      card[name] = function(...args) {
        const start = performance.now();
        const result = original.apply(this, args);
        if (sample) { const stat = sample.calls[name] ||= { count: 0, ms: 0 }; stat.count++; stat.ms += performance.now()-start; }
        return result;
      };
    }
    const settle = card._settleModeTransition;
    card._settleModeTransition = function(state) {
      const current = sample;
      const result = settle.call(this, state);
      sample = null;
      if (current) {
        current.end = performance.now();
        current.stage = [state.to.stageWidth, state.to.stageHeight];
        setTimeout(() => {
          current.longFrames = longFrames.filter(e => e.start >= current.start - 30 && e.start <= current.end + 30);
          samples.push(current);
          card.dataset.labMotionProfile = JSON.stringify(samples.slice(-30));
        }, 100);
      }
      return result;
    };
  }
  // UI-010: growing wall geometry must not re-fit the rotated presentation.
  // Rebase the relative zoom against the new content frame, retaining the
  // painted scale and world-space camera centre. Explicit zoom/fit still work.
  const originalFrameOf = card._frameOf;
  const fittedWidth = (rect, aspect) => Math.max(rect.w, rect.h * aspect);
  card._frameOf = function(...args) {
    const previous = this._frame;
    const view = this._view && { ...this._view };
    const zoom = this._zoom;
    const next = originalFrameOf.apply(this, args);
    if (this._mode !== 'plan' || this._modeTransitionBusy || !view?.w ||
        !previous?.grow || !next?.grow || previous.id !== next.id ||
        previous === next || this._effectiveProjection() !== 'flat') return next;
    const a = previous.rect, b = next.rect;
    if (a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h) return next;
    const size = this._lastValidStageSize;
    const aspect = size ? size[0] / size[1] : view.w / view.h;
    const quarterTurn = this._rotation === 90 || this._rotation === 270;
    const displayWidth = rect => fittedWidth(quarterTurn ? { w: rect.h, h: rect.w } : rect, aspect);
    const paintedWidth = this._rotation ? displayWidth(a) / zoom : view.w;
    const nextZoom = displayWidth(b) / paintedWidth;
    const w = fittedWidth(b, aspect) / nextZoom;
    const h = w / aspect;
    this._zoom = nextZoom;
    this._view = { x: view.x + (view.w - w) / 2, y: view.y + (view.h - h) / 2, w, h };
    return next;
  };

  // UI-010 diagnostics are opt-in: geometry reads/stack capture must not run
  // during normal editor navigation.
  if (new URLSearchParams(location.search).has('cameraTrace')) {
  let cameraTraceUntil = 0;
  const cameraSnapshot = () => {
    const stage = card.shadowRoot.querySelector('.stage');
    return { zoom: card._zoom, view: card._view && { ...card._view }, rotation: card._rotation,
      mode: card._mode, tool: card._tool, points: card._path?.length,
      stage: stage && [stage.clientWidth, stage.clientHeight],
      svgView: card.shadowRoot.querySelector('.plan-svg')?.getAttribute('viewBox') };
  };
  const cameraTrace = (reason, before, stack, input) => {
    const entry = { reason, time: Math.round(performance.now()), before, after: cameraSnapshot(), stack, input };
    console.info('[UI-Lab camera] ' + JSON.stringify(entry));
    // Local-only DOM diagnostics, readable without exposing house config.
    const entries = JSON.parse(card.dataset.labCameraTrace || '[]');
    entries.push(entry); card.dataset.labCameraTrace = JSON.stringify(entries.slice(-24));
  };
  for (const name of ['_applyView', '_restoreZoom', '_rezoom', '_startCameraTransition', '_fitRoom']) {
    const original = card[name];
    if (typeof original !== 'function') continue;
    card[name] = function(...args) {
      const before = cameraSnapshot();
      const result = original.apply(this, args);
      if (performance.now() < cameraTraceUntil || name === '_startCameraTransition') cameraTrace(name + (name === '_startCameraTransition' ? ':' + args[2] : ''), before, new Error().stack);
      return result;
    };
  }
  card.shadowRoot.addEventListener('wheel', event => {
    if (card._mode !== 'plan' || !event.composedPath().some(node => node?.classList?.contains('stage'))) return;
    cameraTrace('wheel-input', cameraSnapshot(), undefined, {
      deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: event.deltaZ,
      deltaMode: event.deltaMode, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey,
      isTrusted: event.isTrusted,
    });
  }, { capture: true, passive: true });
  card.shadowRoot.addEventListener('click', event => {
    if (card._mode !== 'plan' || card._tool !== 'draw' || !event.composedPath().some(node => node?.classList?.contains('stage'))) return;
    cameraTraceUntil = performance.now() + 2000;
    const before = cameraSnapshot();
    cameraTrace('wall-click', before);
    for (const delay of [0, 100, 500, 1600]) setTimeout(() => cameraTrace('after-click-' + delay, before), delay);
  }, { capture: true });

  }

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

  // Live CSS overrides for the local prototypes above; the release bundle
  // itself remains unchanged. Observe only newly inserted shadow-root branches.
  const tags = ['houseplan-card', 'houseplan-panel', 'hp-dialog', 'ha-dialog'];
  // UI-015: selection is a fill, pointer/keyboard navigation is an outline.
  // Apply the same rule in the select shadow root and its fallback portal.
  const selectOptionStyles = `
    .menu [data-hp="select-option"] {
      background: transparent;
      box-shadow: inset 0 0 0 1px transparent;
    }
    .menu [data-hp="select-option"][aria-selected="true"] {
      background: var(--hpf-tint, color-mix(in srgb, var(--primary-color, #03a9f4) 12%, transparent));
    }
    .menu [data-hp="select-option"]:not([aria-disabled="true"]):hover,
    .menu [data-hp="select-option"].active:not([aria-selected="true"]):not([aria-disabled="true"]) {
      box-shadow: inset 0 0 0 1px var(--hpf-accent, var(--primary-color, #03a9f4));
    }
    .menu [data-hp="select-option"][aria-disabled="true"] {
      background: transparent;
      box-shadow: none;
    }
  `;
  const overrides = new Map(), roots = new Map();
  const enabled = document.querySelector('#lab-styles');
  const apply = () => {
    for (const [root, entry] of roots) {
      const sharedSelect = entry.name === 'hp-settings-select' || root.host?.dataset.hpOverlay === 'select';
      if (!sharedSelect && !tags.includes(entry.name)) continue;
      if (!entry.style || !root.contains(entry.style)) {
        entry.style = document.createElement('style'); entry.style.dataset.labOverride = entry.name; root.append(entry.style);
      }
      const text = enabled.checked ? sharedSelect ? selectOptionStyles : overrides.get(entry.name) || '' : '';
      if (entry.style.textContent !== text) entry.style.textContent = text;
    }
  };
  const scan = root => {
    if (!roots.has(root)) {
      const observer = new MutationObserver(records => {
        // Discover only new branches, never re-walk the entire plan on every
        // Lit text/geometry commit. Frozen animation copies need no overrides.
        for (const record of records) for (const node of record.addedNodes) {
          if (node.nodeType !== 1 || node.closest?.('.lab-scene-snapshot, .lab-header-snapshot')) continue;
          discover(node);
        }
        apply();
      });
      roots.set(root, { name: root.host?.localName || '', style: null, observer });
      observer.observe(root, { childList: true, subtree: true });
    }
    discover(root);
  };
  const discover = root => {
    if (root.shadowRoot) scan(root.shadowRoot);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: node => node.matches('.lab-scene-snapshot, .lab-header-snapshot') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    while (walker.nextNode()) if (walker.currentNode.shadowRoot) scan(walker.currentNode.shadowRoot);
  };
  enabled.onchange = apply;
  async function refreshStyles() {
    if (chromeTransaction) return;
    await Promise.all(tags.map(async name => {
      const response = await fetch(`/overrides/${name}.css`, { cache: 'no-store' });
      if (response.ok) overrides.set(name, await response.text());
    }));
    if (!roots.has(document)) scan(document);
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
  addEventListener('resize', () => { if (!dashboard) panel.narrow = matchMedia('(max-width: 870px)').matches; });
} catch (error) {
  const loading = document.querySelector('#loading');
  if (loading) loading.textContent = `Не удалось запустить стенд: ${error.message}`;
  notify(`Стенд не запущен: ${error.message}`); console.error(error);
}

// #1165 visual prototype. Existing dialog owner/presence and outer settings
// transaction remain authoritative; the added per-space draft is lab-only.
function installProfile1165(card, html, nothing) {
  const singleSpacePreview = new URLSearchParams(location.search).get('profilePreview') === 'single';
  const install = runtime => {
    const editor = runtime?.externalScreens;
    if (!editor || editor.lab1165) return;
    editor.lab1165 = true;
    const originalOpen = editor.open.bind(editor), originalSave = editor.save.bind(editor);
    const spaces = () => {
      const available = card._serverCfg?.spaces ?? [];
      return singleSpacePreview ? available.slice(0, 1) : available;
    };
    const defaults = row => ({ rotation: row.rotation ?? 0, zoom: 100, summary: row.summary ?? 'local',
      center_summary: false, icon_scale: row.icon_scale ?? null, font_scale: row.font_scale ?? null });
    editor.open = row => {
      originalOpen(row);
      if (!editor.draft) return;
      const d = editor.draft;
      d.row = { ...d.row, hidden_devices: 'local', lab_space_views: structuredClone(d.row.lab_space_views || {}) };
      for (const space of spaces()) d.row.lab_space_views[space.id] ||= defaults(d.row);
      if (spaces().length === 1) { d.row.space = spaces()[0].id; d.row.cycle = 0; }
      editor.labSpace = d.row.space || spaces()[0]?.id;
      card.requestUpdate();
    };
    const validZoom = value => value !== '' && Number.isFinite(Number(value)) && Number(value) >= 10 && Number(value) <= 1000;
    editor.save = instance => {
      const row = editor.draft?.row;
      if (!row || Object.values(row.lab_space_views || {}).some(view => !validZoom(view.zoom))) return;
      const views = Object.fromEntries(Object.entries(row.lab_space_views || {}).map(([id,view]) => [id,{ ...view, zoom:Number(view.zoom) }]));
      const selected = views[row.space || spaces()[0]?.id];
      editor.change({ lab_space_views: views, hidden_devices: 'local', controls: false,
        ...(selected ? { rotation:selected.rotation, summary:selected.summary, icon_scale:selected.icon_scale, font_scale:selected.font_scale } : {}) }, instance);
      originalSave(instance);
    };
    editor.renderDraft = () => {
      const d = editor.draft;
      if (!d || !editor.current(d)) return nothing;
      const row = d.row, list = spaces(), multiple = list.length > 1;
      const id = row.space || (list.some(s => s.id === editor.labSpace) ? editor.labSpace : list[0]?.id);
      const space = list.find(s => s.id === id), view = row.lab_space_views?.[id] || defaults(row);
      const change = patch => editor.change(patch, d.instance);
      const changeView = patch => change({ lab_space_views: { ...row.lab_space_views, [id]: { ...view, ...patch } } });
      const help = (label,text) => html`<hp-help instant .text=${text} .ariaLabel=${label}></hp-help>`;
      const field = (key,label,control,hint='',tip='') => html`<div class="hpf-field">
        <span class="hpf-label hpf-labelrow"><label for=${`profile-${key}`}>${label}</label>${tip ? help(label,tip) : nothing}</span>
        ${control}${hint ? html`<p class="hpf-hint">${hint}</p>` : nothing}</div>`;
      const select = (key,label,value,options,onChange,{disabled=false,hint='',tip=''}={}) => field(key,label,
        html`<hp-settings-select><select id=${`profile-${key}`} class="hpf-select" aria-label=${label} ?disabled=${disabled}
          @change=${e => onChange(e.target.value)}>${options.map(([v,text]) => html`<option value=${v} ?selected=${String(v) === String(value ?? '')}>${text}</option>`)}</select></hp-settings-select>`,hint,tip);
      const time = n => !n ? 'Выключено' : n < 60 ? `${n} с` : `${n/60} мин`;
      const timeOptions = (values,current) => [...new Set([...values,Number(current)||0])].sort((a,b)=>a-b).map(n=>[String(n),time(n)]);
      const sizes = current => {
        const values=[.5,.75,1,1.25,1.5,1.75,2,2.5,3];
        if(current != null && !values.includes(current)) values.push(current);
        return [['','Как на основном плане'],...values.sort((a,b)=>a-b).map(n=>[String(n),`${n*100} %`])];
      };
      const cycling = multiple && row.space === null && row.cycle > 0;
      const idleField = select('idle','Возврат к размеру по умолчанию',row.idle,timeOptions([0,30,60,120,300,600],row.idle),v=>change({idle:Number(v)}),{
        disabled:cycling, hint:cycling ? 'Доступен при выключенном автолистании.' : 'После простоя возвращает масштаб и центр текущего пространства.',
        tip:'Ручное перемещение и масштабирование временные. После указанного времени без действий восстановится вид по умолчанию текущего пространства.' });
      const zoomValid=validZoom(view.zoom);
      const zoomField=field('zoom','Масштаб по умолчанию',html`<div class="lab-profile-zoom">
        <span class="hpf-unit hpf-unit-wide"><input id="profile-zoom" type="number" inputmode="decimal" min="10" max="1000" step="1"
          .value=${String(view.zoom)} aria-label="Масштаб по умолчанию" aria-invalid=${String(!zoomValid)} @input=${e=>changeView({zoom:e.target.value})}><span>%</span></span>
        <button type="button" class="btn ghost" data-hp-tooltip="Сбросить масштаб и центр этого пространства" @click=${()=>changeView({zoom:100})}>Сбросить</button>
        </div>${!zoomValid ? html`<p class="hpf-error" role="alert">Введите значение от 10 до 1000 %.</p>` : nothing}`,
        '100 % — вписать всё в доступную область.', 'При включённом учёте сводной панели используется свободная область рядом с ней. Сброс возвращает 100 % и центр по выбранному правилу; остальные настройки не меняются.');
      const perSpace=html`<div class="hpf-grid hp-screen-fields">
        ${select('rotation','Поворот плана',view.rotation,[0,90,180,270].map(n=>[String(n),`${n}°`]),v=>changeView({rotation:Number(v)}))}
        ${zoomField}
        ${select('summary','Сводная панель',view.summary,[['local','Как на основном плане'],['show','Показывать'],['hide','Скрывать']],v=>changeView({summary:v}))}
        ${field('center','Центрирование',html`<label class="hpf-check hpf-check-wrap lab-profile-center">
          <input id="profile-center" type="checkbox" .checked=${!!view.center_summary} ?disabled=${view.summary==='hide'}
            aria-label="Учитывать сводную панель при центрировании плана" @change=${e=>changeView({center_summary:e.target.checked})}>
          <span>Учитывать сводную панель при центрировании плана</span></label>`,
          '')}
        ${select('icon-scale','Размер значков',view.icon_scale,sizes(view.icon_scale),v=>changeView({icon_scale:v===''?null:Number(v)}))}
        ${select('font-scale','Размер текста',view.font_scale,sizes(view.font_scale),v=>changeView({font_scale:v===''?null:Number(v)}),{
          tip:'Изменяет размер названий помещений и показателей под ними на плане, например температуры и влажности. Не изменяет размер текста сводной панели, меню и диалогов.'})}
      </div>`;
      const invalid=Object.values(row.lab_space_views || {}).some(v=>!validZoom(v.zoom));
      return html`<hp-dialog class="ui-dialog" .hass=${card.hass} data-kind="external-screen-constructor" form-shell settings-layout compact wide lang="ru"
        .title=${editor.rows()?.screens.some(s=>s.id===row.id) ? `Экран ${row.id}` : 'Новый экран'}
        .subtitle=${multiple ? 'Общие параметры профиля и отдельный вид для каждого пространства' : 'Вид по умолчанию для внешнего экрана'} icon="mdi:monitor"
        @hp-close=${e=>{e.stopPropagation();editor.cancel(d.instance);}}>
        <div class="body hpf-form hpf-settings-form hp-screen-constructor lab-profile1165">
          ${multiple ? html`<div class="hpf-sections">
            <section class="hpf-section"><h3 class="lab-profile-heading">Общие настройки профиля</h3>
              <div class="hpf-grid hp-screen-fields lab-profile-general">${select('space','Пространства на экране',row.space,[['','Все пространства'],...list.map(s=>[s.id,s.title||s.id])],v=>{editor.labSpace=v||editor.labSpace;change({space:v||null});})}
                ${select('cycle','Автолистание',row.cycle,timeOptions([0,10,30,60,120,300,600],row.cycle),v=>change({cycle:Number(v)}),{disabled:row.space!==null,hint:row.space!==null?'Доступно для всех пространств.':''})}
                ${idleField}
              </div>
            </section>
            <section class="hpf-section"><div class="lab-profile-space-heading"><h3 class="lab-profile-heading">${row.space===null ? 'Настройки пространства' : `Настройки: ${space?.title||'Пространство недоступно'}`}</h3>
              ${row.space===null ? select('editing','Редактируемое пространство',id,list.map(s=>[s.id,s.title||s.id]),v=>{editor.labSpace=v;card.requestUpdate();}) : nothing}</div>
              <p class="hpf-hint lab-profile-space-hint">${space?.title||'Пространство'}: изменения относятся только к этому пространству.</p>
              ${perSpace}
            </section>
          </div>` : html`${perSpace}<div class="lab-profile-single-return">${idleField}</div>`}
          <p class="hpf-note hpf-callout hpf-hint hp-screen-note">Нажмите «ОК», чтобы добавить изменения в список. Затем сохраните общие настройки.</p>
        </div>
        <div slot="footer" class="row dialog-action-footer hpf-footer"><span class="spacer"></span><div class="dialog-action-group dialog-action-commit">
          <button type="button" class="btn ghost" data-hp="dialog-cancel" @click=${()=>editor.cancel(d.instance)}>Отмена</button>
          <button type="button" class="btn on" data-hp="external-screen-ok" ?disabled=${invalid||!space} @click=${()=>editor.save(d.instance)}>ОК</button>
        </div></div>
      </hp-dialog>`;
    };
  };
  let runtime = card._editorRuntime;
  Object.defineProperty(card,'_editorRuntime',{configurable:true,get:()=>runtime,set:value=>{runtime=value;install(value);}});
  install(runtime);
}
