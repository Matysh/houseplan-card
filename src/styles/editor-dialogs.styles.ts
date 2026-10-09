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
      z-index: 40;
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
    }
    .wallthick-dlg .row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .wallthick-dlg input[type="number"] {
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
    .habindingbanner.limited {
      border-color: var(--secondary-text-color, #9aa0aa);
      background: color-mix(in srgb, var(--secondary-text-color, #9aa0aa) 10%, transparent);
    }
    .habindingbanner.limited > ha-icon { color: var(--secondary-text-color, #9aa0aa); }
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
      min-width: 0;
      margin: var(--sp-5) 0 0;
      padding: var(--sp-4);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
    }
    .markerlightgroup legend {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-1);
      padding: 0 var(--sp-2);
      color: var(--hp-txt);
      font-weight: 600;
    }
    .markerlightgroup legend > span { min-width: 0; overflow-wrap: anywhere; }
    .markerlightgroup[disabled] > :not(legend) { opacity: .62; }
    .radargroup {
      display: grid;
      gap: var(--sp-2);
    }
    .radaradditional { display: grid; gap: var(--sp-3); }
    .radaradditional > .markerlightgroup { margin-top: 0; }
    .radargroup > p { margin: 0; }
    .radargroup > label:not(.srcrow) {
      margin-top: var(--sp-2);
    }
    .radarcoordinates {
      align-items: flex-end;
      flex-wrap: wrap;
    }
    .radarcoordinates > label {
      display: grid;
      flex: 1 1 92px;
      gap: var(--sp-1);
      min-width: 0;
      margin: 0;
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
    .radarsetup-head { display: flex; align-items: center; gap: 8px; }
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
    .markerlightgroup .srcrow > span:first-of-type {
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
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
    .vacpicker > summary { display: inline-flex; width: auto; list-style: none; cursor: pointer; }
    .vacpicker > summary::-webkit-details-marker { display: none; }
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
      gap: var(--sp-4);
      margin-bottom: var(--sp-4);
    }
    .rtest .namein { flex: 1; }
    .rtest ha-icon { color: var(--hp-accent); }
    .rtesticon { font-size: var(--fs-s); color: var(--hp-muted); }
    .rrow {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      margin: var(--sp-1) 0;
    }
    .rrow .rpat { flex: 2; }
    .rrow .ricon { flex: 1.4; }
    .rrow .rpat.bad { border-color: #ff7a5c; }
    .rrow .rprev { --mdc-icon-size: 18px; color: var(--hp-txt); min-width: 18px; }
    .rrow .ract {
      --mdc-icon-size: 16px;
      color: var(--hp-muted);
      cursor: pointer;
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
    .aboutver {
      font-size: var(--fs-s);
      color: var(--hp-muted);
      margin: var(--sp-2) 0 var(--sp-3);
    }
    .aboutlink {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      width: fit-content;
      color: var(--hp-accent);
      text-decoration: none;
      font-size: var(--fs-m);
      padding: var(--sp-1) 0;
    }
    :host([data-pointer-hover]) .aboutlink:hover { text-decoration: underline; }
    .aboutlink ha-icon { --mdc-icon-size: 18px; line-height: 1; }
    /* #836: the dev build SHA is a link inside the version line. */
    .aboutver .aboutlink { display: inline; font-size: inherit; padding: 0; }
    /* #805: no gap here — the eager hp-dialog .body rule (same weight, later in
       the old single sheet) always set it; this sheet now comes after it. */
    hp-dialog .supportbody {
      min-width: 0;
      overflow-x: hidden;
    }
    .supportsection {
      display: grid;
      min-width: 0;
      gap: var(--sp-2);
    }
    .supportsection + .supportsection {
      padding-top: var(--sp-4);
      border-top: 1px solid var(--hp-line);
    }
    .supportsection h3 {
      margin: 0;
      color: var(--hp-txt);
      font-size: var(--fs-m);
    }
    .supportlinks, .supportactions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-2) var(--sp-4);
      min-width: 0;
    }
    .supportform > label:not(.srcrow) {
      margin-top: var(--sp-2);
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    .supportmessage, .supportraw {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      resize: vertical;
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      padding: var(--sp-3);
      color: var(--hp-txt);
      background: color-mix(in srgb, var(--card-background-color, var(--hp-bg)) 92%, var(--hp-txt));
      font: inherit;
    }
    .supportmessage {
      min-height: 120px;
      background: var(--hp-bg);
    }
    .supportraw {
      min-height: 220px;
      margin-top: var(--sp-2);
      resize: none;
      white-space: pre;
      overflow: auto;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 12px;
    }
    .supportattach {
      min-width: 0;
      align-items: flex-start;
      margin: var(--sp-2) 0 0 !important;
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
      margin: 0;
      padding: var(--sp-3);
      border-radius: var(--rad-s);
      background: color-mix(in srgb, var(--hp-accent) 14%, transparent);
      overflow-wrap: anywhere;
      font-size: var(--fs-s);
      line-height: 1.45;
    }
    .supportwarning ha-icon, .supportstatus ha-icon, .supportupdate ha-icon {
      flex: none;
      color: var(--hp-accent);
      --mdc-icon-size: 20px;
    }
    .supportpreview, .supportmanual, .supporterror, .supportsuccess {
      display: grid;
      min-width: 0;
      gap: var(--sp-2);
      padding: var(--sp-3);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
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
    .supportpreview summary { cursor: pointer; color: var(--hp-accent); }
    .supportprivacy { margin: 0 !important; line-height: 1.45; }
    .supporterror {
      background: color-mix(in srgb, var(--error-color, #db4437) 12%, transparent);
      border-color: color-mix(in srgb, var(--error-color, #db4437) 45%, var(--hp-line));
    }
    .supportsuccess {
      background: color-mix(in srgb, var(--success-color, #43a047) 12%, transparent);
      border-color: color-mix(in srgb, var(--success-color, #43a047) 45%, var(--hp-line));
    }
    .supportfooter { flex-wrap: wrap; }
    /* #805: no padding-inline for .supportbody/.supportfooter at 520 px — the
       eager hp-dialog .body and hp-dialog .row padding (same weight, later in the
       old single sheet) always won, and the accepted narrow frame keeps it. */
    @media (max-width: 520px) {
      .supportactions .btn, .supportactions .aboutlink { max-width: 100%; }
    }
    hp-dialog .body .namein,
    hp-dialog .body .areasel {
      width: 100%;
      box-sizing: border-box;
    }
    .device-inbox {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
      padding: var(--sp-5) var(--sp-6);
      min-width: 0;
    }
    .device-inbox-dialog { --hp-dialog-wide-width: 920px; }
    .device-inbox-head {
      display: grid;
      grid-template-columns: minmax(180px, 1fr) auto;
      align-items: center;
      gap: var(--sp-4);
    }
    .device-inbox-search {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
      background: transparent;
      color: var(--hp-txt);
      font: inherit;
      padding: 11px 14px;
    }
    .device-inbox-tabs {
      display: flex;
      gap: var(--sp-2);
      overflow-x: auto;
      scrollbar-width: thin;
      padding-bottom: var(--sp-1);
    }
    .device-inbox-tabs button {
      flex: 0 0 auto;
      border: 1px solid var(--hp-line);
      border-radius: 999px;
      background: transparent;
      color: var(--hp-txt);
      font: inherit;
      padding: 8px 12px;
      cursor: pointer;
    }
    .device-inbox-tabs button.on {
      border-color: var(--hp-accent);
      background: color-mix(in srgb, var(--hp-accent) 18%, transparent);
    }
    .device-inbox-tabs button span { color: var(--hp-muted); margin-inline-start: 4px; }
    /* #44: discovery-filters section on the Available tab */
    .device-inbox-discovery {
      margin: 8px 0; padding: 8px 10px;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 8px;
    }
    .device-inbox-discovery summary { cursor: pointer; font-weight: 600; }
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
      border: none; background: none; cursor: pointer; padding: 0 2px;
      color: var(--secondary-text-color, #666);
    }
    .device-inbox-excluded input[type="text"] {
      flex: 1 1 140px; min-width: 120px; padding: 4px 6px;
      border: 1px solid var(--divider-color, #e0e0e0); border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
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
      gap: var(--sp-2);
      cursor: pointer;
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
      gap: var(--sp-2);
      min-width: 0;
    }
    .device-inbox-selected { color: var(--hp-muted); }
    .device-inbox-results { display: grid; gap: var(--sp-3); min-width: 0; }
    .device-inbox-row {
      display: grid;
      grid-template-columns: 42px minmax(180px, 1fr) minmax(180px, auto);
      align-items: center;
      gap: var(--sp-4);
      min-width: 0;
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
      padding: var(--sp-4);
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
      gap: var(--sp-2);
    }
    .device-inbox-actions .btn { min-height: 36px; padding: 7px 10px; }
    .device-inbox-menu { position: relative; }
    .device-inbox-menu summary { list-style: none; cursor: pointer; }
    .device-inbox-menu summary::-webkit-details-marker { display: none; }
    .device-inbox-menu-items {
      position: absolute;
      z-index: 2;
      inset-inline-end: 0;
      top: calc(100% + var(--sp-1));
      display: grid;
      gap: var(--sp-1);
      min-width: 180px;
      padding: var(--sp-2);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
      background: var(--hp-panel, var(--card-background-color, #fff));
      box-shadow: 0 8px 24px rgba(0, 0, 0, .22);
    }
    .device-inbox-menu-items .btn { justify-content: flex-start; width: 100%; }
    .device-inbox-empty { color: var(--hp-muted); text-align: center; padding: var(--sp-8); }
    .device-inbox-more { align-self: center; }
    @media (max-width: 680px) {
      .device-inbox { padding: var(--sp-4); }
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
