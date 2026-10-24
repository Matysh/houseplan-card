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
import { css } from 'lit';

export const editorDialogsStyles = css`
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
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--card-background-color, #fff);
      box-shadow: 0 8px 28px rgba(0,0,0,.22);
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
    .wallthick-dlg input[type="number"] {
      cursor: text;
      width: 5.5em;
      padding: 4px 6px;
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 6px;
      background: var(--input-fill, transparent);
      color: var(--primary-text-color);
    }
    .areasel,
    .namein {
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      color: var(--hp-txt);
      border-radius: var(--rad-s);
      padding: var(--sp-3) var(--sp-4);
      font-size: var(--fs-m);
      font-family: inherit;
    }
    .namein {
      width: 130px;
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
    .srcrow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      font-size: var(--fs-m);
      cursor: pointer;
      padding: var(--sp-1) 0;
    }
    .dispsection {
      margin-top: var(--sp-5) !important;
      padding-top: var(--sp-4);
      border-top: 1px solid var(--hp-line);
      font-weight: 600;
      color: var(--hp-txt) !important;
    }
    .colorrow .tempin { width: 70px; flex: none; }
    hp-dialog .body .colorrow .tempin { width: 72px; flex: none; }
    .srcrow { flex-wrap: nowrap; }
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
    .vacsource-warning .btn { justify-self: start; }
    .vacsource-list { display: grid; gap: 6px; margin-top: 8px; }
    .vacsource-list details { padding: 6px 0 0; }
    .vacsource-list details > summary { cursor: pointer; font-weight: 600; }
    .vacsource { display: flex; align-items: center; justify-content: space-between; gap: 12px;
      width: 100%; min-width: 0; padding: 9px 10px; border: 1px solid var(--divider-color);
      border-radius: 10px; color: var(--primary-text-color); background: var(--secondary-background-color);
      text-align: left; cursor: pointer; }
    .vacsource.on { border-color: var(--accent-color); box-shadow: inset 3px 0 var(--accent-color); }
    .vacsource > span:first-child { min-width: 0; display: grid; gap: 2px; }
    .vacsource small { color: var(--secondary-text-color); overflow-wrap: anywhere; }
    .vacsource-meta { color: var(--secondary-text-color); text-align: right; font-size: 0.82em; }
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
      border-top: 1px solid var(--hp-border, rgba(255, 255, 255, 0.12));
      background: var(--card-background-color, var(--hp-bg));
      font-size: 0.85em;
    }
    .furnhd {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      font-weight: 600;
      opacity: 0.9;
    }
    .furnhd .spacer { flex: 1; }
    .furnbody {
      overflow: auto;
      padding: 0 8px 6px;
    }
    .furngroup {
      margin: 6px 0 3px;
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.6;
    }
    .furnrow {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .furnback {
      min-height: 34px;
      gap: 5px;
      margin: 2px 0 4px;
    }
    .furnitem {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      width: 74px;
      padding: 4px 2px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: rgba(127, 127, 127, 0.08);
      color: inherit;
      font: inherit;
      font-size: 0.8em;
      line-height: 1.15;
      text-align: center;
      cursor: pointer;
    }
    :host([data-pointer-hover]) .furnitem:hover { background: rgba(127, 127, 127, 0.18); }
    .furnitem.on {
      border-color: var(--hp-accent);
      background: rgba(38, 166, 154, 0.18);
    }
    .furnprev {
      width: 40px;
      height: 40px;
      color: var(--primary-text-color, currentColor);
    }
    .furncategory { width: 92px; min-height: 76px; }
    .furncatprev { width: 48px; height: 48px; }
    .furnvariants .furnitem { min-height: 74px; }
    .furnsize {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      padding: 6px 8px;
      border-top: 1px solid var(--hp-border, rgba(255, 255, 255, 0.12));
    }
    .furnsize label {
      display: flex;
      align-items: baseline;
      gap: 3px;
      opacity: 0.8;
    }
    .furnsize .furnunit { opacity: 0.6; font-size: 0.85em; }
    .furnsize input {
      width: 5.5em;
      padding: 3px 5px;
    }
    .furnhint { opacity: 0.6; }
    .imageupload {
      display: inline-flex;
      gap: 6px;
      margin: 4px 0 8px;
      cursor: pointer;
    }
    .imageupload.disabled { opacity: 0.55; pointer-events: none; }
    .imageupload input { display: none; }
    .imageassets { align-items: stretch; }
    .imageempty { padding: 12px 6px; }
    .imageasset { position: relative; }
    .imageasset .furnitem { width: 104px; min-height: 92px; }
    .imageasset img {
      width: 64px;
      height: 54px;
      object-fit: contain;
      border-radius: 4px;
      background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 50% / 12px 12px;
    }
    .imageasset .furnitem span {
      max-width: 96px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .imageasset .furnitem small { opacity: 0.65; font-size: 0.72em; }
    .imageassetdelete {
      position: absolute;
      top: 0;
      right: 0;
      min-width: 30px;
      width: 30px;
      min-height: 30px;
      padding: 3px;
    }
    .imagepropertypreview {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .imagepropertypreview img {
      width: 72px;
      height: 54px;
      object-fit: contain;
      border-radius: 4px;
      background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 50% / 12px 12px;
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
    .rtesticon { font-size: var(--fs-s); color: var(--hp-muted); }
    .rrow {
      align-items: center;
    }
    .rrow .rpat { flex: 2; }
    .rrow .ricon { flex: 1.4; }
    .rrow .rpat.bad { border-color: #ff7a5c; }
    .rrow .rprev { color: var(--hp-txt); min-width: 18px; }
    .rrow .ract {
      --mdc-icon-size: 16px;
    }
    :host([data-pointer-hover]) .rrow .ract:hover { color: var(--hp-txt); }
    :host([data-pointer-hover]) .rrow .ract.del:hover { color: #ff7a5c; }
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
    .backupupload > .btn { width: 100%; justify-content: center; }
    .backupupload input { display: none; }
    .backupbody { min-width: 0; }
    /* #813: the eager sheet kept these only because a dead .backupactions
       shared the 520 px rule; with it gone they are editor-only (#805). */
    .backupcounts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-2) var(--sp-4);
      font-size: var(--fs-s);
    }
    @media (max-width: 520px) {
      .backupcounts { grid-template-columns: 1fr; }
    }
    .backupplanonly { margin-inline-start: var(--sp-4) !important; align-items: flex-start !important; }
    .backupplanonly > span:first-of-type { display: grid; gap: 2px; white-space: normal; }
    .backupplanonly small { color: var(--secondary-text-color); line-height: 1.35; }
    .backupplanonlystatus { color: var(--hp-accent) !important; font-weight: 700; }
    .backupfile, .backupsummary, .backupcontent {
      display: flex;
      flex-direction: column;
      min-width: 0;
      gap: var(--sp-1);
    }
    .backupfile b, .backupcontent span {
      overflow-wrap: anywhere;
    }
    .backupfile span, .backupsummary span, .backupcontent span {
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    .backupdetails {
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      padding: var(--sp-2) var(--sp-3);
      font-size: var(--fs-s);
    }
    .backupdetails summary { cursor: pointer; font-weight: 700; }
    .backupdetails > div { display: grid; gap: var(--sp-1); padding-block-start: var(--sp-2); }
    .backupdetails code { overflow-wrap: anywhere; color: var(--hp-muted); }
    .backupchoices {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      min-width: 0;
    }
    .backupchoices label { margin: 0 !important; display: flex; gap: var(--sp-2); }
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
    .supportsection h3 {
      color: var(--hp-txt);
    }
    .supportlinks, .supportactions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      min-width: 0;
    }
    .supportmessage, .supportraw {
      width: 100%;
      resize: vertical;
    }
    .supportraw {
      margin-top: var(--sp-2);
      resize: none;
      white-space: pre;
      overflow: auto;
    }
    .supportattach {
      min-width: 0;
    }
    .supportattach > span:first-of-type {
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .supportwarning, .supportstatus, .supportupdate {
      display: flex;
      align-items: flex-start;
      gap: var(--sp-2);
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .supportwarning ha-icon, .supportstatus ha-icon, .supportupdate ha-icon {
      flex: none;
    }
    .supportpreview, .supportmanual, .supporterror, .supportsuccess {
      display: grid;
      min-width: 0;
      border: 1px solid var(--hp-line);
    }
    .supportsummary { font-weight: 600; overflow-wrap: anywhere; }
    .supporthash {
      display: grid;
      min-width: 0;
      gap: var(--sp-1);
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    .supporthash code { overflow-wrap: anywhere; color: var(--hp-txt); }
    .supportpreview details { min-width: 0; }
    .supportpreview summary { color: var(--hp-accent); }
    .supportprivacy { margin: 0 !important; }
    .supporterror {
      background: color-mix(in srgb, var(--error-color, #db4437) 12%, transparent);
      border-color: color-mix(in srgb, var(--error-color, #db4437) 45%, var(--hp-line));
    }
    .supportsuccess {
      background: color-mix(in srgb, var(--success-color, #43a047) 12%, transparent);
      border-color: color-mix(in srgb, var(--success-color, #43a047) 45%, var(--hp-line));
    }
    hp-dialog .body .namein,
    hp-dialog .body .areasel {
      width: 100%;
      box-sizing: border-box;
    }
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
      border: 1px solid var(--divider-color, #e0e0e0);
    }
    .device-inbox-discovery summary { font-weight: 600; }
    .device-inbox-discovery .srcrow { display: flex; gap: 6px; align-items: center; margin: 8px 0; }
    .device-inbox-excluded { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .device-inbox-excluded > span { font-weight: 500; }
    .device-inbox-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .device-inbox-chips .chip {
      display: inline-flex; align-items: center; gap: 2px;
      padding: 1px 6px; border-radius: 10px;
      background: var(--secondary-background-color, #f0f0f0); font-size: 12px;
    }
    .device-inbox-chips .chip button {
      background: none;
      color: var(--secondary-text-color, #666);
    }
    .device-inbox-excluded input[type="text"] {
      flex: 1 1 140px;
    }
    .device-inbox-preview { margin: 8px 0 4px; font-size: 13px; opacity: 0.85; }
    .device-inbox-filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-4) var(--sp-6);
      color: var(--hp-muted);
    }
    .device-inbox-filters label {
      display: inline-flex;
      align-items: center;
      cursor: pointer;
    }
    .device-inbox-space-filter { min-width: 0; max-width: 100%; flex-wrap: wrap; }
    .device-inbox-space-filter hp-settings-select {
      width: 240px; max-width: 100%; font: inherit;
      --hpf-surface: var(--card-background-color,#fff);
      --hpf-control-surface: var(--hpf-surface); --hpf-line: var(--hp-line,var(--divider-color,#dce5e7));
      --hpf-accent: var(--hp-accent,var(--primary-color)); --hpf-canvas: var(--secondary-background-color);
      --hpf-tint: color-mix(in srgb,var(--hpf-accent) 10%,var(--hpf-surface));
      --hpf-tint-line: color-mix(in srgb,var(--hpf-accent) 38%,var(--hpf-surface));
    }
    .device-inbox-filter-help {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-1);
      min-width: 0;
    }
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
      border-width: 1px;
      border-style: solid;
      background: color-mix(in srgb, var(--hp-txt) 3%, transparent);
    }
    .device-inbox-row.has-select {
      grid-template-columns: 24px 42px minmax(180px, 1fr) minmax(180px, auto);
    }
    .device-inbox-select { justify-self: center; }
    .device-inbox-icon { --mdc-icon-size: 28px; color: var(--hp-txt); justify-self: center; }
    .device-inbox-copy { min-width: 0; }
    .device-inbox-name { display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-2); }
    .device-inbox-new {
      border-radius: 999px;
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      font-size: var(--fs-s);
      padding: 2px 7px;
    }
    .device-inbox-meta,
    .device-inbox-reason,
    .device-inbox-copy code {
      display: block;
      color: var(--hp-muted);
      font-size: var(--fs-s);
      overflow-wrap: anywhere;
      white-space: normal;
    }
    .device-inbox-status { color: var(--error-color, #db4437); margin-inline-start: var(--sp-2); }
    .device-inbox-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      flex-wrap: wrap;
    }
    .device-inbox-menu { position: relative; }
    .device-inbox-empty { color: var(--hp-muted); text-align: center; padding: var(--sp-8); }
    .device-inbox-more { align-self: center; }
    @media (max-width: 680px) {
      .device-inbox-head { grid-template-columns: minmax(0, 1fr); }
      .device-inbox-head .btn { justify-self: stretch; }
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
`;
