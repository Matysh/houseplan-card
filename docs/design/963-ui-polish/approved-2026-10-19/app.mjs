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
  document.querySelector('#lab-provenance').textContent = `House Plan ${provenance.productVersion}\n${provenance.productCommit.slice(0, 12)}\nHA Frontend ${provenance.frontendVersion}\nСнимок: ${mock.capturedAt || 'демо'}\nНикакого подключения к твоему HA`;
  const tools = document.querySelector('#lab-tools');
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
  const scan = (root, name = '') => {
    if (roots.has(root)) return;
    const entry = { name, style: null, observer: null };
    roots.set(root, entry);
    const descend = node => { if (node.nodeType !== Node.ELEMENT_NODE) return; if (node.shadowRoot) scan(node.shadowRoot, node.localName); for (const child of node.querySelectorAll('*')) if (child.shadowRoot) scan(child.shadowRoot, child.localName); };
    for (const child of root.querySelectorAll('*')) if (child.shadowRoot) scan(child.shadowRoot, child.localName);
    const observer = new MutationObserver(list => { for (const entry of list) for (const node of entry.addedNodes) descend(node); });
    observer.observe(root, { childList: true, subtree: true }); entry.observer = observer;
  };
  const tags = ['houseplan-card', 'houseplan-panel', 'hp-dialog', 'ha-dialog'];
  const enabled = document.querySelector('#lab-styles');
  // Local prototype: the header's right-hand actions wrap as one unit.
  const syncHeaderActions = () => {
    const head = card.shadowRoot.querySelector('ha-card > .hdr > .head');
    if (!head) return;
    const existing = head.querySelector(':scope > .lab-header-actions');
    if (!enabled.checked) { if (existing) existing.replaceWith(...existing.childNodes); return; }
    if (existing) return;
    const zoom = head.querySelector(':scope > .zoomctl');
    if (!zoom) return;
    const group = document.createElement('div'); group.className = 'lab-header-actions';
    head.insertBefore(group, zoom);
    for (let node = zoom; node;) {
      const next = node.nextSibling; group.append(node); node = next;
    }
  };
  // Local prototype: reuse the Opening dropdown for room and shape tools.
  let toolbarPrototype = Object.getPrototypeOf(card), toolbarGroupsGetter;
  while (toolbarPrototype && !toolbarGroupsGetter) {
    toolbarGroupsGetter = Object.getOwnPropertyDescriptor(toolbarPrototype, '_editorToolbarGroups')?.get;
    toolbarPrototype = Object.getPrototypeOf(toolbarPrototype);
  }
  if (toolbarGroupsGetter) Object.defineProperty(card, '_editorToolbarGroups', {
    configurable: true,
    get() {
      const groups = toolbarGroupsGetter.call(this);
      if (!enabled.checked) return groups;
      const language = this.hass.language?.split('-')[0] || 'ru';
      if (this._mode === 'decor') {
        const shapesLabel = { ru: 'Фигуры', en: 'Shapes', de: 'Formen', fr: 'Formes' }[language] || 'Shapes';
        return [{ id: 'shapes', label: shapesLabel, icon: 'mdi:shape-outline',
          activeItemId: ['line', 'rect', 'ellipse'].includes(this._decorTool) ? this._decorTool : undefined,
          items: [
            { id: 'line', label: this._t('decor.line'), icon: 'mdi:vector-line' },
            { id: 'rect', label: this._t('decor.rect'), icon: 'mdi:rectangle-outline' },
            { id: 'ellipse', label: this._t('decor.ellipse'), icon: 'mdi:ellipse-outline' },
          ].map(item => ({ ...item, role: 'tool', invoke: () => this.shadowRoot.querySelector(`.decorbar button.dtool[data-tool="${item.id}"]`)?.click() })),
        }, ...groups];
      }
      if (this._mode !== 'plan') return groups;
      const roomsLabel = { ru: 'Комнаты', en: 'Rooms', de: 'Räume', fr: 'Pièces' }[language] || 'Rooms';
      const resizeLabel = { ru: 'Изменить размер', en: 'Resize', de: 'Größe ändern', fr: 'Redimensionner' }[language] || 'Resize';
      return [{ id: 'rooms', label: roomsLabel, icon: 'mdi:floor-plan',
        activeItemId: ['merge', 'split', 'resize', 'delroom'].includes(this._tool) ? this._tool : undefined,
        items: [
          { id: 'merge', label: this._t('markup.merge'), icon: 'mdi:vector-union' },
          { id: 'split', label: this._t('markup.split'), icon: 'mdi:vector-polyline-remove' },
          { id: 'resize', label: resizeLabel, icon: 'mdi:arrow-expand-all' },
          { id: 'delroom', label: this._t('btn.delete'), icon: 'mdi:delete-outline' },
        ].map(item => ({ ...item, role: 'tool', invoke: () => this._editorRuntime._activateMarkupTool(item.id) })),
      }, ...groups];
    },
  });
  // Canvas, editor tools and every right-hand header action share one tooltip surface.
  const editorTooltipScope = '.stage.mode-plan, .editorchrome.open, .editor-secondary-host.open, .hdr .lab-header-actions';
  const nativePlanTips = new Map();
  const duplicateToolbarTip = (owner, text) => {
    if (!owner.matches('button') || !owner.closest('.editorchrome, .editor-secondary')) return false;
    const normalize = value => value.replace(/\s+/g, ' ').trim();
    const label = normalize(owner.textContent);
    return !!label && label === normalize(text || '');
  };
  const planTip = document.createElement('div');
  planTip.className = 'lab-editor-tooltip'; planTip.setAttribute('role', 'tooltip');
  planTip.setAttribute('popover', 'manual'); card.shadowRoot.append(planTip);
  let planTipOwner = null, planTipOpenTimer = 0, planTipCloseTimer = 0, planTipPoint = { x: 0, y: 0 };
  const hidePlanTip = () => {
    clearTimeout(planTipOpenTimer); clearTimeout(planTipCloseTimer); planTipOwner = null;
    planTip.classList.remove('is-visible');
    planTipCloseTimer = setTimeout(() => { if (planTip.matches(':popover-open')) planTip.hidePopover(); }, 120);
  };
  const positionPlanTip = () => {
    const box = planTip.getBoundingClientRect();
    const x = Math.max(8, Math.min(planTipPoint.x + 14, innerWidth - box.width - 8));
    const y = planTipPoint.y + 18 + box.height <= innerHeight - 8
      ? planTipPoint.y + 18 : Math.max(8, planTipPoint.y - box.height - 12);
    planTip.style.left = `${x}px`; planTip.style.top = `${y}px`;
  };
  const showPlanTip = (owner, event) => {
    if (!enabled.checked || owner === planTipOwner || duplicateToolbarTip(owner, owner.dataset.labEditorTooltip)) return;
    hidePlanTip(); planTipOwner = owner;
    const rect = owner.getBoundingClientRect();
    planTipPoint = event.type === 'focusin' ? { x: rect.left, y: rect.bottom } : { x: event.clientX, y: event.clientY };
    planTipOpenTimer = setTimeout(() => {
      if (planTipOwner !== owner || !owner.isConnected) return;
      clearTimeout(planTipCloseTimer);
      planTip.textContent = owner.dataset.labEditorTooltip;
      if (!planTip.matches(':popover-open')) planTip.showPopover();
      positionPlanTip();
      requestAnimationFrame(() => { if (planTipOwner === owner) planTip.classList.add('is-visible'); });
    }, 300);
  };
  const tipOwner = event => event.composedPath().find(node => node instanceof Element && node.hasAttribute('data-lab-editor-tooltip'));
  card.shadowRoot.addEventListener('pointerover', event => {
    if (event.pointerType !== 'mouse') return;
    const owner = tipOwner(event); if (owner) showPlanTip(owner, event);
  }, true);
  card.shadowRoot.addEventListener('pointerout', event => {
    if (planTipOwner && !(event.relatedTarget instanceof Node && planTipOwner.contains(event.relatedTarget))) hidePlanTip();
  }, true);
  card.shadowRoot.addEventListener('pointermove', event => {
    if (planTipOwner) planTipPoint = { x: event.clientX, y: event.clientY };
  }, true);
  card.shadowRoot.addEventListener('focusin', event => { const owner = tipOwner(event); if (owner) showPlanTip(owner, event); }, true);
  card.shadowRoot.addEventListener('focusout', hidePlanTip, true);
  card.shadowRoot.addEventListener('pointerdown', hidePlanTip, true);
  card.shadowRoot.addEventListener('wheel', hidePlanTip, { capture: true, passive: true });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hidePlanTip(); }, true);
  addEventListener('resize', hidePlanTip);
  const syncPlanTooltips = () => {
    for (const [source, saved] of nativePlanTips) {
      if (enabled.checked && source.isConnected && saved.owner.closest(editorTooltipScope)) {
        if (duplicateToolbarTip(saved.owner, saved.text)) {
          saved.owner.removeAttribute('data-lab-editor-tooltip');
          if (planTipOwner === saved.owner) hidePlanTip();
        } else saved.owner.dataset.labEditorTooltip = saved.text;
        continue;
      }
      if (source.localName === 'title') {
        for (const [node, text] of saved.nodes) if (node.parentNode === source && !node.data) node.data = text;
      } else if (!source.hasAttribute('title')) source.setAttribute('title', saved.text);
      saved.owner.removeAttribute('data-lab-editor-tooltip');
      if (saved.ownsLabel && saved.owner.getAttribute('aria-label') === saved.text) saved.owner.removeAttribute('aria-label');
      nativePlanTips.delete(source);
    }
    if (!enabled.checked) { hidePlanTip(); return; }
    for (const source of card.shadowRoot.querySelectorAll('.stage.mode-plan [title], .stage.mode-plan svg title, .editorchrome.open [title], .editorchrome.open svg title, .editor-secondary-host.open [title], .editor-secondary-host.open svg title, .hdr .lab-header-actions [title], .hdr .lab-header-actions svg title')) {
      const svg = source.localName === 'title';
      const text = (svg ? source.textContent : source.getAttribute('title'))?.trim();
      if (!text) continue;
      const owner = svg ? source.parentElement : source;
      const previous = nativePlanTips.get(source);
      const saved = { owner, text, nodes: [], ownsLabel: previous?.ownsLabel ?? (!owner.hasAttribute('aria-label') && (svg || !owner.textContent.trim())) };
      if (svg) {
        for (const node of source.childNodes) if (node.nodeType === Node.TEXT_NODE) { saved.nodes.push([node, node.data]); node.data = ''; }
      } else source.removeAttribute('title');
      if (duplicateToolbarTip(owner, text)) owner.removeAttribute('data-lab-editor-tooltip');
      else owner.dataset.labEditorTooltip = text;
      if (saved.ownsLabel) owner.setAttribute('aria-label', text);
      nativePlanTips.set(source, saved);
    }
    if (planTipOwner && (!planTipOwner.isConnected || !planTipOwner.closest(editorTooltipScope))) hidePlanTip();
  };
  // Local prototype: mirror the Device editor's icon-only history cluster.
  const syncHistoryButtons = () => {
    for (const toolbar of card.shadowRoot.querySelectorAll('.planbar, .decorbar')) {
      const end = toolbar.querySelector('.editbar-end'), close = end?.querySelector('[data-hp="editor-close"]');
      if (!close) continue;
      if (!enabled.checked) {
        for (const button of end.querySelectorAll('[data-lab-history]')) button.remove();
        for (const button of toolbar.querySelectorAll('[data-lab-history-source]')) button.removeAttribute('data-lab-history-source');
        continue;
      }
      for (const direction of ['undo', 'redo']) {
        const iconName = `mdi:${direction}-variant`;
        const source = [...toolbar.querySelectorAll('.editbar-tools > button')].find(button => button.querySelector(`ha-icon[icon="${iconName}"]`));
        if (!source) continue;
        source.dataset.labHistorySource = direction;
        let button = end.querySelector(`[data-lab-history="${direction}"]`);
        if (!button) {
          button = document.createElement('button'); button.type = 'button';
          button.className = 'btn ghost'; button.dataset.labHistory = direction;
          const icon = document.createElement('ha-icon'); icon.setAttribute('icon', iconName); icon.setAttribute('aria-hidden', 'true');
          button.append(icon); end.insertBefore(button, close);
        }
        const title = source.getAttribute('title') || source.dataset.labEditorTooltip || nativePlanTips.get(source)?.text || source.getAttribute('aria-label') || '';
        if (nativePlanTips.get(button)?.text !== title && button.getAttribute('title') !== title) button.setAttribute('title', title);
        if (button.getAttribute('aria-label') !== title) button.setAttribute('aria-label', title);
        button.disabled = source.disabled;
        button.onclick = () => source.click();
      }
    }
  };
  // Local prototype: use the genuine settings dropdown, keeping the inbox select/change handler.
  const inboxSpaceSelects = new Map();
  const syncInboxSpaceFilter = () => {
    for (const [select, saved] of inboxSpaceSelects) {
      if (!select.isConnected) { inboxSpaceSelects.delete(select); continue; }
      if (enabled.checked) continue;
      saved.wrapper.replaceWith(select);
      for (const [name, value] of saved.attributes) {
        if (value === null) select.removeAttribute(name); else select.setAttribute(name, value);
      }
      inboxSpaceSelects.delete(select);
    }
    if (!enabled.checked || !customElements.get('hp-settings-select')) return;
    for (const select of card.shadowRoot.querySelectorAll('.device-inbox-space-filter > select')) {
      const wrapper = document.createElement('hp-settings-select');
      wrapper.dataset.labInboxSpaceSelect = '';
      wrapper.pointerHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
      inboxSpaceSelects.set(select, { wrapper, attributes: ['tabindex', 'aria-hidden'].map(name => [name, select.getAttribute(name)]) });
      select.before(wrapper); wrapper.append(select);
    }
  };
  // Local prototype: windows share the door's meaningful opening-side control.
  const windowControlEditors = new WeakSet();
  const installWindowControls = () => {
    const editor = card._editorRuntime?.properties;
    if (!editor || windowControlEditors.has(editor) || typeof editor.model !== 'function') return;
    windowControlEditors.add(editor);
    const originalModel = editor.model;
    editor.model = function(identity = this.identity) {
      const model = originalModel.call(this, identity);
      if (!enabled.checked) return model;
      const group = model.groups.find(group => group.fields.some(field => field.label === 'across_wall'));
      if (group) {
        const sides = this.openingSides(this.target(identity)).labels;
        group.fields = group.fields.filter(field => field.key !== 'flip_h').map(field => field.key === 'flip_v'
          ? { ...field, label: 'opening_side', control: 'choices', wide: true,
            options: sides.map((label, index) => ({ value: String(!!index), label })) }
          : field);
      }
      return model;
    };
    card.requestUpdate();
  };
  // Local prototype: animate intrinsic section height, not a fixed maximum.
  const sectionHeights = new Map(), sectionChildren = new Set();
  let sectionFrame = 0;
  const queueSectionHeights = () => {
    if (sectionFrame) return;
    sectionFrame = requestAnimationFrame(() => {
      sectionFrame = 0;
      for (const child of sectionChildren) if (!child.isConnected) { sectionResize.unobserve(child); sectionChildren.delete(child); }
      for (const [group, state] of sectionHeights) if (!group.isConnected || !enabled.checked) { state.animation?.cancel(); sectionHeights.delete(group); }
      if (!enabled.checked) return;
      for (const group of card.shadowRoot.querySelectorAll('.hp-properties .hp-prop-group')) {
        if (!group.getClientRects().length) { sectionHeights.get(group)?.animation?.cancel(); sectionHeights.delete(group); continue; }
        const style = getComputedStyle(group), px = value => parseFloat(value) || 0;
        let height = px(style.paddingTop) + px(style.paddingBottom) + px(style.borderTopWidth) + px(style.borderBottomWidth), count = 0;
        for (const child of group.children) {
          if (!sectionChildren.has(child)) { sectionChildren.add(child); sectionResize.observe(child); }
          const childStyle = getComputedStyle(child);
          if (childStyle.display === 'none') continue;
          height += child.getBoundingClientRect().height + px(childStyle.marginTop) + px(childStyle.marginBottom); count++;
        }
        height += Math.max(0, count - 1) * px(style.rowGap);
        const state = sectionHeights.get(group);
        if (state && Math.abs(state.height - height) < 0.5) continue;
        const from = state?.animation?.playState === 'running' ? group.getBoundingClientRect().height : state?.height;
        state?.animation?.cancel();
        const next = { height, animation: null }; sectionHeights.set(group, next);
        if (from === undefined || matchMedia('(prefers-reduced-motion: reduce)').matches) continue;
        next.animation = group.animate([{ height: `${from}px`, overflow: 'clip' }, { height: `${height}px`, overflow: 'clip' }], { duration: 240, easing: 'ease-in-out' });
        next.animation.onfinish = () => { next.animation = null; };
      }
    });
  };
  const sectionResize = new ResizeObserver(queueSectionHeights);
  // Local prototype: square columns reuse the stair rotation handle's visual/hit split.
  const columnRotateControls = new Map();
  const syncColumnRotateControls = () => {
    for (const [handle, state] of columnRotateControls) {
      if (enabled.checked && handle.isConnected) continue;
      state.observer.disconnect(); state.knob.remove(); handle.style.removeProperty('r');
      columnRotateControls.delete(handle);
    }
    if (!enabled.checked) return;
    for (const handle of card.shadowRoot.querySelectorAll('.physical-chrome[data-kind="square-selection"] .rotate-handle')) {
      let state = columnRotateControls.get(handle);
      if (!state) {
        const knob = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        knob.setAttribute('class', 'lab-column-rotate-knob'); knob.setAttribute('aria-hidden', 'true');
        const update = () => {
          const view = card._viewOr(card._baseVb()), radius = Math.max(view.w, view.h) * 0.018;
          handle.style.r = `${radius}px`;
          for (const axis of ['cx', 'cy']) knob.setAttribute(axis, handle.getAttribute(axis));
          knob.setAttribute('r', (radius / 4).toFixed(2));
        };
        const observer = new MutationObserver(update);
        observer.observe(handle, { attributes: true, attributeFilter: ['cx', 'cy', 'r'] });
        state = { knob, observer, update }; columnRotateControls.set(handle, state);
        handle.after(knob);
      }
      state.update();
    }
  };
  // Local prototype: editor sidebar sections are always open.
  let openingSidebarGroup = false;
  const sidebarTitle = event => event.composedPath().find(node => node instanceof Element && node.matches('.hp-properties .hp-prop-group-title'));
  card.shadowRoot.addEventListener('click', event => {
    if (enabled.checked && !openingSidebarGroup && sidebarTitle(event)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  const syncSidebarGroups = () => {
    syncHeaderActions();
    syncInboxSpaceFilter();
    syncHistoryButtons();
    syncPlanTooltips();
    syncColumnRotateControls();
    installWindowControls();
    queueSectionHeights();
    const positionGroup = card.shadowRoot.querySelector('.hp-properties .hp-prop-group.position');
    const contextGroup = card.shadowRoot.querySelector('.hp-properties .hp-prop-group.features');
    const contextText = contextGroup?.querySelector(':scope > .hp-prop-hint')?.textContent.trim() || '';
    const sharedPoints = enabled.checked && !!positionGroup && /^(Точки общие с соседними стенами\.|The points are shared with adjoining walls\.)/.test(contextText);
    contextGroup?.toggleAttribute('data-lab-shared-points-context', sharedPoints);
    positionGroup?.toggleAttribute('data-lab-shared-points-position', sharedPoints);
    let pointsNote = positionGroup?.querySelector('[data-lab-shared-points-note]');
    if (sharedPoints && !pointsNote) {
      pointsNote = document.createElement('p');
      pointsNote.className = 'hp-prop-hint'; pointsNote.dataset.labSharedPointsNote = '';
      pointsNote.textContent = contextText.startsWith('Точки')
        ? 'Точки A и B — концы выбранной стены. Перемещайте их узлы на плане: соединённые с ними соседние стены изменятся вместе.'
        : 'Points A and B are the ends of this wall. Move their nodes on the plan: adjoining walls connected to them will move too.';
      positionGroup.append(pointsNote);
    } else if (!sharedPoints) pointsNote?.remove();
    for (const title of card.shadowRoot.querySelectorAll('.hp-properties .hp-prop-group-title')) {
      if (enabled.checked) {
        if (title.closest('.hp-prop-group').classList.contains('collapsed')) {
          openingSidebarGroup = true;
          try { title.click(); } finally { openingSidebarGroup = false; }
        }
        title.setAttribute('role', 'heading'); title.setAttribute('aria-level', '3');
        title.tabIndex = -1; title.removeAttribute('aria-expanded');
      } else {
        title.removeAttribute('role'); title.removeAttribute('aria-level'); title.removeAttribute('tabindex');
        title.setAttribute('aria-expanded', String(!title.closest('.hp-prop-group').classList.contains('collapsed')));
      }
    }
  };
  new MutationObserver(syncSidebarGroups).observe(card.shadowRoot, { childList: true, characterData: true, subtree: true });
  const apply = () => {
    for (const [root, entry] of roots) {
      if (!tags.includes(entry.name)) continue;
      const text = enabled.checked ? overrides.get(entry.name) || '' : '';
      if (!entry.style || !root.contains(entry.style)) { entry.style = document.createElement('style'); entry.style.dataset.labOverride = entry.name; root.append(entry.style); }
      if (entry.style.textContent !== text) entry.style.textContent = text;
    }
    syncSidebarGroups();
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
