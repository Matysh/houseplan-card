/** Dialogs, forms, buttons and pickers (#266, split from styles.ts). */
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
      .head .count { display: none; }
      .head .title { font-size: var(--fs-m); }
    }
    .count {
      font-size: var(--fs-s);
      color: var(--hp-muted);
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
    /* the compass dial in the general settings (docs/SUN.md) */
    .sunrow {
      display: flex;
      align-items: center;
      gap: var(--sp-5);
      margin: var(--sp-3) 0;
    }
    .suncol {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      min-width: 0;
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
    .bindharow {
      display: flex;
      align-items: center;
      gap: var(--sp-5);
      flex-wrap: wrap;
    }
    .bindharow .entcheck { opacity: 0.9; }
    .ctrlchips { display: flex; flex-wrap: wrap; gap: var(--sp-3); margin: var(--sp-2) 0; }
    .ctrlchip {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      background: var(--hp-accent); color: var(--text-primary-color, #fff);
      border-radius: var(--rad-l); padding: var(--sp-2) var(--sp-4); font-size: var(--fs-s);
    }
    .ctrlchip ha-icon { --mdc-icon-size: 14px; cursor: pointer; }
    .ctrllist { display: flex; flex-direction: column; gap: var(--sp-1); margin-top: var(--sp-2); }
    .ctrlopt {
      display: flex; align-items: center; gap: var(--sp-4); text-align: left;
      border: 0; background: transparent; color: var(--hp-txt);
      padding: var(--sp-3) var(--sp-4); border-radius: var(--rad-s); cursor: pointer; font-family: inherit; font-size: var(--fs-m);
    }
    :host([data-pointer-hover]) .ctrlopt:hover {
      background: var(--secondary-background-color, rgba(128,128,128,0.15));
    }
    .ctrlopt .sub { color: var(--hp-muted); font-size: var(--fs-s); margin-left: auto; }
    .ctrlopt ha-icon { --mdc-icon-size: 16px; }
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
    .iconauto {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      font-size: var(--fs-s);
      margin: var(--sp-2) 0 0;
    }
    .iconauto ha-icon { --mdc-icon-size: 18px; }
    .iconauto span { flex: 1; }
    .iconauto .btn { min-height: 32px; padding: 0 var(--sp-3); }
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
    .colorrow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
    }
    .gsrow > hp-color-opacity {
      min-width: min(100%, 210px);
      justify-content: space-between;
    }
    .ripple-colorrow > hp-color-opacity {
      width: 100%;
      justify-content: space-between;
    }
    .ripple-sizerow > .opl {
      min-width: 0;
    }
    .colorrow input[type='range'] { flex: 1; }
    .colorrow .tempin { width: 70px; flex: none; }
    /* beat the generic hp-dialog .body .namein { width:100% } rule */
    hp-dialog .body .temprange .tempin { width: 56px; flex: none; padding: var(--sp-2) var(--sp-3); }
    hp-dialog .body .colorrow .tempin { width: 72px; flex: none; }
    .srcrow { flex-wrap: nowrap; }
    /* native HA controls (rendered only when the HA frontend defines them;
       old HA and the smoke env keep the plain inputs). ha-switch is taller
       than a checkbox - cap its footprint so .srcrow keeps its rhythm. */
    .srcrow ha-switch { flex: none; }
    .colorrow ha-slider { flex: 1; min-width: 0; }
    .srcrow > span:first-of-type { white-space: nowrap; }
    .colorrow .opl { color: var(--hp-muted); font-size: var(--fs-s); }
    .colorrow .opv { font-size: var(--fs-s); min-width: 34px; text-align: right; }
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
    .markerhelpfield { margin-top: var(--sp-4); }
    .markerhelplabel {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-1);
      margin-bottom: var(--sp-1);
    }
    .markerhelplabel > label { min-width: 0; overflow-wrap: anywhere; }
    .helpfieldlabel {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-1);
      min-width: 0;
      margin-top: var(--sp-3);
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    .helpfieldlabel.compact { margin-top: 0; }
    hp-dialog .body .helpfieldlabel > label {
      min-width: 0;
      margin-top: 0;
      overflow-wrap: anywhere;
    }
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
    .markerradios { display: grid; gap: var(--sp-1); min-width: 0; }
    .markerlightgroup .srcrow > span:first-of-type {
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .markerglowvalue { margin: var(--sp-3) 0; flex-wrap: wrap; }
    .markerglowvalue hp-color-opacity { flex: none; }
    .markerlightdisabled {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      margin-top: var(--sp-2) !important;
    }
    .markerlightdisabled ha-icon { --mdc-icon-size: 18px; flex: none; }
    .markerbadgetechnical {
      min-width: 0;
      margin: var(--sp-1) 0 var(--sp-2) !important;
      overflow-wrap: anywhere;
    }
    .markerbadgetechnical code { white-space: normal; }
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
    .fileupload { display: inline-flex; min-width: 0; }
    .fileupload > input { display: none; }
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
    .descin {
      width: 100%;
      box-sizing: border-box;
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      color: var(--hp-txt);
      border-radius: var(--rad-s);
      padding: var(--sp-3) var(--sp-4);
      font-size: var(--fs-m);
      font-family: inherit;
      resize: vertical;
      /* flex column of the dialog body squeezes textareas — keep a usable height */
      min-height: 92px;
      flex-shrink: 0;
      line-height: 1.35;
    }
    .bindsel {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
      padding: var(--sp-4);
    }
    .bindsel .opt {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      border: 1px solid var(--hp-line);
      background: transparent;
      color: var(--hp-txt);
      border-radius: var(--rad-s);
      padding: var(--sp-3) var(--sp-4);
      cursor: pointer;
      font-size: var(--fs-m);
      font-family: inherit;
    }
    .bindsel .opt.on {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      border-color: var(--hp-accent);
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
    .vacbox .vacbtns { display: flex; gap: var(--sp-4); margin: var(--sp-3) 0; flex-wrap: wrap; }
    .vacdiag { display: grid; gap: 4px; margin-bottom: var(--sp-3); }
    .vacdiag > div { display: flex; justify-content: space-between; gap: var(--sp-5); }
    .vacdiag > div > span { color: var(--secondary-text-color); }
    .vacdiag > div > b { text-align: right; overflow-wrap: anywhere; }
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
    .cand.sel .cs {
      color: var(--text-primary-color, #fff);
      opacity: 0.85;
    }
    .cand.muted {
      color: var(--hp-muted);
      cursor: default;
    }
    .pdfedit {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-3);
      align-items: center;
    }
    .pdftag {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      padding: var(--sp-2) var(--sp-3);
      font-size: var(--fs-s);
    }
    .pdftag a {
      color: var(--hp-txt);
      text-decoration: none;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pdftag .x {
      --mdc-icon-size: 15px;
      cursor: pointer;
      color: var(--hp-muted);
    }
    :host([data-pointer-hover]) .pdftag .x:hover {
      color: #ff7a5c;
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
    .gsrow .gsl {
      min-width: 150px;
      font-size: var(--fs-m);
      color: var(--hp-muted);
    }
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
    .btn.alignall { width: 100%; justify-content: center; }
    .backupactions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-3);
    }
    .backupactions .btn { justify-content: center; min-width: 0; }
    .backupupload { display: inline-flex; min-width: 0; }
    .backupupload > .btn { width: 100%; justify-content: center; }
    .backupupload input { display: none; }
    .backupbody { min-width: 0; }
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
    @media (max-width: 520px) {
      .backupactions, .backupcounts { grid-template-columns: 1fr; }
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
    hp-dialog .supportbody {
      min-width: 0;
      overflow-x: hidden;
      gap: var(--sp-5);
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
    .supportmessage { min-height: 120px; }
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
    @media (max-width: 520px) {
      hp-dialog .supportbody { padding-inline: var(--sp-4); }
      hp-dialog .supportfooter { padding-inline: var(--sp-4); }
      .supportactions .btn, .supportactions .aboutlink { max-width: 100%; }
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
    hp-dialog .body .namein,
    hp-dialog .body .areasel {
      width: 100%;
      box-sizing: border-box;
    }
    /* Room settings contains long radio labels, two source pickers and live
       previews, so it deliberately uses hp-dialog's medium width. Keep its
       content shrinkable as well: the generic srcrow rule is nowrap because
       compact switch rows need it, but here that created a horizontal scroll
       box even on a wide desktop viewport. */
    hp-dialog.roomdialog .body {
      min-width: 0;
      overflow-x: hidden;
    }
    hp-dialog.roomdialog .body > * {
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
    }
    hp-dialog.roomdialog .srcrow {
      min-width: 0;
      align-items: flex-start;
    }
    hp-dialog.roomdialog .srcrow > span:first-of-type {
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
      line-height: 1.35;
    }
    hp-dialog.roomdialog .dropbtn > b,
    hp-dialog.roomdialog .dropbtn > .ref {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
    hp-dialog .row.markerfooter {
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
    }
    hp-dialog .row.roomfooter {
      align-items: center;
      flex-wrap: wrap;
    }
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
      hp-dialog .row.infofooter {
        padding: var(--sp-4) var(--sp-5);
      }
    }
    .markeractions,
    .markersaveactions {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
    }
    .markeractions:empty { display: none; }
    .markersaveactions { margin-left: auto; }
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
      .device-inbox-actions { grid-column: 1 / -1; justify-content: flex-start; }
    }
`;
