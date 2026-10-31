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
      flex-wrap: wrap;
    }
    @media (max-width:620px) { .head { gap:var(--sp-3); padding:var(--sp-4) 10px; } }
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
    :host([data-pointer-hover]) .btn:not(:disabled):hover {
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
      cursor: not-allowed;
    }
    .recoveryoverlay {
      position: absolute;
      inset: 0;
      /* Above the contextual editor tray (70): recovery is the one state in
         which every stage-editing surface must be inert. Dialogs live outside
         the stage and retain their own higher card-level stacking context. */
      z-index: 75;
      pointer-events:auto;
    }
    .editorloading { position:absolute; z-index:74; left:50%; top:50%; transform:translate(-50%,-50%); pointer-events:none; }
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
      flex-wrap: wrap;
      justify-content: center;
      max-width: 100%;
      align-items: center;
      gap: 0.3em;
      font-weight: 600;
      opacity: 0.85;
    }
    .cardpreview .cpco2 { display: inline-flex; align-items: center; white-space: nowrap; }
    .cardpreview .cpmeta ha-icon { --mdc-icon-size: 1.05em; }
    .planrow {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    /* the "already uploaded" picker: a plan is never deleted for being
       unreferenced, so it has to be findable again */
    .savedmeta { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .savedmeta b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .planname {
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .btn.danger {
      border-color: var(--error-color, #db4437);
      color: var(--error-color, #db4437);
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
    hp-dialog [data-confirm-key="remove-markers"] .danger-confirm-object {
      white-space: pre-line;
      max-height: 35vh;
      overflow-y: auto;
      font-size: var(--fs-m);
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
    .backupwarn, .backuperror {
      border-radius: var(--rad-s);
      padding: var(--sp-3);
      font-size: var(--fs-s);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .backupwarn { background: color-mix(in srgb, var(--hp-accent) 12%, transparent); }
    .backuperror { background: color-mix(in srgb, var(--error-color, #db4437) 16%, transparent); color: var(--error-color, #db4437); }
    hp-dialog .body {
      padding: var(--sp-5) var(--sp-6);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
    hp-dialog .body label {
      font-size: var(--fs-s);
      color: var(--hp-muted);
      margin-top: var(--sp-3);
    }
    hp-dialog .row {
      display: flex;
      gap: var(--sp-4);
      min-width: 0;
    }
    hp-dialog > .row[slot='footer'] {
      justify-content: flex-end;
      width: 100%;
      box-sizing: border-box;
      padding: var(--sp-5) var(--sp-6);
      border-top: 1px solid var(--hp-line);
    }
    hp-dialog > .row[slot='footer'] button {
      min-height: 44px;
    }
  .device-issue-groups { display:grid; gap:12px; margin-bottom:16px; }
`;
