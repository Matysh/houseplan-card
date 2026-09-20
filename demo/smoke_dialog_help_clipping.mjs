// #600 AC8, дефект №5 («поповер «?» обрезается границей диалога комнаты»),
// ревью r1 M3: свидетель, что подсказка «?» в диалоге комнаты не режется ни
// скроллером диалога, ни поверхностью ha-dialog.
//
// Проверяется исполнением, а не чтением: подсказка открывается у карточки,
// прижатой к нижнему краю короткого окна (диалог скроллится), и каждый угол её
// прямоугольника hit-test'ом (elementsFromPoint сквозь теневые корни) попадает
// в саму подсказку — обрезанная часть элемента не hit-test'ится. Четыре
// комбинации: нативный <dialog> и ветка ha-dialog × Popover API и портальный
// fallback. Ветка ha-dialog берётся заглушкой с теми же ловушками, что у
// настоящей mwc-поверхности: transform на поверхности (ловит position: fixed) и
// overflow: hidden с собственным скроллером содержимого. Настоящий ha-dialog
// (#505) требует загрузки колеса HA-frontend — это отдельная приёмка владельца.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 620 });

const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const upd = async () => { c.requestUpdate(); await c.updateComplete; await frame(); await new Promise((r) => setTimeout(r, 40)); };
  const dlg = () => sr().querySelector('hp-dialog[data-kind="room"]');
  const helpOf = (key) => dlg()?.querySelector(`hp-help[data-help-key="${key}"]`);
  const surfaceOf = (key) => helpOf(key)?.shadowRoot?.querySelector('.tooltip')
    || dlg()?.shadowRoot?.querySelector('[data-hp-overlay="help"]')?.shadowRoot?.querySelector('.tooltip');
  // hit-test сквозь теневые корни: есть ли в точке именно .tooltip
  const tooltipAt = (x, y) => {
    const seen = new Set();
    const visit = (root) => {
      for (const el of root.elementsFromPoint(x, y)) {
        if (seen.has(el)) continue; seen.add(el);
        if (el.classList?.contains('tooltip')) return true;
        if (el.shadowRoot && visit(el.shadowRoot)) return true;
      }
      return false;
    };
    return visit(document);
  };
  const scroller = () => dlg()?.shadowRoot?.querySelector('.content')
    || dlg()?.shadowRoot?.querySelector('ha-dialog')?.shadowRoot?.querySelector('.content');
  const probe = async (label, key) => {
    const help = helpOf(key);
    // прижать «?» к нижнему краю окна — там подсказка обязана уйти вверх, а не под срез
    help.scrollIntoView({ block: 'end' });
    await frame();
    const trigger = help.shadowRoot.querySelector('.trigger');
    trigger.click(); await frame(); await new Promise((r) => setTimeout(r, 60));
    const surface = surfaceOf(key);
    const r = surface?.getBoundingClientRect();
    const inViewport = !!r && r.width > 40 && r.height > 20 && r.left >= 0 && r.top >= 0
      && r.right <= innerWidth && r.bottom <= innerHeight;
    // 12 px от края: у подсказки скруглённые углы (radius 9), точка в 2 px от угла — за скруглением
    const corners = r ? [[r.left + 12, r.top + 12], [r.right - 12, r.top + 12], [r.left + 12, r.bottom - 12], [r.right - 12, r.bottom - 12], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]] : [];
    const hits = corners.map(([x, y]) => tooltipAt(x, y));
    o[`${label}_open`] = trigger.getAttribute('aria-expanded') === 'true' && !!surface;
    o[`${label}_insideViewport`] = inViewport;
    o[`${label}_notClipped`] = hits.length === 5 && hits.every(Boolean);
    // подсказка стоит ВНЕ скроллера содержимого: её низ ниже или верх выше «?» так, что часть
    // прямоугольника лежит за пределами видимой области скроллера — и всё равно hit-test'ится
    const sc = scroller()?.getBoundingClientRect();
    o[`${label}_crossesScrollerEdge`] = !!r && !!sc && (r.top < sc.top || r.bottom > sc.bottom);
    trigger.click(); await frame();
  };
  const openRoom = async () => {
    if (c._roomDialog) { c._roomDialogCancel(); await upd(); }
    c._setMode('plan'); await upd();
    c._openRoomEdit(c._curSpaceCfg.rooms[0]); await upd();
    c._roomFill = 'temp'; await upd();
  };
  const withFallback = async (fn) => {
    const show = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'showPopover');
    const hide = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidePopover');
    Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value: undefined });
    Object.defineProperty(HTMLElement.prototype, 'hidePopover', { configurable: true, value: undefined });
    try { await fn(); } finally {
      if (show) Object.defineProperty(HTMLElement.prototype, 'showPopover', show); else delete HTMLElement.prototype.showPopover;
      if (hide) Object.defineProperty(HTMLElement.prototype, 'hidePopover', hide); else delete HTMLElement.prototype.hidePopover;
    }
  };

  // --- нативный <dialog> ------------------------------------------------------
  await openRoom();
  o.nativeBranch = !!dlg().shadowRoot.querySelector('dialog') && !dlg().shadowRoot.querySelector('ha-dialog');
  o.dialogScrolls = scroller().scrollHeight > scroller().clientHeight + 10;
  await probe('native_popover_sizes', 'room.sizes_section.help');
  await probe('native_popover_fill', 'room.group_fill.help');
  await withFallback(async () => {
    await probe('native_fallback_sizes', 'room.sizes_section.help');
  });
  // доказательство содержательное только если подсказка реально вышла за край скроллера
  o.native_tooltipLeavesScrollerAndStaysVisible = o.native_popover_sizes_crossesScrollerEdge === true
    && o.native_fallback_sizes_crossesScrollerEdge === true;

  // --- ветка ha-dialog: заглушка с ловушками настоящей mwc-поверхности --------
  customElements.define('ha-dialog', class extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' }).innerHTML = `<style>
        :host { position: fixed; inset: 0; z-index: 7; display: flex; align-items: center; justify-content: center; }
        .scrim { position: absolute; inset: 0; background: rgba(0,0,0,.32); }
        .surface { position: relative; display: flex; flex-direction: column; width: min(560px, 94vw); max-height: calc(100vh - 72px);
          overflow: hidden; transform: scale(1); border-radius: 12px; background: var(--card-background-color, #fff); }
        .head { flex: 0 0 auto; padding: 12px 16px; }
        .content { flex: 1 1 auto; min-height: 0; overflow: auto; }
        .foot { flex: 0 0 auto; }
      </style><div class="scrim"></div><div class="surface"><div class="head"><slot name="headerTitle"></slot></div>
        <div class="content"><slot></slot></div><div class="foot"><slot name="footer"></slot></div></div>`;
    }
    connectedCallback() { queueMicrotask(() => this.dispatchEvent(new CustomEvent('opened'))); }
    set open(v) { this._open = v; } get open() { return this._open; }
  });
  c._roomDialogCancel(); await upd();
  await openRoom();
  o.haDialogBranch = !!dlg().shadowRoot.querySelector('ha-dialog') && !dlg().shadowRoot.querySelector('dialog');
  o.haDialogPortalOutsideSurface = (() => {
    const portal = dlg().shadowRoot.querySelector('.overlay-portal');
    return !!portal && !dlg().shadowRoot.querySelector('ha-dialog').contains(portal);
  })();
  o.haDialogScrolls = scroller().scrollHeight > scroller().clientHeight + 10;
  await probe('ha_popover_sizes', 'room.sizes_section.help');
  await withFallback(async () => {
    await probe('ha_fallback_sizes', 'room.sizes_section.help');
    await probe('ha_fallback_fill', 'room.group_fill.help');
  });
  o.ha_tooltipLeavesScrollerAndStaysVisible = o.ha_popover_sizes_crossesScrollerEdge === true
    && o.ha_fallback_sizes_crossesScrollerEdge === true;
  c._roomDialogCancel(); await upd();
  return o;
});

checkAll(Object.fromEntries(Object.entries(out).filter(([k]) => !k.endsWith('_crossesScrollerEdge'))));
await finish(browser, out);
