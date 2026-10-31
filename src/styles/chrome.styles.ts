/** Editor chrome: toolbars, tabs, menus and hints (#266, split from styles.ts). */
import { css, unsafeCSS, type CSSResultGroup } from 'lit';
import { helpSurfaceStyle, helpSurfaceMetaStyle } from './help-surface.styles';

const chromeCoreStyles = unsafeCSS(css`
    .hdr {
      /* #993: the editor buttons fold to icons by the header's own width — in
         the panel that is Home Assistant minus its sidebar — not the window. */
      container: hp-head / inline-size;
      position: sticky;
      top: var(--header-height, 56px);
      z-index: 20;
    }
    /* Keep the header and its menu above the sibling editor toolbar after
       animation opacity stops creating a toolbar stacking context. The menu
       remains anchored by its positioned .header-menu-wrap. */
    .hdr > .head { box-sizing: border-box; position: relative; z-index: 3; }
    .tabs { display:flex; flex-wrap:wrap; }
    .tabs.compact-spaces { min-width:0; max-width:350px; align-items:center; flex-wrap:nowrap; }
    .compact-space-select { flex:1 1 180px; width:180px; min-width:0; max-width:254px; }
    .compact-spaces > .tab { flex:none; }
    .tab .tabtitle { pointer-events:none; }
    /* docs/CANVAS.md §4.1: objects an order of magnitude away from the plan
       do not decide the opening view — one quiet chip says so and offers to
       take them in. Never a modal (owner). */
    .farhint {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: var(--sp-4);
      z-index: 12;
      max-width: calc(100% - 2 * var(--sp-4));
    }
    .farhint .btn { flex: none; }
    .dropbtn {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      width: 100%;
      text-align: left;
      border: 1px solid var(--hp-muted);
      border-radius: var(--rad-m);
      background: transparent;
      color: var(--hp-txt);
      padding: var(--sp-4) 10px;
      cursor: pointer;
      font-family: inherit;
      font-size: var(--fs-m);
      margin-top: var(--sp-3);
    }
    .dropbtn .ref { color: var(--hp-muted); font-size: var(--fs-s); margin-left: auto; }
    .dropbtn ha-icon { --mdc-icon-size: 18px; margin-left: var(--sp-2); }
    .dropbtn.open { border-color: var(--hp-accent); }
    .droppanel {
      border: 1px solid var(--hp-accent);
      border-top: none;
      border-radius: 0 0 var(--rad-m) var(--rad-m);
      padding: var(--sp-3);
      margin-top: -4px;
    }
    .hdr.kioskhide { display: none; }
    .header-menu-wrap { display: none; position: relative; flex: none; }
    .head > .spacer { flex: 0 0 30px; }
    .head > .header-actions { display: inline-flex; align-items: center; flex: 0 0 auto; flex-wrap: nowrap; gap: 10px; max-width: 100%; }
    .head > .header-actions > * { flex-shrink: 0; }
    @media (max-width: 620px) and (min-width: 481px) {
      .head > .spacer { flex-basis: 28.5px; }
    }
    @media (max-width: 480px) {
      .hdr > .head { flex-wrap: nowrap; padding: 5px 8px; gap: 6px; }
      .compact-space-select { min-width: 44px; }
      .head > .title, .head > .spacer, .head > .header-action,
      .head > .summary-control, .header-actions > .header-action, .header-actions > .summary-control { display: none; }
      .head > .header-actions { gap: 6px; }
      .head > .modes {
        flex: 0 0 24px;
        width: 24px;
        padding: 0;
        gap: 0;
        background: transparent;
      }
      .head > .modes .modetab { display: none; }
      .head > .tabs {
        flex: 1 1 auto;
        min-width: 0;
        flex-wrap: nowrap;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        scrollbar-width: none;
      }
      .head > .tabs::-webkit-scrollbar { display: none; }
      .head > .tabs .tab { flex: none; white-space: nowrap; max-width: 100%; }
      .head > .tabs .tabtitle { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      .head > .tabs .tabedit, .head > .tabs .tabadd { display: none; }
      .head > .tabs.compact-spaces { overflow:visible; }
      .head > .zoomctl, .head > .modes > .editor-close-slot { flex: none; }
      .header-menu-wrap { display: inline-flex; }
    }
    @media (max-width: 360px) {
      .hdr > .head { padding-inline: 2px; gap: 2px; }
      .head > .header-actions { gap: 2px; }
    }
    @media (width < 360px) {
      ha-card[data-hp-mode='view'] > .hdr > .head { padding-inline: 0; gap: 0; }
      ha-card[data-hp-mode='view'] .head > .modes { display: none; }
      /* Seven 44px targets, six common 1px strokes: 302px inside a native HA
         card with 8px outer gutters at 320px. Only stroke borders coincide. */
      ha-card[data-hp-mode='view'] .head > .header-actions { gap: 0; margin-inline-start: -1px; }
      ha-card[data-hp-mode='view'] .header-actions > .header-menu-wrap { margin-inline-start: -1px; }
      ha-card:not([data-hp-mode='view']) > .hdr > .head {
        display: grid;
        grid-template-columns: minmax(44px, 1fr) 24px;
      }
      ha-card:not([data-hp-mode='view']) .head > .header-actions { grid-column: 1 / -1; justify-self: end; }
    }
    .decorbar .bdhint {
      font-size: var(--fs-s);
      color: var(--hp-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .decorbar .dfill {
      display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-s); cursor: pointer;
    }
    .decorbar .dfill input[type="checkbox"] {
      width: 16px;
      height: 16px;
      flex: none;
      margin: 0;
      padding: 0;
    }
    .decorbar hp-color-opacity { flex: 0 0 auto; }
    /* issue #220: a tab can be dragged to a new position in the editors */
    .tab[data-reorderable] { cursor: grab; }
    .tab.dragging { cursor: grabbing; opacity: 0.55; }
    .tab.drop-before { box-shadow: inset 2px 0 0 0 var(--primary-color, #03a9f4); }
    .tab.drop-after { box-shadow: inset -2px 0 0 0 var(--primary-color, #03a9f4); }
    .editbar .barclose {
      box-sizing: border-box;
      width: 40px;
      height: 40px;
      padding: 0;
      margin: 0;
      min-width: 40px;
      min-height: 40px;
      justify-content: center;
      gap: 0;
      line-height: 0;
    }
    .editbar .barclose ha-icon { flex: none; margin: 0; }
    /* #993: ≤ 1024 px of header — icon only; the label stays in aria-label and
       the tooltip. The ≤ 480 px window rules above (#616) are unchanged. */
    @container hp-head (max-width: 1024px) {
      .modetab .ml { display: none; }
    }
    .editbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: stretch;
      border-bottom: 1px solid var(--hp-line);
      font-size: var(--fs-m);
    }
    .editbar-tools {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: var(--sp-4) var(--sp-5);
      flex-wrap: wrap;
      min-width: 0;
      outline: none;
    }
    .editbar-end {
      display: flex;
      align-items: center;
      padding: var(--sp-4) var(--sp-5);
      border-inline-start: 1px solid var(--hp-line);
      background: var(--card-background-color, var(--hp-bg));
      position: relative;
      z-index: 2;
    }
    .rhint {
      font-size: var(--fs-s);
      color: var(--hp-muted);
      margin-bottom: var(--sp-3);
    }
    /* Keep the last editor bar mounted while the row collapses. This makes
       both entering and leaving an editor change the card geometry gradually;
       the header ResizeObserver keeps the stage fitted throughout. */
    .editorchrome {
      display: block;
      height: 0;
      opacity: 0;
      visibility: hidden;
      overflow: hidden;
    }
    .editorchrome:not(.open) {
      pointer-events: none;
    }
    .editorchrome.open {
      height: auto;
      opacity: 1;
      visibility: visible;
      overflow: visible;
    }
    .editorchrome.transitioning {
      overflow: hidden;
      will-change: height;
      pointer-events: none;
    }
    /* The toolbar is already visible while its height is interpolating. Its
       explicit navigation control must remain usable even though all editing
       tools stay frozen until the transition settles. */
    .editorchrome.transitioning .barclose {
      pointer-events: auto;
    }
    .editorchrome-inner {
      min-height: 0;
      transform-origin: top center;
    }
    .editorchrome.transitioning .editorchrome-inner {
      will-change: opacity;
    }
    .editbar .warn {
      color: #ffc14d;
    }
    .editbar input {
      width: 74px;
      background: transparent;
      border: 1px solid var(--hp-line);
      color: var(--hp-txt);
      border-radius: var(--rad-s);
      padding: var(--sp-3) var(--sp-4);
      font-size: var(--fs-m);
    }
    .editbar label,
    .editbar .hint {
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    .editbar .drawwall {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      white-space: nowrap;
    }
    .editbar .wallsgroup {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      white-space: nowrap;
    }
    .editbar .drawwall input {
      width: 4.2em;
    }
    .editbar .drawwall .opl {
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    .tip {
      position: fixed;
      pointer-events: none;
      z-index: 60;
    }
    .view-runtime-notice {
      position: absolute;
      inset-inline: 8px;
      bottom: 8px;
      z-index: 65;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      max-height: min(50%, 220px);
      overflow: auto;
    }
    .view-runtime-notice > span { flex: 1 1 200px; }
    .view-runtime-notice > div { display: flex; flex-wrap: wrap; gap: 8px; }
    .view-runtime-functions { display: block; }
`.cssText + `.tip[data-hp-live-tip]{${helpSurfaceStyle}}.tip .m{${helpSurfaceMetaStyle}}`);

/** #437 summary CSS lives with its lazy runtime in summary-panel-style.ts. */
export const chromeStyles: CSSResultGroup = chromeCoreStyles;
