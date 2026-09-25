/** Editor chrome: toolbars, tabs, menus and hints (#266, split from styles.ts). */
import { css, type CSSResultGroup } from 'lit';

const chromeCoreStyles = css`
    .hdr {
      position: sticky;
      top: var(--header-height, 56px);
      z-index: 20;
      background: var(--card-background-color, var(--hp-bg));
      border-radius: var(--ha-card-border-radius, 12px) var(--ha-card-border-radius, 12px) 0 0;
    }
    .tabs {
      display: flex;
      gap: var(--sp-2);
      background: rgba(127, 127, 127, 0.12);
      padding: var(--sp-2);
      border-radius: var(--rad-l);
      flex-wrap: wrap;
    }
    .tab {
      border: 0;
      background: transparent;
      color: var(--hp-muted);
      display: inline-flex;
      align-items: center;
      padding: var(--sp-3) var(--sp-5);
      border-radius: var(--rad-m);
      font-size: var(--fs-m);
      font-weight: 600;
      cursor: pointer;
      transition: 0.15s;
      font-family: inherit;
    }
    :host([data-pointer-hover]) .tab:hover {
      color: var(--hp-txt);
    }
    .tab .tabtitle { pointer-events: none; }
    .tab.active {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    /* docs/CANVAS.md §4.1: objects an order of magnitude away from the plan
       do not decide the opening view — one quiet chip says so and offers to
       take them in. Never a modal (owner). */
    .farhint {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: var(--sp-4);
      z-index: 12;
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      max-width: calc(100% - var(--sp-8));
      background: var(--card-background-color, var(--hp-bg));
      opacity: 0.94;
      color: var(--hp-txt);
      border: 1px solid var(--divider-color, #33404d);
      border-radius: var(--rad-m);
      padding: var(--sp-1) var(--sp-3);
      font-size: var(--fs-s);
    }
    .farhint ha-icon {
      --mdc-icon-size: 18px;
      color: var(--hp-warn, #e2a03f);
      flex: none;
    }
    .farhint span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
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
    .header-menu-button {
      min-width: 44px;
      min-height: 44px;
      justify-content: center;
      padding: var(--sp-3);
    }
    .header-menu-scrim {
      position: fixed;
      inset: 0;
      z-index: 1;
      background: transparent;
    }
    .header-menu {
      position: absolute;
      top: calc(100% + var(--sp-2));
      right: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      width: max-content;
      min-width: 220px;
      max-width: calc(100vw - 16px);
      max-height: calc(100dvh - 120px);
      overflow-y: auto;
      padding: var(--sp-2);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
      background: var(--card-background-color, var(--hp-bg));
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
    }
    .header-menu-item {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      min-height: 44px;
      padding: 0 var(--sp-4);
      border: 0;
      border-radius: var(--rad-s);
      background: transparent;
      color: var(--hp-txt);
      font: inherit;
      font-size: var(--fs-m);
      text-align: start;
      cursor: pointer;
    }
    .header-menu-item ha-icon, .header-menu-item svg { --mdc-icon-size: 20px; width: 20px; height: 20px; flex: none; }
    .header-menu-item.on { color: var(--hp-accent); font-weight: 600; }
    :host([data-pointer-hover]) .header-menu-item:hover { background: rgba(127, 127, 127, 0.14); }
    .header-menu-item:focus-visible { outline: 2px solid var(--hp-accent); outline-offset: -2px; }
    @media (max-width: 480px) {
      .hdr > .head { flex-wrap: nowrap; padding: 5px 8px; gap: 6px; }
      .head > .title, .head > .modes, .head > .spacer, .head > .header-action,
      .head > .summary-control, .head > .projection-toggle { display: none; }
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
      .head > .zoomctl, .head > .editor-close-slot { flex: none; }
      .header-menu-wrap { display: inline-flex; }
    }
    .decorbar .dcolor {
      width: 30px; height: 26px; padding: 0; border: none; background: none; cursor: pointer;
    }
    .decorbar .dwidth {
      font-family: inherit; font-size: var(--fs-s); border-radius: var(--rad-s);
      background: var(--hp-bg2, transparent); color: var(--hp-txt); border: 1px solid var(--hp-muted);
      padding: var(--sp-2) var(--sp-3);
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
    .modes {
      display: inline-flex;
      gap: var(--sp-1);
      background: rgba(127, 127, 127, 0.12);
      border-radius: var(--rad-l);
      padding: var(--sp-2);
    }
    .modetab {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      border: 0;
      background: transparent;
      color: var(--hp-muted);
      padding: var(--sp-3) 10px; /* 10px h-padding kept: +2px would wrap the header modes row */
      border-radius: var(--rad-m);
      font-size: var(--fs-m);
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background-color 0.14s ease, color 0.14s ease, transform 0.14s ease;
    }
    .modetab:active { transform: scale(0.97); }
    .modetab ha-icon { --mdc-icon-size: 15px; }
    /* issue #220: a tab can be dragged to a new position in the editors */
    .tab[data-reorderable] { cursor: grab; }
    .tab.dragging { cursor: grabbing; opacity: 0.55; }
    .tab.drop-before { box-shadow: inset 2px 0 0 0 var(--primary-color, #03a9f4); }
    .tab.drop-after { box-shadow: inset -2px 0 0 0 var(--primary-color, #03a9f4); }
    /* #647: the editor X owns a fixed slot right after the mode tabs (where
       the device count used to be). One size for both states, so entering,
       leaving or switching editors never changes the header width; the slot is
       the X's pointer target (>= 24 x 24, #195) around a 13 px glyph. */
    .editor-close-slot {
      --hp-editor-close-size: 24px;
      box-sizing: border-box;
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: var(--hp-editor-close-size);
      height: var(--hp-editor-close-size);
    }
    .editor-close-slot[aria-hidden='true'] { pointer-events: none; }
    .editor-close-slot .closex {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--hp-muted);
      opacity: 0.75;
      cursor: pointer;
      border-radius: var(--rad-s);
      font: inherit;
    }
    .editor-close-slot .closex ha-icon { --mdc-icon-size: 13px; }
    :host([data-pointer-hover]) .editor-close-slot .closex:hover { opacity: 1; }
    .editor-close-slot .closex:focus-visible {
      outline: 2px solid var(--primary-color, #03a9f4);
      outline-offset: 1px;
      opacity: 1;
    }
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
    .modetab.active {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    @media (max-width: 720px) {
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
    .tab .tabedit {
      --mdc-icon-size: 13px;
      display: inline-flex;
      align-items: center;
      margin-left: var(--sp-3);
      opacity: 0.4;
    }
    :host([data-pointer-hover]) .tab:hover .tabedit {
      opacity: 0.9;
    }
    .tab.tabadd {
      padding: var(--sp-3) var(--sp-4);
    }
    .tab.tabadd ha-icon {
      --mdc-icon-size: 15px;
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
    @media (prefers-reduced-motion: reduce) {
      .modetab { transition: none; }
    }
    .editbar .warn {
      color: #ffc14d;
    }
    .editbar .sname {
      font-weight: 600;
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
    .menuwrap {
      position: fixed;
      inset: 0;
      z-index: 80;
    }
    .menu {
      position: fixed;
      background: var(--hp-bg);
      border: 1px solid var(--hp-accent);
      border-radius: var(--rad-l);
      box-shadow: var(--shadow-2);
      min-width: 210px;
      max-width: 300px;
      overflow: hidden;
      transform: translate(0, 8px);
    }
    .menu .hd {
      padding: var(--sp-4) var(--sp-5);
      font-weight: 600;
      font-size: var(--fs-m);
      border-bottom: 1px solid var(--hp-line);
      display: flex;
      align-items: center;
      gap: var(--sp-3);
    }
    .menu .hd ha-icon,
    .menu .it.all ha-icon {
      color: var(--hp-accent);
      --mdc-icon-size: 16px;
    }
    .menu .it {
      padding: var(--sp-4) var(--sp-5);
      font-size: var(--fs-m);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--sp-4);
    }
    .menu .it ha-icon {
      --mdc-icon-size: 16px;
      color: var(--hp-muted);
    }
    :host([data-pointer-hover]) .menu .it:hover {
      background: rgba(127, 127, 127, 0.15);
    }
    .menu .it.all {
      color: var(--hp-accent);
      font-weight: 600;
    }
    .tip {
      position: fixed;
      pointer-events: none;
      background: var(--hp-bg);
      border: 1px solid var(--hp-accent);
      color: var(--hp-txt);
      padding: var(--sp-3) 10px;
      border-radius: var(--rad-m);
      font-size: var(--fs-m);
      box-shadow: var(--shadow-2);
      z-index: 60;
      max-width: 260px;
    }
    .tip .m {
      color: var(--hp-muted);
      font-size: var(--fs-s);
      display: block;
    }
`;

/** #437 summary CSS lives with its lazy runtime in summary-panel-style.ts. */
export const chromeStyles: CSSResultGroup = chromeCoreStyles;
