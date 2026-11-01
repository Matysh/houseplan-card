/** Dialog rules that only the lazy editor runtime renders (#805).
 *
 * Moved out of the eager `dialogs.styles.ts` by the selection rule of #805:
 * every selector carries a class that appears in the editor runtime graph and
 * in no source of the View graph (`houseplan-card.ts`, `space-card.ts` and
 * their static imports) or of any other lazy graph (onboarding, backdrop-pick,
 * panel, summary, PDF, 2.5D, LED, moon, Zigbee, live-interaction). A cold View
 * therefore neither downloads nor matches these rules.
 *
 * The editor runtime adopts this sheet into the card's shadow root right after
 * the eager `dialogs` sheet (`src/editor-style-adoption.ts`), so every rule keeps
 * its place relative to all other sheets. Within the former single `dialogs`
 * sheet these rules now follow every eager rule: a declaration that an equally
 * weighted later eager rule always overrode is dropped here instead of winning.
 *
 * Ownership, the reverse ratchet (no editor-only rule back in `dialogs`) and
 * the absence of duplicate selectors: `test/editor-dialog-styles.test.mjs`.
 */
import { css, unsafeCSS } from 'lit';
import { floatingSurfaceCss } from './floating-surface.styles';
import { editorImagePreviewCss } from './form-kit-editor.styles';
import { readingSeparatorCss, readingTextCss } from './reading-kit.styles';

