/** Dialogs, forms, buttons and pickers (#266, split from styles.ts).
 * Footer hit targets belong here, not in lazy summary-panel styles (#505).
 * Only what View, kiosk, onboarding or the panel can render stays here; a rule
 * only the editor renders lives in `editor-dialogs.styles.ts` (#805, reverse
 * ratchet in `test/editor-dialog-styles.test.mjs`).
 */
import { css } from 'lit';

export const dialogsStyles = css`
    .head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px var(--sp-5);
      border-bottom: 1px solid var(--hp-line);
      flex-wrap: wrap;
    }
    .title {
      font-size: var(--fs-l);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      white-space: nowrap;
    }
    .title ha-icon {
      color: var(--hp-accent);
      --mdc-icon-size: 18px;
    }
    @media (max-width: 620px) {
      .head { gap: var(--sp-3); padding: var(--sp-4) 10px; }
      .head .title { font-size: var(--fs-m); }
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      border: 1px solid var(--hp-line);
      background: transparent;
      color: var(--hp-txt);
      padding: var(--sp-3) 10px;
      border-radius: var(--rad-m);
      cursor: pointer;
      transition: 0.15s;
      font-family: inherit;
      font-size: var(--fs-m);
    }
    .btn ha-icon {
      --mdc-icon-size: 17px;
    }
    :host([data-pointer-hover]) .btn:hover {
      border-color: var(--hp-accent);
    }
    .btn.on {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      border-color: var(--hp-accent);
    }
    .btn.ghost {
      border: none;
    }
    .btn[disabled] {
      opacity: 0.5;
      pointer-events: none;
    }
    .recoveryoverlay {
      position: absolute;
      inset: 0;
      /* Above the contextual editor tray (70): recovery is the one state in
         which every stage-editing surface must be inert. Dialogs live outside
         the stage and retain their own higher card-level stacking context. */
      z-index: 75;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--sp-4);
      padding: var(--sp-6);
      box-sizing: border-box;
      /* The final solid layer guarantees an opaque recovery surface even when
         a custom HA theme exposes its card colour as rgba(). */
      background:
        linear-gradient(var(--ha-card-background, var(--card-background-color, #111)),
          var(--ha-card-background, var(--card-background-color, #111))),
        #111;
      color: var(--primary-text-color, #fff);
      text-align: center;
      pointer-events: auto;
      transition: opacity 0.15s ease;
    }
    .recoveryoverlay.phase-entering,
    .recoveryoverlay.phase-leaving {
      opacity: 0;
    }
    .recoveryoverlay.phase-fading-in,
    .recoveryoverlay.phase-opaque {
      opacity: 1;
    }
    .recoveryoverlay ha-icon {
      --mdc-icon-size: 44px;
      color: var(--hp-accent);
    }
    .editorloading {
      position: absolute;
      z-index: 74;
      left: 50%;
      top: 50%;
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-5);
      border: 1px solid color-mix(in srgb, var(--hp-accent) 45%, transparent);
      border-radius: 999px;
      background: color-mix(in srgb,
        var(--ha-card-background, var(--card-background-color, #111)) 92%, transparent);
      color: var(--primary-text-color);
      box-shadow: 0 6px 22px rgb(0 0 0 / 18%);
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: editor-loading-in 0.15s ease both;
    }
    .editorloading ha-icon {
      --mdc-icon-size: 22px;
      color: var(--hp-accent);
      animation: editor-loading-spin 0.9s linear infinite;
    }
    @keyframes editor-loading-in {
      from { opacity: 0; transform: translate(-50%, calc(-50% + 4px)); }
      to { opacity: 1; transform: translate(-50%, -50%); }
    }
    @keyframes editor-loading-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .recoveryoverlay,
      .editorloading,
      .editorloading ha-icon {
        transition: none;
        animation: none;
      }
    }
    .oplock {
      --oplock-size: calc(var(--icon-size, 2.5cqw) * 0.62);
      --oplock-core-size: calc(var(--oplock-size) / 1.26875);
      --oplock-stroke-ratio: 0.01875;
      --oplock-stroke-width: max(1px, calc(var(--oplock-core-size) * var(--oplock-stroke-ratio)));
      --oplock-core-bg: light-dark(#fff, #252525);
      --oplock-core-fg: light-dark(#252525, #fff);
      --oplock-shell-stroke: light-dark(#BCBCBC, rgb(37 37 37 / 75%));
      --oplock-shell-shadow:
        0 calc(var(--oplock-core-size) * .025) calc(var(--oplock-core-size) * .05) rgb(37 40 45 / 12%),
        0 calc(var(--oplock-core-size) * .1) calc(var(--oplock-core-size) * .175)
          calc(var(--oplock-core-size) * -.025) rgb(37 40 45 / 18%);
      --oplock-core-shadow: 0 0 0 0 transparent;
      pointer-events: none; /* inert while editing; clickable in View (rule below) */
      position: absolute;
      transform: translate(-50%, -50%);
      width: var(--oplock-size);
      height: var(--oplock-size);
      display: grid;
      place-items: center;
      border: 0;
      background: transparent;
      z-index: 1;
    }
    .oplock.theme-light {
      --oplock-core-bg: #fff;
      --oplock-core-fg: #252525;
      --oplock-shell-stroke: #BCBCBC;
    }
    .oplock.theme-dark {
      --oplock-core-bg: #252525;
      --oplock-core-fg: #fff;
      --oplock-shell-stroke: rgb(37 37 37 / 75%);
      --oplock-core-shadow:
        inset 0 calc(var(--oplock-core-size) * .0125)
          calc(var(--oplock-core-size) * .0125) rgb(255 255 255 / 70%);
    }
    .oplock-shell {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      border: var(--oplock-stroke-width) solid var(--oplock-shell-stroke);
      border-radius: 50%;
      background: transparent;
      box-shadow: var(--oplock-shell-shadow);
      display: grid;
      place-items: center;
      pointer-events: none;
      backdrop-filter: none;
    }
    .oplock-core {
      width: var(--oplock-core-size);
      height: var(--oplock-core-size);
      border-radius: 50%;
      background: var(--oplock-core-bg);
      color: var(--oplock-core-fg);
      box-shadow: var(--oplock-core-shadow);
      display: grid;
      place-items: center;
      pointer-events: none;
    }
    .oplock ha-icon {
      --mdc-icon-size: calc(var(--oplock-core-size) * 0.55);
      display: flex;
      line-height: 0;
    }
    .oplock.locked {
      --oplock-core-bg: #66D17A;
      --oplock-core-fg: light-dark(#fff, #252525);
      --oplock-shell-stroke: #66D17A;
    }
    .oplock.theme-light.locked { --oplock-core-fg: #fff; }
    .oplock.theme-dark.locked {
      --oplock-core-fg: #252525;
      --oplock-stroke-ratio: .025;
    }
    .oplock.unlocked {
      --oplock-core-bg: #F0410C;
      --oplock-core-fg: light-dark(#fff, #252525);
      --oplock-shell-stroke: #F0410C;
    }
    .oplock.theme-light.unlocked { --oplock-core-fg: #fff; }
    .oplock.theme-dark.unlocked {
      --oplock-core-fg: #252525;
      --oplock-stroke-ratio: .025;
    }
    .oplock.unknown { --oplock-core-fg: var(--hp-muted); }
    .btn.lockact {
      width: 100%;
      justify-content: center;
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      margin-top: var(--sp-4);
    }
    .btn.lockact.warn {
      color: var(--error-color, #d33);
      border-color: var(--error-color, #d33);
    }
    .oprow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-3) 0;
    }
    .oprow b { margin-left: auto; }
    .oprow.ok b { color: #66d17a; }
    .oprow.warn b { color: var(--hp-open); }
    .ctrlstates { display: flex; flex-direction: column; gap: var(--sp-2); }
    .ctrlstate { display: inline-flex; align-items: center; gap: var(--sp-3); color: var(--hp-muted); }
    .ctrlstate.on { color: var(--hp-txt); }
    .ctrlstate ha-icon { --mdc-icon-size: 15px; }
    .cardpreview {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-2);
      margin: var(--sp-4) 0 var(--sp-1);
      padding: 10px;
      border: 1px dashed var(--hp-muted);
      border-radius: var(--rad-m);
    }
    .cardpreview .cpname { font-weight: 700; letter-spacing: 0.04em; }
    .cardpreview .cpmeta {
      display: inline-flex;
      align-items: center;
      gap: 0.3em;
      font-weight: 600;
      opacity: 0.85;
    }
    .cardpreview .cpmeta ha-icon { --mdc-icon-size: 1.05em; }
  .colorrow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
  }
    .colorrow input[type='range'] { flex: 1; }
    /* beat the generic hp-dialog .body .namein { width:100% } rule */
    hp-dialog .body .temprange .tempin { width: 56px; flex: none; padding: var(--sp-2) var(--sp-3); }
    .colorrow ha-slider { flex: 1; min-width: 0; }
    .colorrow .opv { font-size: var(--fs-s); min-width: 34px; text-align: right; }
    .help-inline-label {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-1);
    }
    hp-dialog .body .help-inline-label > label {
      min-width: 0;
      margin-top: 0;
      overflow-wrap: anywhere;
    }
    .planrow {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    /* the "already uploaded" picker: a plan is never deleted for being
       unreferenced, so it has to be findable again */
    .savedplans {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      max-height: 240px;
      overflow: auto;
      margin: var(--sp-3) 0 var(--sp-1);
      padding: var(--sp-3);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
      background: var(--hp-bg2, rgba(255, 255, 255, 0.03));
      /* The same collapse that ate .candlist (v1.53.1): a scroll box is a
         flex item whose automatic minimum size is ZERO (overflow != visible),
         so inside hp-dialog .body — a flex column taller than its 66vh cap —
         it shrank to a 14px sliver: the rows were in the DOM, the owner saw
         a thin rounded stripe under the "Already uploaded" button. Don't
         shrink, and keep a floor even when the box is empty or loading. */
      flex: 0 0 auto;
      min-height: 2.6em;
    }
    .savedplan {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .savedplan.cur { outline: 1px solid var(--hp-accent); border-radius: var(--rad-s); }
    .savedplan img {
      width: 56px;
      height: 40px;
      object-fit: contain;
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      background: #fff;
      flex: none;
    }
    .savedmeta { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .savedmeta b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .savedmeta .muted { font-size: var(--fs-s); }
    .savedplan .btn.danger ha-icon { color: #f25a4a; }
    .savedplan .btn[disabled] { opacity: 0.4; pointer-events: none; }
    .planprev {
      max-width: 120px;
      max-height: 70px;
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      background: #fff;
    }
    .planname {
      font-size: var(--fs-m);
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .planname.muted {
      color: var(--hp-muted);
    }
    .filebtn {
      cursor: pointer;
    }
    .btn.danger {
      border-color: #b3402a;
      color: #ff7a5c;
    }
    hp-dialog .row .spacer {
      flex: 1;
    }
    hp-dialog .body {
      max-height: 66vh;
      overflow-y: auto;
    }
    /* #600 К6: у диалогов настроек (атрибут form-shell) скроллит оболочка (.content в
       hp-dialog), тело формы высотой не владеет — иначе на классических полосах
       Windows видны две. Канва — --secondary-background-color, карточки на ней
       белые (§3.1 «Тело»). */
    hp-dialog[form-shell] .body {
      max-height: none;
      overflow: visible;
      padding: 16px;
      box-sizing: border-box;
      background: var(--hpf-canvas, var(--secondary-background-color, color-mix(in srgb, var(--card-background-color, var(--hp-bg, #202126)) 90%, var(--primary-text-color, #000))));
    }
    hp-dialog[form-shell][ha-dialog-shell] .body { min-height: 100%; }
    @media (max-width: 480px) {
      hp-dialog[form-shell] .body { padding: 12px; }
    }
    hp-confirm {
      display: contents;
    }
    hp-dialog .danger-confirm-body {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
    }
    hp-dialog .danger-confirm-body p {
      margin: 0;
      line-height: 1.45;
    }
    hp-dialog .danger-confirm-object {
      overflow-wrap: anywhere;
      font-size: var(--fs-l);
      line-height: 1.3;
    }
    .curbind {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      font-size: var(--fs-m);
      color: var(--hp-txt);
      flex-wrap: wrap;
    }
    .curbind .ref {
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    .vaccalbar {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      display: flex;
      gap: var(--sp-5);
      align-items: center;
      background: var(--hp-bg);
      color: var(--hp-txt);
      border: 1px solid var(--hp-accent);
      border-radius: var(--rad-l);
      padding: 10px var(--sp-5);
      z-index: 60;
      box-shadow: var(--shadow-2);
    }
    .cand {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-4);
      padding: var(--sp-3) var(--sp-4);
      cursor: pointer;
      border-radius: var(--rad-s);
      font-size: var(--fs-m);
    }
    :host([data-pointer-hover]) .cand:hover {
      background: rgba(127, 127, 127, 0.15);
    }
    .cand.sel {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    .cand .cs {
      color: var(--hp-muted);
      font-size: var(--fs-s);
      white-space: nowrap;
    }
    .cand.sel .cs {
      color: var(--text-primary-color, #fff);
      opacity: 0.85;
    }
    .cand.muted {
      color: var(--hp-muted);
      cursor: default;
    }
    .entlist {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      margin-bottom: 10px;
    }
    .entrow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-3) var(--sp-4);
      border-radius: var(--rad-m);
      background: var(--secondary-background-color, rgba(128, 128, 128, 0.12));
    }
    .entrow ha-icon { --mdc-icon-size: 20px; color: var(--hp-muted); }
    .entrow.on ha-icon { color: var(--hp-accent); }
    .entrow .en { flex: 1; font-size: var(--fs-m); }
    .entrow .ev { font-size: var(--fs-m); color: var(--hp-muted); }
    .entbtn {
      min-width: 74px;
      min-height: 32px;
      padding: var(--sp-2) var(--sp-5);
      border: 1px solid var(--hp-muted);
      border-radius: 999px;
      background: transparent;
      color: var(--hp-txt);
      font: inherit;
      font-size: var(--fs-m);
      cursor: pointer;
    }
    .entbtn.on {
      background: var(--hp-accent);
      border-color: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      font-weight: 600;
    }
    .inforow {
      display: flex;
      gap: 10px;
      font-size: var(--fs-m);
      margin: var(--sp-2) 0;
    }
    .inforow .k {
      color: var(--hp-muted);
      min-width: 84px;
    }
    .inforow a {
      color: var(--hp-accent);
      word-break: break-all;
    }
    .infodesc {
      font-size: var(--fs-m);
      white-space: pre-wrap;
      margin-top: var(--sp-3);
    }
    .infodesc.muted {
      color: var(--hp-muted);
    }
    .pdflist {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }
    .pdf {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      color: var(--hp-accent);
      text-decoration: none;
    }
    ha-icon-picker {
      display: block;
    }
    .floorrow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-3) var(--sp-2);
      font-size: var(--fs-m);
      cursor: pointer;
    }
    .floorrow .floorlvl {
      color: var(--hp-muted);
      font-size: var(--fs-s);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      padding: 0 var(--sp-3);
    }
    .btn.alignall { width: 100%; justify-content: center; }
    .backupactions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-3);
    }
    .backupactions .btn { justify-content: center; min-width: 0; }
    .backupcounts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-2) var(--sp-4);
      font-size: var(--fs-s);
    }
    .backupwarn, .backuperror {
      border-radius: var(--rad-s);
      padding: var(--sp-3);
      font-size: var(--fs-s);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .backupwarn { background: color-mix(in srgb, var(--hp-accent) 12%, transparent); }
    .backuperror { background: rgba(179, 64, 42, .16); color: #ff7a5c; }
    @media (max-width: 520px) {
      .backupactions, .backupcounts { grid-template-columns: 1fr; }
    }
    hp-dialog .body {
      padding: var(--sp-5) var(--sp-6);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
    hp-dialog .tapconfirm-body {
      min-width: 0;
      overflow-x: hidden;
    }
    hp-dialog .tapconfirm-body p {
      max-width: 100%;
      min-width: 0;
      margin: 0;
      overflow-wrap: anywhere;
      white-space: normal;
    }
    hp-dialog .tapconfirm-line {
      color: var(--hp-muted);
    }
    hp-dialog .body label {
      font-size: var(--fs-s);
      color: var(--hp-muted);
      margin-top: var(--sp-3);
    }
    hp-dialog .row {
      display: flex;
      justify-content: flex-end;
      gap: var(--sp-4);
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      padding: var(--sp-5) var(--sp-6);
      border-top: 1px solid var(--hp-line);
    }
    hp-dialog > .row[slot='footer'] button {
      min-height: 44px;
    }
    /* Stable destructive/commit footer contract.  A flex spacer cannot react
       when translated labels no longer fit: justify-content then overflows
       the destructive button through the left inset.  Two real groups wrap
       as units instead — destructive actions stay left, while Cancel/Save
       move together to a right-aligned second row when necessary. */
    hp-dialog .row.dialog-action-footer {
      align-items: center;
      justify-content: flex-start;
      flex-wrap: wrap;
      row-gap: var(--sp-4);
    }
    hp-dialog .dialog-action-group {
      display: flex;
      flex: 0 1 auto;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-4);
      max-width: 100%;
      min-width: 0;
    }
    hp-dialog .dialog-action-group .btn {
      flex: 0 0 auto;
      min-height: 44px;
    }
    hp-dialog .dialog-action-danger {
      margin-right: auto;
    }
    hp-dialog .dialog-action-commit {
      margin-left: auto;
      justify-content: flex-end;
    }
    /* #602: all four Space actions are one visual row.  Validation occupies a
       separate row without changing the order of the actions themselves. */
    hp-dialog .hpf-footer-space {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr) auto;
      align-items: center;
      column-gap: var(--sp-3);
      row-gap: var(--sp-2);
    }
    hp-dialog .hpf-footer-space .dialog-action-copy { grid-column: 1; grid-row: 2; }
    hp-dialog .hpf-footer-space .dialog-action-danger { grid-column: 2; grid-row: 2; margin-right: 0; }
    hp-dialog .hpf-footer-space .hpf-status { grid-column: 1 / -1; grid-row: 1; margin-left: 0; }
    hp-dialog .hpf-footer-space .hpf-status:empty { display: none; }
    hp-dialog .hpf-footer-space .dialog-action-commit { grid-column: 4; grid-row: 2; margin-left: 0; flex-wrap: nowrap; }
    hp-dialog .danger-confirm-footer .dialog-action-commit { flex-wrap: nowrap; }
    hp-dialog .danger-confirm-footer .btn { min-width: 0; white-space: normal; }
    /* Device info can have Edit + Open in HA + Close. It uses a wide dialog;
       wrapping remains as a phone fallback, but without a flex spacer (which
       used to strand Edit alone on the first line). */
    hp-dialog .row.infofooter {
      align-items: center;
      justify-content: flex-start;
      flex-wrap: wrap;
      gap: var(--sp-3);
    }
    hp-dialog .row.infofooter .btn {
      flex-shrink: 0;
    }
    hp-dialog .row.infofooter .infofooter-close {
      margin-left: auto;
    }
    @media (max-width: 480px) {
      hp-dialog .hpf-footer-space {
        grid-template-columns: 44px 44px minmax(0, 1fr) auto;
        column-gap: 6px;
        padding: var(--sp-4);
      }
      hp-dialog .hpf-footer-space .dialog-action-group { flex-wrap: nowrap; gap: 6px; }
      hp-dialog .hpf-footer-space .hpf-mobile-icon {
        box-sizing: border-box;
        width: 44px;
        min-width: 44px;
        padding-inline: 0;
        justify-content: center;
      }
      hp-dialog .hpf-footer-space .hpf-mobile-icon .hpf-action-label { display: none; }
      hp-dialog .hpf-footer-space .dialog-action-commit .btn {
        min-width: 0;
        padding-inline: 8px;
        white-space: normal;
      }
      hp-dialog .danger-confirm-footer .dialog-action-commit {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        width: 100%;
        margin-left: 0;
      }
      hp-dialog .danger-confirm-footer .dialog-action-commit .btn {
        width: 100%;
        padding-inline: 8px;
        line-height: 1.25;
      }
      hp-dialog .row.infofooter {
        padding: var(--sp-4) var(--sp-5);
      }
    }
`;
