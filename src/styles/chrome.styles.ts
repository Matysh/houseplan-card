/** Editor chrome: toolbars, tabs, menus and hints (#266, split from styles.ts). */
import { css, unsafeCSS, type CSSResultGroup } from 'lit';
import { readingTextCss } from './reading-kit.styles';
import { helpSurfaceStyle, helpSurfaceMetaStyle } from './help-surface.styles';

const chromeCoreStyles = unsafeCSS(css`
    .hdr {
      /* Both placements measure intrinsic header content in this container. */
      container: hp-head / inline-size;
      position: sticky;
      top: var(--header-height, 56px);
      z-index: 20;
    }
    /* Keep the shared head above the sibling editor toolbar. */
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
    .farhint button { flex:none; }
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
    .decorbar hp-color-opacity { flex: 0 0 auto; }
    /* issue #220: a tab can be dragged to a new position in the editors */
    .tab[data-reorderable] { cursor: grab; }
    .tab.dragging { cursor: grabbing; opacity: 0.55; }
    .tab.drop-before { box-shadow: inset 2px 0 0 0 var(--primary-color, #03a9f4); }
    .tab.drop-after { box-shadow: inset -2px 0 0 0 var(--primary-color, #03a9f4); }
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

    .editbar label,
    .editbar .hint {
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }

    .editbar .wallsgroup {
      display: inline-flex;
      flex-wrap: wrap;
      max-width: 100%;
      align-items: center;
      gap: 10px;
      white-space: nowrap;
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
`.cssText + readingTextCss('.rhint') + `.tip[data-hp-live-tip]{${helpSurfaceStyle}}.tip .m{${helpSurfaceMetaStyle}}`);

/** #437 summary CSS lives with its lazy runtime in summary-panel-style.ts. */
export const chromeStyles: CSSResultGroup = chromeCoreStyles;