export const editorDialogsStyles = unsafeCSS(css`
    .colorrow { display:flex; align-items:center; gap:var(--sp-4); }
    .colorrow input[type='range'] { flex:1; }
    .colorrow ha-slider { flex:1; min-width:0; }
    hp-dialog .dfill {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      cursor: pointer;
    }
    .wallthick-dlg {
      position: absolute;
      z-index: 80;
      min-width: 200px;
      transform: translate(-50%, 8px);
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: auto;
      cursor: grab;
      touch-action: none;
    }
    .wallthick-dlg.dragging { cursor: grabbing; }
    .wallthick-dlg .row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .habindingbanner {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      margin-bottom: var(--sp-4);
      border: 1px solid var(--warning-color, #ff9800);
      border-radius: var(--rad-m);
      background: color-mix(in srgb, var(--warning-color, #ff9800) 12%, transparent);
      color: var(--primary-text-color, #f1f3f6);
    }
    .habindingbanner > span { flex: 1; min-width: 0; }
    .habindingbanner > ha-icon { color: var(--warning-color, #ff9800); flex: 0 0 auto; }

    .dispsection {
      margin-top: var(--sp-5) !important;
      padding-top: var(--sp-4);
    }
    .colorrow .tempin { width: 70px; flex: none; }
    hp-dialog .body .colorrow .tempin { width: 72px; flex: none; }

    /* native HA controls (rendered only when the HA frontend defines them;
       old HA and the smoke env keep the plain inputs). ha-switch is taller
       than a checkbox - cap its footprint so .srcrow keeps its rhythm. */
    .srcrow ha-switch { flex: none; }
    .srcrow > span:first-of-type { white-space: nowrap; }
    .colorrow .opl { color: var(--hp-muted); font-size: var(--fs-s); }
    .markerlightgroup {
      border-radius: var(--rad-m);
    }
    .markerlightgroup legend {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-1);
      color: var(--hp-txt);
      font-weight: 600;
    }
    .markerlightgroup[disabled] > :not(legend) { opacity: .62; }
    .radargroup {
      gap: var(--sp-2);
    }
    .radaradditional { display: grid; gap: var(--sp-3); }
    .radargroup > p { margin: 0; }
    .radarcoordinates {
      align-items: flex-end;
    }
    .radarcoordinates > label {
      display: grid;
      gap: var(--sp-1);
    }
    hp-dialog .body .radarcoordinates .tempin {
      box-sizing: border-box;
      width: 100%;
    }
    .radarinspection {
      display: grid;
      gap: 6px;
      padding: 10px 12px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--primary-color) 7%, transparent);
    }
    .radarinspection code { overflow-wrap: anywhere; font-size: 12px; }
    .radarsetup {
      display: grid;
      gap: 10px;
      margin-top: 10px;
      padding: 12px;
      border: 1px solid var(--hp-accent);
      border-radius: var(--rad-m);
      background: color-mix(in srgb, var(--secondary-background-color) 88%, transparent);
    }
    .radarsetup-head { display: flex; gap: 8px; }
    .radarsetup-head strong { flex: 1; }
    .radarsetup > svg {
      width: min(100%, 460px);
      aspect-ratio: 1;
      justify-self: center;
      border-radius: var(--rad-m);
      background: var(--primary-background-color);
      touch-action: none;
      cursor: crosshair;
    }
    .radarsetup .room {
      fill: color-mix(in srgb, var(--hp-accent) 8%, transparent);
      stroke: var(--divider-color);
      stroke-width: 3;
      vector-effect: non-scaling-stroke;
    }
    .radarsetup .heading {
      stroke: var(--hp-accent);
      stroke-width: 4;
      vector-effect: non-scaling-stroke;
    }
    .radarsetup .trail {
      fill: none;
      stroke: var(--success-color, #43a047);
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
      opacity: .55;
    }
    .radarsetup g circle {
      fill: var(--hp-bg);
      stroke: var(--hp-accent);
      stroke-width: 3;
      vector-effect: non-scaling-stroke;
    }
    .radarsetup g.pending circle { stroke-dasharray: 5 4; }
    .radarsetup g text {
      fill: var(--hp-txt);
      font-size: 22px;
      font-weight: 700;
      text-anchor: middle;
      dominant-baseline: middle;
      pointer-events: none;
    }
    .vacbox .vacbtns { display: flex; gap: var(--sp-4); margin: var(--sp-3) 0; flex-wrap: wrap; }
    .vacdiag { display: grid; gap: 4px; margin-bottom: var(--sp-3); }
    .vacdiag > div { display: flex; justify-content: space-between; gap: var(--sp-5); }
    .vacdiag > div > span { color: var(--secondary-text-color); }
    .vacdiag > div > b { text-align: right; overflow-wrap: anywhere; }
    .vacroute-missing-group {
      margin-top: var(--sp-4);
      padding-top: var(--sp-4);
      border-top: 1px solid var(--hp-line);
    }
    .vacroute-group-title {
      margin: 0 0 var(--sp-3);
      color: var(--secondary-text-color);
      font-size: var(--fs-m);
      font-weight: 600;
    }
    .vacroute-missing-group .vacroute-list { margin-top: 0; }
    .vacpicker { margin: var(--sp-3) 0; }
    .vacsource-warning { display: grid; gap: 8px; }
    .vacsource-warning button { justify-self: start; }
    .vacsource-list { display: grid; gap: 6px; margin-top: 8px; }
    .vacsource-list details { padding: 6px 0 0; }
    .vacsource-list details > summary { cursor: pointer; font-weight: 600; }
    .vacsource > span:first-child { min-width: 0; display: grid; gap: 2px; }
    .vacsource small { color: var(--secondary-text-color); overflow-wrap: anywhere; }
    .vacsource-meta { text-align: right; }
    .vacxcme pre { margin: 8px 0 0; white-space: pre-wrap; user-select: text; }
    .vacfit {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 12;
      overflow: visible;
      touch-action: none;
      cursor: grab;
      /* the devlayer is pointer-events: none and every child opts back in —
         without this line real clicks flew straight through the overlay
         (owner: «уголки не кликабельны»; synthetic smoke events bypass
         hit-testing, which is why they lied) */
      pointer-events: auto;
    }
    .vacfit:active { cursor: grabbing; }
    .vacfit polygon {
      fill: color-mix(in srgb, var(--hp-accent) 16%, transparent);
      stroke: var(--hp-accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      stroke-dasharray: 6 4;
    }
    .vacfit text {
      fill: var(--hp-accent);
      font-size: 26px;
      text-anchor: middle;
      dominant-baseline: middle;
      pointer-events: none;
      user-select: none;
    }
    /* ---- the furniture palette (docs/FURNITURE.md §3) ------------------- */
    .furnpalette {
      display: flex;
      flex-direction: column;
      max-height: 38vh;
    }
    .furnhd {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
    }
    .furnhd .spacer { flex: 1; }
    .furnbody {
      overflow: auto;
      padding: 0 8px 6px;
    }
    .furngroup { margin:6px 0 3px; }
    .furnrow {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .furnback { margin:2px 0 4px; }
    .furnsize {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      padding: 6px 8px;
    }
    .furnsize label {
      display: flex;
      align-items: baseline;
      gap: 3px;
    }
    .imageupload {
      display: inline-flex;
      margin: 4px 0 8px;
    }
    .imageupload.disabled { pointer-events:none; }
    .imageupload input { display: none; }
    .imageassets { align-items: stretch; }
    .imageasset { position: relative; }
    .imageasset .furnitem span {
      max-width: 96px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .imageassetdelete { position:absolute; top:0; right:0; }
    .imagepropertypreview {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .imagepropertypreview span { overflow-wrap: anywhere; }
    .vacfitdot { fill: var(--hp-accent); pointer-events: none; }
    /* hit target: invisible and finger-sized; .vacfitknob is the visible bead */
    .vacfithandle {
      fill: transparent;
      stroke: none;
      cursor: nwse-resize;
    }
    .vacfitknob {
      fill: var(--hp-bg);
      stroke: var(--hp-accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .candlist {
      max-height: 160px;
      overflow-y: auto;
      border-top: 1px solid var(--hp-line);
      /* A scrollable box is a flex item that HAPPILY collapses: inside the
         dialog body (a flex column) this list rendered its rows into a 1px
         sliver — the DOM had 26 candidates and the user saw nothing. In the
         binding dropdown it sits inside .droppanel (block context) and never
         showed the bug. Field report, 2026-07-30. */
      flex: 0 0 auto;
      min-height: 2.6em;
    }
    .opening-entity-candidate {
      width: 100%;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
    }
    .opening-entity-candidate.sel {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    .opening-entity-empty { cursor: default; }
    .rtest {
      display: flex;
      align-items: center;
    }
    .rtest ha-icon { color: var(--hp-accent); }

    .rrow {
      align-items: center;
    }
    .rrow .rpat { flex: 2; }
    .rrow .ricon { flex: 1.4; }

    .rrow .rprev { min-width:18px; }

    .optimize-live {
      display: grid;
      justify-items: start;
      gap: var(--sp-2);
      margin-bottom: var(--sp-3);
    }
    .optimize-live .alignmsg, .optimize-live .rhint { margin-bottom: 0; }
    .optimize-cleanup { min-height: 44px; }
    .optimize-selected { color: var(--hp-txt); }
    .optimize-unverified {
      display: grid;
      gap: var(--sp-2);
      margin-bottom: var(--sp-3);
      overflow-wrap: anywhere;
    }
    .optimize-unverified p, .optimize-unverified ul { margin: 0; }
    .optimize-unverified ul { padding-inline-start: 22px; font-size: 13px; }
    .optimize-actions { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .optimize-action { min-height: 44px; }
    .optimize-details {
      margin-top: var(--sp-3);
      color: var(--hp-muted);
      font-size: var(--fs-s);
      overflow-wrap: anywhere;
    }
    .optimize-details > summary {
      width: fit-content;
      color: var(--hp-txt);
      cursor: pointer;
      font-weight: 600;
    }
    .optimize-details > summary:focus-visible {
      outline: 2px solid var(--hp-accent);
      outline-offset: 3px;
      border-radius: var(--rad-s);
    }
    .optimize-details ul { margin: var(--sp-3) 0; padding-inline-start: 22px; }
    .optimize-details li + li { margin-top: var(--sp-1); }
    .backupupload { display: inline-flex; min-width: 0; }
    .backupupload > button { width: 100%; justify-content: center; }
    .backupupload input { display: none; }
    .backupbody { min-width: 0; }
    /* #813: the eager sheet kept these only because a dead .backupactions
       shared the 520 px rule; with it gone they are editor-only (#805). */
    .backupcounts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-2) var(--sp-4);
    }
    @media (max-width: 520px) {
      .backupcounts { grid-template-columns: 1fr; }
    }
    .backupplanonly { margin-inline-start: var(--sp-4) !important; align-items: flex-start !important; }
    .backupplanonly > span:first-of-type { display: grid; gap: 2px; white-space: normal; }

    .backupfile, .backupsummary, .backupcontent {
      display: flex;
      flex-direction: column;
      min-width: 0;
      gap: var(--sp-1);
    }
    .backupfile b, .backupcontent span {
      overflow-wrap: anywhere;
    }

    .backupdetails code { overflow-wrap:anywhere; }
    .backupdetailrows { display:grid; gap:var(--sp-1); }
    .backupdetailrows p { margin:0; }
    .backupchoices {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      min-width: 0;
    }

    .backupconfirm { align-items: flex-start !important; }
    .backupconfirm > span:first-of-type {
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    /* Support's common paint belongs to settings-dialogs; keep subject layout here. */
    .aboutlink {
      display: flex;
      align-items: center;
      width: fit-content;
    }
    .aboutlink ha-icon { --mdc-icon-size: 18px; line-height: 1; }
    /* #836: the dev build SHA is a link inside the version line. */
    .aboutver .aboutlink { display: inline; }
    .supportsection {
      display: grid;
      min-width: 0;
    }

    .supportlinks, .supportactions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      min-width: 0;
    }
    .supportmessage, .supportraw { width:100%; }
    .supportraw {
      margin-top: var(--sp-2);
    }
    .supportattach {
      min-width: 0;
    }
    .supportattach > span:first-of-type {
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .supportpreview, .supportmanual, .supportcopy {
      display: grid;
      min-width: 0; gap:12px;
    }

    .supporthash {
      display: grid;
      min-width: 0;
      gap: var(--sp-1);
    }
    .supporthash code { overflow-wrap: anywhere; }
    .supportpreview details { min-width: 0; }

    .supportprivacy { margin: 0 !important; }

    .device-inbox {
      display: flex;
      flex-direction: column;
    }
    .device-inbox-head {
      display: grid;
      grid-template-columns: minmax(180px, 1fr) auto;
      align-items: center;
      gap: var(--sp-4);
    }
    .device-inbox-search {
      width: 100%;
    }
    .device-inbox-tabs {
      display: flex;
      overflow-x: auto;
      scrollbar-width: thin;
    }
    .device-inbox-tabs button {
      flex: 0 0 auto;
    }
    .device-inbox-tabs button span { color: var(--hp-muted); margin-inline-start: 4px; }
    /* #44: discovery-filters section on the Available tab */
    .device-inbox-discovery {
      margin: 8px 0;
    }

    .device-inbox-discovery .srcrow { margin:8px 0; }
    .device-inbox-excluded { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .device-inbox-excluded > span { font-weight: 500; }
    .device-inbox-chips { display: flex; flex-wrap: wrap; gap: 4px; }

    .device-inbox-excluded input[type="text"] {
      flex: 1 1 140px;
    }
    .device-inbox-preview { margin:8px 0 4px; }
    .device-inbox-filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-4) var(--sp-6);
    }
    .device-inbox-filters label {
      display: inline-flex;
      align-items: center;
      cursor: pointer;
    }
    .device-inbox-space-filter { min-width: 0; max-width: 100%; flex-wrap: wrap; }
    .device-inbox-space-filter hp-settings-select { width:240px; max-width:100%; font:inherit; }
    /* #618: batch selection lives outside .device-inbox-filters. */
    .device-inbox-batch {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-2) var(--sp-4);
      min-width: 0;
    }
    .device-inbox-select-all,
    .device-inbox-select {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      cursor: pointer;
    }
    .device-inbox-batch-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      min-width: 0;
    }
    .device-inbox-selected { color: var(--hp-muted); }
    .device-inbox-results { display: grid; gap: var(--sp-3); min-width: 0; }
    .device-inbox-row {
      display: grid;
      grid-template-columns: 42px minmax(180px, 1fr) minmax(180px, auto);
      align-items: center;
      min-width: 0;
    }
    .device-inbox-row.has-select {
      grid-template-columns: 24px 42px minmax(180px, 1fr) minmax(180px, auto);
    }
    .device-inbox-select { justify-self: center; }
    .device-inbox-icon { justify-self:center; }
    .device-inbox-copy { min-width: 0; }
    .device-inbox-name { display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-2); }

    .device-inbox-meta,
    .device-inbox-reason,
    .device-inbox-copy code {
      display: block;
      overflow-wrap: anywhere;
      white-space: normal;
    }
    .device-inbox-status { margin-inline-start: var(--sp-2); }
    .device-inbox-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      flex-wrap: wrap;
    }
    .device-inbox-menu { position: relative; }

    .device-inbox-more { align-self: center; }
    @media (max-width: 680px) {
      .device-inbox-head { grid-template-columns: minmax(0, 1fr); }
      .device-inbox-head > button { justify-self: stretch; }
      .device-inbox-tabs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        overflow-x: visible;
      }
      .device-inbox-tabs button {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .device-inbox-row { grid-template-columns: 36px minmax(0, 1fr); }
      .device-inbox-row.has-select { grid-template-columns: 24px 36px minmax(0, 1fr); }
      .device-inbox-actions { grid-column: 1 / -1; justify-content: flex-start; }
    }
`.cssText + floatingSurfaceCss('.wallthick-dlg', '10px 12px')
  + editorImagePreviewCss('.imagepropertypreview img', 'property')
  + readingTextCss('hp-dialog.ui-dialog .dispsection', 'form-label', 'primary')
  + readingSeparatorCss('.dispsection'));
