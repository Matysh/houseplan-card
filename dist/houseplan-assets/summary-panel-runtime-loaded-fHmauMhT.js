globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="f00ccb2e025e4749d8b21b734ae6193bd0a556f441d56991773969a015d817ec";import{w as e,A as t,b as s,l as r,e8 as i,bb as a,ba as o}from"./houseplan-card-Bp1zKCs9.js";const n=Object.freeze({blocks:10,values:20,title:48,label:64}),l=e=>"string"==typeof e?e.trim():"",m=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),c=e=>!!e&&"object"==typeof e;function u(e){return`${e}-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`}function d(e){return{version:1,title:e("summary.default_title"),show_on_mobile:!0,blocks:[{id:"summary-default",title:e("summary.default_block"),visible:!0,scope:{type:"all"},values:[{id:"summary-device-count",label:e("summary.system.device_count"),source:{type:"system",key:"device_count"}},{id:"summary-total-area",label:e("summary.system.total_area"),source:{type:"system",key:"total_area"}},{id:"summary-datetime",label:e("summary.system.datetime"),source:{type:"system",key:"datetime"}}]}]}}function h(e){if(!c(e))return!1;const t=e;return!(1!==t.version||"string"!=typeof t.title||"boolean"!=typeof t.show_on_mobile||!Array.isArray(t.blocks))&&t.blocks.every(e=>{if(!c(e)||"string"!=typeof e.id||"string"!=typeof e.title||"boolean"!=typeof e.visible||!c(e.scope)||!Array.isArray(e.values))return!1;const t=e.scope;return("all"===t.type||"space"===t.type&&"string"==typeof t.space_id)&&e.values.every(e=>{if(!c(e)||"string"!=typeof e.id||"string"!=typeof e.label||!c(e.source))return!1;const t=e.source;return"entity"===t.type&&"string"==typeof t.entity_id||"system"===t.type&&"string"==typeof t.key&&["device_count","total_area","datetime"].includes(t.key)})})}function y(e){return structuredClone(e)}function p(e,t){return e.blocks.filter(e=>e.visible&&("all"===e.scope.type||"space"===e.scope.type&&e.scope.space_id===t))}function g(e,t,s,r){const i=[],a=function(e){const t=new Map,s=new Map;for(const r of e?.blocks||[]){"space"===r.scope.type&&t.set(r.id,r.scope.space_id);for(const e of r.values)"entity"===e.source.type&&s.set(e.id,e.source.entity_id)}return{scopes:t,sources:s}}(t),o=new Set,m=new Set,c=(e,t,s)=>{const r=l(e);r?(e=>[...e].length)(r)>t&&i.push({path:s,kind:"error",code:"limit"}):i.push({path:s,kind:"error",code:"required"})};return c(e.title,n.title,"title"),e.blocks.length>n.blocks&&i.push({path:"blocks",kind:"error",code:"limit"}),e.blocks.forEach((e,t)=>{const u=`blocks.${t}`;if(c(e.id,n.label,`${u}.id`),c(e.title,n.title,`${u}.title`),o.has(e.id)&&i.push({path:`${u}.id`,kind:"error",code:"duplicate_id"}),o.add(e.id),"space"===e.scope.type){const t=l(e.scope.space_id);t?s.has(t)||i.push({path:`${u}.scope`,kind:a.scopes.get(e.id)===t?"warning":"error",code:"missing_space"}):i.push({path:`${u}.scope`,kind:"error",code:"required"})}else"all"!==e.scope.type&&i.push({path:`${u}.scope`,kind:"error",code:"required"});e.values.length>n.values&&i.push({path:`${u}.values`,kind:"error",code:"limit"}),e.values.forEach((e,t)=>{const s=`${u}.values.${t}`;if(c(e.id,n.label,`${s}.id`),c(e.label,n.label,`${s}.label`),m.has(e.id)&&i.push({path:`${s}.id`,kind:"error",code:"duplicate_id"}),m.add(e.id),"entity"===e.source.type){const t=l(e.source.entity_id);t?r.has(t)||i.push({path:`${s}.source`,kind:a.sources.get(e.id)===t?"warning":"error",code:"missing_entity"}):i.push({path:`${s}.source`,kind:"error",code:"required"})}else"system"===e.source.type&&["device_count","total_area","datetime"].includes(e.source.key)||i.push({path:`${s}.source`,kind:"error",code:"invalid_source"})})}),i}function f(e){return{...e,version:1,title:l(e.title),show_on_mobile:!1!==e.show_on_mobile,blocks:e.blocks.map(e=>({...e,id:l(e.id),title:l(e.title),visible:!1!==e.visible,scope:"space"===e.scope.type?{...e.scope,type:"space",space_id:l(e.scope.space_id)}:{...e.scope,type:"all"},values:e.values.map(e=>({...e,id:l(e.id),label:l(e.label),source:"entity"===e.source.type?{...e.source,type:"entity",entity_id:l(e.source.entity_id)}:{...e.source,type:"system",key:e.source.key}}))}))}}function b(e){const t=e.showOnMobile||!1===e.narrow;return e.view&&e.localShow&&t&&e.fits}function v(e){const t=Number(e);return Number.isFinite(t)?Math.max(.5,Math.min(3,Math.round(20*t)/20)):1}function _(e,t){return JSON.stringify(e)===JSON.stringify(t)}function w(e,t,s){if(t<0||t>=e.length||s<0||s>=e.length||t===s)return[...e];const r=[...e],[i]=r.splice(t,1);return r.splice(s,0,i),r}function x(e){return{id:u("b"),title:e("summary.new_block"),visible:!0,scope:{type:"all"},values:[]}}function k(e){return{id:u("v"),label:"",source:{type:"entity",entity_id:""}}}const S=String.raw`
  hp-dialog[data-kind='summary'] {
    --hp-dialog-wide-width: 920px;
    --ha-dialog-width-md: 920px;
    --summary-editor-surface: var(--card-background-color, #fff);
    --summary-editor-muted: color-mix(in srgb, var(--summary-editor-surface) 96%, var(--primary-text-color, #303638));
    --summary-editor-line: var(--divider-color, #dce5e7);
    --summary-editor-accent: var(--primary-color, var(--hp-accent));
    --summary-editor-accent-soft: color-mix(in srgb, var(--summary-editor-surface) 94%, var(--summary-editor-accent));
  }
  hp-dialog[data-kind='summary'] .summary-editor {
    box-sizing: border-box;
    container: summary-editor / inline-size;
    width: 100%;
    min-width: 0;
    min-height: 0;
    max-height: none;
    padding: 14px 17px 18px;
    gap: 12px;
    flex: 1 1 auto;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    color: var(--primary-text-color);
    background: var(--summary-editor-muted);
    font-size: .875rem;
    line-height: 1.4;
  }
  .summary-editor *,
  .summary-editor-footer * { box-sizing: border-box; }
  .summary-editor h3 { margin: 0; font-size: 1rem; line-height: 1.3; }
  .summary-editor p { margin: 0; overflow-wrap: anywhere; }
  .summary-general,
  .summary-blocks-card {
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--summary-editor-line);
    border-radius: 11px;
    background: var(--summary-editor-surface);
  }
  .summary-general-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 18px;
    margin-top: 12px;
  }
  .summary-general-grid:has(> .summary-switch:only-child) { grid-template-columns: minmax(0, 1fr); }
  .summary-editor .summary-field { min-width: 0; }
  .summary-editor .summary-field > label {
    display: block;
    margin: 0 0 5px;
    color: var(--secondary-text-color);
    font-size: .8125rem;
    font-weight: 600;
  }
  .summary-editor input[type='text'],
  .summary-editor input[type='search'],
  .summary-editor select {
    display: block;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 44px;
    margin: 0;
    padding: 8px 10px;
    color: var(--primary-text-color);
    background: var(--summary-editor-surface);
    border: 1px solid var(--summary-editor-line);
    border-radius: 7px;
    font: inherit;
    font-size: .875rem;
    line-height: 1.4;
  }
  .summary-editor select { cursor: pointer; }
  .summary-editor [aria-invalid='true'] {
    border-color: var(--error-color, #db4437);
  }
  .summary-editor input:focus-visible,
  .summary-editor select:focus-visible,
  .summary-editor button:focus-visible,
  .summary-editor-footer button:focus-visible {
    outline: 2px solid var(--summary-editor-accent);
    outline-offset: 2px;
  }
  .summary-editor button { font: inherit; }
  .summary-editor button:disabled,
  .summary-editor input:disabled,
  .summary-editor select:disabled { opacity: .4; cursor: default; }
  .summary-editor svg { display: block; flex: 0 0 auto; width: 20px; height: 20px; }
  .summary-editor .summary-switch {
    display: flex;
    min-width: 0;
    min-height: 54px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 0;
    color: var(--primary-text-color);
    cursor: pointer;
  }
  .summary-switch-caption { display: grid; min-width: 0; gap: 3px; }
  .summary-switch-caption strong { font-size: .875rem; font-weight: 600; overflow-wrap: anywhere; }
  .summary-switch-caption small { font-size: .8125rem; color: var(--secondary-text-color); overflow-wrap: anywhere; }
  /* The native checkbox itself is the visible 44px hit target. No hidden
     duplicate control or optimistic storage write is needed for the switch. */
  .summary-editor .summary-switch input {
    appearance: none;
    position: relative;
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }
  .summary-switch input::before {
    content: '';
    position: absolute;
    width: 36px;
    height: 22px;
    inset: 11px 4px;
    border: 1px solid var(--summary-editor-line);
    border-radius: 12px;
    background: color-mix(in srgb, var(--summary-editor-surface) 65%, var(--secondary-text-color));
  }
  .summary-switch input::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    top: 14px;
    left: 7px;
    border-radius: 50%;
    background: var(--text-primary-color, #fff);
    box-shadow: 0 1px 2px rgb(0 0 0 / 20%);
  }
  .summary-switch input:checked::before {
    background: var(--summary-editor-accent);
    border-color: var(--summary-editor-accent);
  }
  .summary-switch input:checked::after { left: 21px; }
  .summary-switch:has(input:disabled) { cursor: default; }
  .summary-switch:has(input:disabled) .summary-switch-caption { opacity: .6; }
  .summary-blocks-heading {
    display: flex;
    min-width: 0;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-bottom: 12px;
  }
  .summary-blocks-heading > div { min-width: 0; flex: 1 1 220px; }
  .summary-blocks-heading p { margin-top: 4px; color: var(--secondary-text-color); font-size: .8125rem; }
  .summary-block-count {
    padding: 4px 8px;
    border-radius: 10px;
    color: var(--primary-text-color);
    background: var(--summary-editor-accent-soft);
    font-size: .75rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .summary-editor-blocks { display: grid; min-width: 0; gap: 10px; }
  .summary-editor-block {
    min-width: 0;
    border: 1px solid var(--summary-editor-line);
    border-radius: 10px;
    background: var(--summary-editor-muted);
  }
  .summary-block-head {
    display: grid;
    grid-template-columns: 44px 92px minmax(0, 1fr) 44px;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px;
    border-bottom: 1px solid var(--summary-editor-line);
    border-radius: 10px 10px 0 0;
    background: var(--summary-editor-surface);
  }
  .summary-editor .summary-block-title { font-weight: 700; }
  .summary-order { display: grid; grid-template-columns: repeat(2, 44px); gap: 4px; }
  .summary-icon-button,
  .summary-drag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    min-width: 44px;
    height: 44px;
    padding: 0;
    color: var(--secondary-text-color);
    border: 1px solid var(--summary-editor-line);
    border-radius: 7px;
    background: var(--summary-editor-surface);
    cursor: pointer;
  }
  .summary-drag { border: 0; background: transparent; cursor: grab; user-select: none; }
  .summary-drag:active { cursor: grabbing; }
  .summary-drag[draggable='false'] { cursor: default; }
  .summary-icon-button:hover:not(:disabled) {
    color: var(--summary-editor-accent);
    border-color: var(--summary-editor-accent);
    background: var(--summary-editor-accent-soft);
  }
  .summary-visibility[aria-pressed='true'] {
    color: var(--summary-editor-accent);
    border-color: color-mix(in srgb, var(--summary-editor-line) 45%, var(--summary-editor-accent));
    background: var(--summary-editor-accent-soft);
  }
  .summary-scope {
    display: grid;
    grid-column: 3 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    min-width: 0;
  }
  .summary-scope > select:only-child { grid-column: 1 / -1; }
  .summary-block-title-error,
  .summary-scope-problem { grid-column: 3 / -1; }
  .summary-block-body { min-width: 0; padding: 10px; }
  .summary-editor-values { display: grid; min-width: 0; gap: 7px; }
  .summary-editor-value {
    display: grid;
    grid-template-columns: 44px 92px minmax(0, .9fr) minmax(0, 1.2fr) 44px;
    align-items: start;
    min-width: 0;
    padding: 5px;
    gap: 7px;
    border: 1px solid var(--summary-editor-line);
    border-radius: 8px;
    background: var(--summary-editor-surface);
  }
  .summary-value-label,
  .summary-source-field { min-width: 0; }
  .summary-source {
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 44px;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 9px;
    color: var(--primary-text-color);
    text-align: left;
    border: 1px solid var(--summary-editor-line);
    border-radius: 7px;
    background: var(--summary-editor-surface);
    cursor: pointer;
  }
  .summary-source-caption { display: grid; min-width: 0; gap: 2px; }
  .summary-source-caption strong { font-size: .875rem; font-weight: 600; overflow-wrap: anywhere; }
  .summary-source-caption small { color: var(--secondary-text-color); font-size: .75rem; overflow-wrap: anywhere; }
  .summary-editor .summary-value-remove {
    color: var(--error-color, #db4437);
    border-color: transparent;
    background: color-mix(in srgb, var(--summary-editor-surface) 94%, var(--error-color, #db4437));
  }
  .summary-editor .summary-value-remove:hover:not(:disabled) { border-color: var(--error-color, #db4437); }
  .summary-source-picker {
    min-width: 0;
    margin-top: 7px;
    padding: 10px;
    border: 1px solid var(--summary-editor-line);
    border-radius: 10px;
    background: var(--summary-editor-surface);
    box-shadow: 0 6px 18px rgb(0 0 0 / 18%);
  }
  .summary-editor .summary-source-picker > label {
    display: block;
    margin: 0 0 5px;
    font-size: .8125rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .summary-source-results {
    display: grid;
    max-height: min(360px, 48vh);
    margin-top: 8px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .summary-source-results button {
    display: grid;
    min-width: 0;
    min-height: 44px;
    padding: 7px 9px;
    align-content: center;
    color: var(--primary-text-color);
    text-align: left;
    overflow-wrap: anywhere;
    background: transparent;
    border: 0;
    border-radius: 7px;
    cursor: pointer;
  }
  .summary-source-results button:hover:not(:disabled),
  .summary-source-results button[aria-selected='true'] { background: var(--summary-editor-accent-soft); }
  .summary-source-results button.broken { color: var(--warning-color, #f59e0b); }
  .summary-source-results small { color: var(--secondary-text-color); font-size: .75rem; overflow-wrap: anywhere; }
  .summary-source-group {
    padding: 9px 8px 4px;
    color: var(--secondary-text-color);
    font-size: .8125rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .summary-refine { padding: 9px; color: var(--secondary-text-color); overflow-wrap: anywhere; }
  .summary-problem { margin: 5px 0; font-size: .8125rem; overflow-wrap: anywhere; }
  .summary-problem.error { color: var(--error-color, #db4437); }
  .summary-problem.warning { color: var(--warning-color, #f59e0b); }
  .summary-local-hint { color: var(--secondary-text-color); }
  .summary-block-footer { display: flex; justify-content: flex-end; margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--summary-editor-line); }
  .summary-delete-block {
    min-width: 44px;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid color-mix(in srgb, var(--summary-editor-line) 35%, var(--error-color, #db4437));
    border-radius: 7px;
    color: var(--error-color, #db4437);
    background: var(--summary-editor-surface);
    white-space: normal;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  .summary-add {
    display: inline-flex;
    min-width: 44px;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 8px 12px;
    border: 1px dashed color-mix(in srgb, var(--summary-editor-line) 40%, var(--summary-editor-accent));
    border-radius: 8px;
    color: var(--summary-editor-accent);
    background: var(--summary-editor-accent-soft);
    white-space: normal;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  .summary-editor .summary-add,
  .summary-editor .summary-delete-block { font-weight: 600; }
  .summary-add-value { width: 100%; }
  .summary-add-block { margin-top: 10px; }
  .summary-add:hover:not(:disabled) { border-style: solid; }
  .summary-delete-block:hover:not(:disabled) { background: color-mix(in srgb, var(--summary-editor-surface) 94%, var(--error-color, #db4437)); }
  .summary-reload { margin-top: 8px; min-height: 44px; white-space: normal; }
  hp-dialog[data-kind='summary'] .summary-editor-footer {
    min-height: 66px;
    padding: 11px 17px;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
    border-top: 1px solid var(--summary-editor-line);
    background: var(--summary-editor-surface);
  }
  hp-dialog[data-kind='summary'] .summary-editor-footer button {
    min-width: 44px;
    min-height: 44px;
    height: auto;
    margin: 0;
    padding: 9px 14px;
    border: 1px solid var(--summary-editor-line);
    border-radius: 8px;
    color: var(--primary-text-color);
    background: var(--summary-editor-surface);
    font-size: .875rem;
    line-height: 1.4;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  hp-dialog[data-kind='summary'] .summary-editor-footer button.on {
    border-color: var(--summary-editor-accent);
    color: var(--text-primary-color, #fff);
    background: var(--summary-editor-accent);
  }
  hp-dialog[data-kind='summary'] .summary-editor-footer button:disabled { opacity: .4; cursor: default; }
  @container summary-editor (max-width: 800px) {
    .summary-general-grid { grid-template-columns: minmax(0, 1fr); }
    .summary-editor-value { grid-template-columns: 44px 92px minmax(0, 1fr) 44px; }
    .summary-value-label { grid-column: 3; }
    .summary-source-field { grid-column: 3; }
    .summary-value-remove { grid-column: 4; grid-row: 1; }
    .summary-scope { grid-template-columns: minmax(0, 1fr); }
  }
  @container summary-editor (max-width: 480px) {
    .summary-general,
    .summary-blocks-card { padding: 10px; }
    .summary-block-head { grid-template-columns: 44px minmax(0, 1fr) 44px; }
    .summary-block-head > .summary-order { grid-column: 2; }
    .summary-block-title { grid-column: 1 / 3; grid-row: 2; }
    .summary-visibility { grid-column: 3; grid-row: 2; }
    .summary-scope,
    .summary-block-title-error,
    .summary-scope-problem { grid-column: 1 / -1; }
    .summary-editor-value { grid-template-columns: 44px minmax(0, 1fr) 44px; }
    .summary-editor-value > .summary-order { grid-column: 2; }
    .summary-value-label { grid-column: 1 / -1; grid-row: 2; }
    .summary-source-field { grid-column: 1 / -1; grid-row: 3; }
    .summary-value-remove { grid-column: 3; grid-row: 1; }
  }
`,M=String.raw`
  .summary-control {
    display: inline-flex;
    flex: 0 0 auto;
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    overflow: hidden;
    background: var(--card-background-color, #fff);
  }
  .summary-control > button {
    width: 46px;
    height: 46px;
    margin: 0;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-right: 1px solid var(--divider-color);
    color: var(--primary-text-color);
    background: transparent;
    cursor: pointer;
    transition: background-color 160ms ease;
  }
  .summary-control > button:last-child { border-right: 0; }
  .summary-control > button:hover { background: var(--secondary-background-color); }
  .summary-control > button.on {
    color: var(--text-primary-color, #fff);
    background: var(--primary-color);
  }
  .summary-control > button:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: -3px;
  }
  svg.summary-icon {
    display: block;
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
    fill: none;
  }
  .summary-control.kiosk {
    position: absolute;
    z-index: 31;
    top: calc(12px + env(safe-area-inset-top));
    right: calc(12px + env(safe-area-inset-right));
    box-shadow: 0 4px 14px rgb(0 0 0 / 22%);
  }
  .summary-overlay,
  .summary-measure {
    box-sizing: border-box;
    font-size: .875rem;
    line-height: 1.35;
    color: var(--primary-text-color);
    background: var(--secondary-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 12px;
    box-shadow: 0 8px 26px rgb(0 0 0 / 16%);
  }
  .summary-overlay {
    position: absolute;
    z-index: 24;
    display: flex;
    flex-direction: column;
    height: fit-content;
    max-height: var(--summary-height-cap);
    overflow: hidden;
    pointer-events: auto;
    touch-action: pan-y;
  }
  .summary-overlay[inert] { pointer-events: none; }
  .summary-overlay.right {
    top: var(--summary-top);
    right: calc(12px + env(safe-area-inset-right));
    bottom: auto;
    width: max-content;
    min-width: min(280px, var(--summary-width-cap));
    max-width: min(420px, var(--summary-width-cap));
  }
  .summary-overlay.bottom {
    right: auto;
    bottom: var(--summary-bottom);
    left: 50%;
    width: max-content;
    min-width: min(360px, var(--summary-width-cap));
    max-width: var(--summary-width-cap);
    transform: translateX(-50%);
  }
  .summary-overlay h2,
  .summary-measure h2 {
    box-sizing: border-box;
    flex: 0 0 auto;
    min-height: 48px;
    margin: 0;
    padding: 14px;
    font-size: 1rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
    background: var(--card-background-color, #fff);
    border-bottom: 1px solid var(--divider-color);
  }
  .summary-scroll {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 10px;
  }
  .summary-block {
    min-width: 0;
    margin: 0 0 9px;
    border: 1px solid var(--divider-color);
    border-radius: 11px;
    background: var(--card-background-color, #fff);
  }
  .summary-block:last-child { margin-bottom: 0; }
  .summary-block h3 {
    box-sizing: border-box;
    min-height: 43px;
    margin: 0;
    padding: 12px 14px;
    border-bottom: 1px solid var(--divider-color);
    font-size: .875rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .summary-value {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, auto);
    gap: 10px;
    align-items: baseline;
    min-height: 36px;
    margin: 0 11px;
    padding: 8px 0;
    border-bottom: 1px solid var(--divider-color);
  }
  .summary-value:last-child { border-bottom: 0; }
  .summary-value span,
  .summary-value strong { min-width: 0; overflow-wrap: anywhere; }
  .summary-value span { color: var(--secondary-text-color); }
  .summary-value strong { text-align: right; font-weight: 700; }
  /* Значение появляется плавно, а не скачком после скелета (#509). */
  .summary-value strong:not(.summary-value-pending) { animation: summary-value-in 140ms ease both; }
  /* Скелет: прямоугольник в высоту строки на месте значения. Плашка, сетка и
     высота строки те же, что с готовым значением, — панель не прыгает. */
  .summary-value-pending {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 1.2em;
  }
  .summary-value-pending i {
    display: block;
    width: 4.5em;
    max-width: 100%;
    height: 1.2em;
    border-radius: 5px;
    background: var(--secondary-text-color, #7a7f87);
    opacity: 0.18;
    animation: summary-skeleton-pulse 1200ms ease-in-out infinite;
  }
  @keyframes summary-skeleton-pulse {
    0%, 100% { opacity: 0.12; }
    50% { opacity: 0.28; }
  }
  @keyframes summary-value-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    /* Прямоугольник остаётся — исчезает только моторика (#509). */
    .summary-value-pending i { animation: none; opacity: 0.18; }
    .summary-value strong:not(.summary-value-pending) { animation: none; }
  }
  .summary-empty { margin: 0; padding: 10px 11px; color: var(--secondary-text-color); }
  .summary-measure {
    position: fixed;
    z-index: -1;
    top: -10000px;
    left: -10000px;
    width: 280px;
    visibility: hidden;
    pointer-events: none;
  }
  .summary-safe-probe {
    position: fixed;
    z-index: -1;
    top: -10000px;
    left: -10000px;
    padding: env(safe-area-inset-top) env(safe-area-inset-right)
      env(safe-area-inset-bottom) env(safe-area-inset-left);
    visibility: hidden;
    pointer-events: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .summary-control > button { transition: none; }
  }
  ${S}
`,$=String.raw`
    /* #505: the summary form follows its own neutral, wide design. Keep
       every override scoped so the other editor/dialog surfaces stay intact. */
    :host([data-kind='summary']) ha-dialog {
      --ha-dialog-surface-background: var(--card-background-color, #fff);
      --ha-dialog-border-radius: 15px;
      --ha-icon-button-size: 44px;
      --dialog-box-shadow: inset 0 0 0 1px var(--divider-color, #dce5e7),
        0 18px 60px rgb(25 34 38 / 26%);
    }

    :host([data-kind='summary']) .surface {
      border: 1px solid var(--divider-color, #dce5e7);
      border-radius: 15px;
      box-shadow: 0 18px 60px rgb(25 34 38 / 26%);
    }

    :host([data-kind='summary']) .header {
      min-height: 70px;
      flex-shrink: 0;
      padding: 12px 17px;
      border-color: var(--divider-color, #dce5e7);
    }

    :host([data-kind='summary']) .title {
      font-size: 1.375rem;
      font-weight: 600;
    }

    :host([data-kind='summary']) .close {
      width: 44px;
      height: 44px;
      border-radius: 8px;
    }

    :host([data-kind='summary']) .content { flex: 1 1 auto; }
    :host([data-kind='summary']) .footer { flex-shrink: 0; }
`,z={settings:["M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065","M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"],sidebar:["M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12","M15 4l0 16"],eye:["M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0","M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"],eyeOff:["M10.585 10.587a2 2 0 0 0 2.829 2.828","M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87","M3 3l18 18"],plus:["M12 5l0 14","M5 12l14 0"],chevron:["M6 9l6 6l6 -6"],up:["M12 19V5m-6 6 6-6 6 6"],down:["M12 5v14m-6-6 6 6 6-6"],close:["m6 6 12 12M6 18 18 6"],grip:["M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01"]};function C(t){return e`<svg class="summary-icon" data-summary-icon=${t} viewBox="0 0 24 24"
    width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    ${z[t].map(t=>e`<path d=${t}></path>`)}
  </svg>`}class D{constructor(e){this.repaint=e,this.phase="hidden",this.wanted=!1,this.side=null,this.pending=!1,this.element=null,this.animation=null,this.timeout=null,this.media=null,this.generation=0,this.motionChanged=()=>{this.media?.matches&&(this.settle(this.wanted),this.repaint())}}get mounted(){return"hidden"!==this.phase}get interactive(){return this.wanted&&this.mounted}sync(e,t,s=!1){const r=null!==this.side&&this.side!==t;this.side=t,s||r?this.settle(e):e!==this.wanted&&(this.wanted=e,this.phase=e?"entering":this.mounted?"exiting":"hidden",this.pending=this.mounted)}updated(e){if(!this.pending)return void(this.element=this.mounted?e:null);if(!e)return;this.pending=!1;const t=e.ownerDocument.defaultView,s=t?.matchMedia?.("(prefers-reduced-motion: reduce)");if(!t||s?.matches||"function"!=typeof e.animate)return this.element=e,this.settle(this.wanted),void this.repaint();const r=this.element===e?t.getComputedStyle(e):null,i="bottom"===this.side?"0px 18px":"18px 0px",a={opacity:r?.opacity||"0",translate:r?.translate||i};this.cancel(),this.element=e;const o=this.generation;this.media=s||null,this.media?.addEventListener("change",this.motionChanged);const n=e.animate([a,{opacity:this.wanted?"1":"0",translate:this.wanted?"0px 0px":i}],{duration:190,easing:"ease",fill:"both"});this.animation=n;const l=()=>{o===this.generation&&n===this.animation&&(this.settle(this.wanted),this.repaint())};n.finished.then(l,()=>{}),this.timeout=setTimeout(l,250)}reset(){this.settle(!1),this.side=null}settle(e){this.cancel(),this.wanted=e,this.pending=!1,this.phase=e?"visible":"hidden",e||(this.element=null)}cancel(){this.generation++,this.animation?.cancel(),this.animation=null,null!==this.timeout&&clearTimeout(this.timeout),this.timeout=null,this.media?.removeEventListener("change",this.motionChanged),this.media=null}}const T={en:{"summary.default_title":"Summary","summary.default_block":"General","summary.system.device_count":"Device count","summary.system.total_area":"Total room area","summary.system.datetime":"Date and time","summary.new_block":"New block","summary.value_name":"Value name","summary.delete_block_title":"Delete block?","summary.delete_block_body":"This block contains values. It will be removed from the draft.","summary.save_failed":"Could not save the summary panel.","summary.conflict":"The configuration changed in another window. Load the current version to start again.","summary.reload_current":"Load current configuration","summary.unavailable":"Source unavailable","summary.empty_block":"No values in this block","summary.empty_space":"No values for this space","summary.measure_block":"Block","summary.measure_label":"Status","summary.controls":"Summary panel controls","summary.settings":"Summary panel settings","summary.show":"Show summary panel","summary.hide":"Hide summary panel","summary.hidden_mobile":"The panel is enabled locally but disabled on mobile","summary.hidden_narrow_unknown":"The panel is enabled locally and is waiting for Home Assistant to report the screen mode","summary.hidden_small":"The panel is enabled locally but this card is too small","summary.show_local":"Show panel on this card","summary.backend_required":"Update the House Plan integration to edit shared panel contents. Local display settings are still available.","summary.local_only":"You can change settings for this card. Shared panel contents are managed by an administrator.","summary.general_settings":"General settings","summary.blocks":"Blocks","summary.blocks_hint":"Arrange blocks, choose where they appear and add values.","summary.block_count":"{count} of {limit}","summary.show_local_hint":"The same setting as the show button in the House Plan header.","summary.show_mobile_hint":"Allow the panel in Home Assistant’s narrow screen mode.","summary.hide_block":"Hide block","summary.show_block":"Show block","summary.delete_block":"Delete block","summary.scope":"Show block in","summary.system_source":"System value","summary.no_search_results":"No matching entities","summary.refine_search":"More entities match. Refine the search to see them.","summary.current_source":"Current unavailable source","summary.storage_unavailable":"These screen settings work for this session but cannot be saved in this browser.","summary.load_failed":"Could not open the panel settings.","summary.unsupported_schema":"This panel was created by a newer House Plan version and cannot be shown here.","summary.panel_title":"Panel title","summary.show_mobile":"Display on mobile devices","summary.block_title":"Block title","summary.up":"Move up","summary.down":"Move down","summary.drag":"Drag to reorder","summary.select_source":"Select a source","summary.scope_all":"All spaces","summary.scope_space":"Specific space","summary.system_group":"System values","summary.entities_group":"Home Assistant entities","summary.search_entities":"Search entities by name or entity ID","summary.limit_values":"A block can contain up to 20 values","summary.add_value":"Add value","summary.limit_blocks":"The panel can contain up to 10 blocks","summary.add_block":"Add block","summary.problem.required":"Fill in this field.","summary.problem.limit":"The allowed limit has been exceeded.","summary.problem.duplicate_id":"This internal identifier is duplicated.","summary.problem.invalid_source":"Select a valid source.","summary.problem.missing_entity":"This entity is no longer available. Select another source to replace it.","summary.problem.missing_space":"This space is no longer available. Select another scope to replace it."},ru:{"summary.default_title":"Сводная информация","summary.default_block":"Общее","summary.system.device_count":"Количество устройств","summary.system.total_area":"Общая площадь комнат","summary.system.datetime":"Дата и время","summary.new_block":"Новый блок","summary.value_name":"Название показателя","summary.delete_block_title":"Удалить блок?","summary.delete_block_body":"В блоке есть показатели. Он будет удалён из черновика.","summary.save_failed":"Не удалось сохранить сводную панель.","summary.conflict":"Конфигурация изменилась в другом окне. Загрузите актуальную версию, чтобы начать заново.","summary.reload_current":"Загрузить актуальную конфигурацию","summary.unavailable":"Источник недоступен","summary.empty_block":"В этом блоке нет показателей","summary.empty_space":"Нет показателей для этого пространства","summary.measure_block":"Блок","summary.measure_label":"Состояние","summary.controls":"Управление сводной панелью","summary.settings":"Настройки сводной панели","summary.show":"Показать сводную панель","summary.hide":"Скрыть сводную панель","summary.hidden_mobile":"Панель включена локально, но отключена на мобильных устройствах","summary.hidden_narrow_unknown":"Панель включена локально и ожидает от Home Assistant информацию о режиме экрана","summary.hidden_small":"Панель включена локально, но карточка слишком мала","summary.show_local":"Показывать панель в этой карточке","summary.backend_required":"Обновите интеграцию House Plan, чтобы менять общее содержимое панели. Локальные настройки доступны.","summary.local_only":"Вы можете менять настройки этой карточки. Общим содержимым панели управляет администратор.","summary.general_settings":"Основные настройки","summary.blocks":"Блоки","summary.blocks_hint":"Настройте порядок, область отображения и показатели.","summary.block_count":"{count} из {limit}","summary.show_local_hint":"То же состояние, что у кнопки показа в шапке House Plan.","summary.show_mobile_hint":"Разрешает показ в узком режиме Home Assistant.","summary.hide_block":"Скрыть блок","summary.show_block":"Показать блок","summary.delete_block":"Удалить блок","summary.scope":"Где показывать блок","summary.system_source":"Системный показатель","summary.no_search_results":"Подходящие сущности не найдены","summary.refine_search":"Найдено больше сущностей. Уточните поиск, чтобы увидеть остальные.","summary.current_source":"Текущий недоступный источник","summary.storage_unavailable":"Настройки экрана действуют в этой сессии, но браузер не может их сохранить.","summary.load_failed":"Не удалось открыть настройки панели.","summary.unsupported_schema":"Эта панель создана в более новой версии House Plan и не может быть здесь показана.","summary.panel_title":"Название панели","summary.show_mobile":"Отображать на мобильных устройствах","summary.block_title":"Название блока","summary.up":"Выше","summary.down":"Ниже","summary.drag":"Перетащить для изменения порядка","summary.select_source":"Выберите источник","summary.scope_all":"Все пространства","summary.scope_space":"Определённое пространство","summary.system_group":"Системные показатели","summary.entities_group":"Сущности Home Assistant","summary.search_entities":"Поиск сущностей по названию или entity ID","summary.limit_values":"В блоке может быть не больше 20 показателей","summary.add_value":"Добавить значение","summary.limit_blocks":"В панели может быть не больше 10 блоков","summary.add_block":"Добавить блок","summary.problem.required":"Заполните это поле.","summary.problem.limit":"Превышено допустимое ограничение.","summary.problem.duplicate_id":"Внутренний идентификатор повторяется.","summary.problem.invalid_source":"Выберите корректный источник.","summary.problem.missing_entity":"Эта сущность больше недоступна. Выберите другой источник, чтобы заменить её.","summary.problem.missing_space":"Это пространство больше недоступно. Выберите другую область, чтобы заменить его."},de:{"summary.default_title":"Übersicht","summary.default_block":"Allgemein","summary.system.device_count":"Anzahl der Geräte","summary.system.total_area":"Gesamte Raumfläche","summary.system.datetime":"Datum und Uhrzeit","summary.new_block":"Neuer Block","summary.value_name":"Bezeichnung","summary.delete_block_title":"Block löschen?","summary.delete_block_body":"Dieser Block enthält Werte und wird aus dem Entwurf entfernt.","summary.save_failed":"Die Übersicht konnte nicht gespeichert werden.","summary.conflict":"Die Konfiguration wurde in einem anderen Fenster geändert. Laden Sie die aktuelle Version, um neu zu beginnen.","summary.reload_current":"Aktuelle Konfiguration laden","summary.unavailable":"Quelle nicht verfügbar","summary.empty_block":"Keine Werte in diesem Block","summary.empty_space":"Keine Werte für diesen Bereich","summary.measure_block":"Block","summary.measure_label":"Status","summary.controls":"Steuerung der Übersicht","summary.settings":"Einstellungen der Übersicht","summary.show":"Übersicht anzeigen","summary.hide":"Übersicht ausblenden","summary.hidden_mobile":"Die Übersicht ist lokal aktiv, aber auf Mobilgeräten deaktiviert","summary.hidden_narrow_unknown":"Die Übersicht ist lokal aktiv und wartet auf den Bildschirmmodus von Home Assistant","summary.hidden_small":"Die Übersicht ist lokal aktiv, aber diese Karte ist zu klein","summary.show_local":"Übersicht in dieser Karte anzeigen","summary.backend_required":"Aktualisieren Sie die House-Plan-Integration, um gemeinsame Inhalte zu bearbeiten. Lokale Einstellungen bleiben verfügbar.","summary.local_only":"Sie können Einstellungen dieser Karte ändern. Gemeinsame Inhalte verwaltet ein Administrator.","summary.general_settings":"Grundeinstellungen","summary.blocks":"Blöcke","summary.blocks_hint":"Reihenfolge, Anzeigebereiche und Werte festlegen.","summary.block_count":"{count} von {limit}","summary.show_local_hint":"Dieselbe Einstellung wie die Anzeigetaste im House-Plan-Kopfbereich.","summary.show_mobile_hint":"Erlaubt die Anzeige im schmalen Bildschirmmodus von Home Assistant.","summary.hide_block":"Block ausblenden","summary.show_block":"Block anzeigen","summary.delete_block":"Block löschen","summary.scope":"Block anzeigen in","summary.system_source":"Systemwert","summary.no_search_results":"Keine passenden Entitäten","summary.refine_search":"Weitere Entitäten stimmen überein. Verfeinern Sie die Suche, um sie zu sehen.","summary.current_source":"Aktuelle nicht verfügbare Quelle","summary.storage_unavailable":"Diese Bildschirmeinstellungen gelten für diese Sitzung, können aber in diesem Browser nicht gespeichert werden.","summary.load_failed":"Die Panel-Einstellungen konnten nicht geöffnet werden.","summary.unsupported_schema":"Dieses Panel wurde mit einer neueren House-Plan-Version erstellt und kann hier nicht angezeigt werden.","summary.panel_title":"Titel der Übersicht","summary.show_mobile":"Auf Mobilgeräten anzeigen","summary.block_title":"Blocktitel","summary.up":"Nach oben","summary.down":"Nach unten","summary.drag":"Zum Sortieren ziehen","summary.select_source":"Quelle auswählen","summary.scope_all":"Alle Bereiche","summary.scope_space":"Bestimmter Bereich","summary.system_group":"Systemwerte","summary.entities_group":"Home-Assistant-Entitäten","summary.search_entities":"Entitäten nach Name oder Entity-ID suchen","summary.limit_values":"Ein Block kann bis zu 20 Werte enthalten","summary.add_value":"Wert hinzufügen","summary.limit_blocks":"Die Übersicht kann bis zu 10 Blöcke enthalten","summary.add_block":"Block hinzufügen","summary.problem.required":"Füllen Sie dieses Feld aus.","summary.problem.limit":"Das zulässige Limit wurde überschritten.","summary.problem.duplicate_id":"Diese interne Kennung wird mehrfach verwendet.","summary.problem.invalid_source":"Wählen Sie eine gültige Quelle.","summary.problem.missing_entity":"Diese Entität ist nicht mehr verfügbar. Wählen Sie zum Ersetzen eine andere Quelle.","summary.problem.missing_space":"Dieser Bereich ist nicht mehr verfügbar. Wählen Sie zum Ersetzen einen anderen Geltungsbereich."},fr:{"summary.default_title":"Résumé","summary.default_block":"Général","summary.system.device_count":"Nombre d’appareils","summary.system.total_area":"Surface totale des pièces","summary.system.datetime":"Date et heure","summary.new_block":"Nouveau bloc","summary.value_name":"Nom de la valeur","summary.delete_block_title":"Supprimer le bloc ?","summary.delete_block_body":"Ce bloc contient des valeurs et sera supprimé du brouillon.","summary.save_failed":"Impossible d’enregistrer le panneau de résumé.","summary.conflict":"La configuration a changé dans une autre fenêtre. Chargez la version actuelle pour recommencer.","summary.reload_current":"Charger la configuration actuelle","summary.unavailable":"Source indisponible","summary.empty_block":"Aucune valeur dans ce bloc","summary.empty_space":"Aucune valeur pour cet espace","summary.measure_block":"Bloc","summary.measure_label":"État","summary.controls":"Commandes du panneau de résumé","summary.settings":"Paramètres du panneau de résumé","summary.show":"Afficher le panneau de résumé","summary.hide":"Masquer le panneau de résumé","summary.hidden_mobile":"Le panneau est activé localement mais désactivé sur mobile","summary.hidden_narrow_unknown":"Le panneau est activé localement et attend le mode d’écran de Home Assistant","summary.hidden_small":"Le panneau est activé localement mais cette carte est trop petite","summary.show_local":"Afficher le panneau dans cette carte","summary.backend_required":"Mettez à jour l’intégration House Plan pour modifier le contenu partagé. Les réglages locaux restent disponibles.","summary.local_only":"Vous pouvez modifier les réglages de cette carte. Le contenu partagé est géré par un administrateur.","summary.general_settings":"Paramètres généraux","summary.blocks":"Blocs","summary.blocks_hint":"Définissez l’ordre, les espaces d’affichage et les valeurs.","summary.block_count":"{count} sur {limit}","summary.show_local_hint":"Le même réglage que le bouton d’affichage dans l’en-tête de House Plan.","summary.show_mobile_hint":"Autorise l’affichage dans le mode écran étroit de Home Assistant.","summary.hide_block":"Masquer le bloc","summary.show_block":"Afficher le bloc","summary.delete_block":"Supprimer le bloc","summary.scope":"Afficher le bloc dans","summary.system_source":"Valeur système","summary.no_search_results":"Aucune entité correspondante","summary.refine_search":"D’autres entités correspondent. Affinez la recherche pour les afficher.","summary.current_source":"Source actuelle indisponible","summary.storage_unavailable":"Ces réglages d’écran s’appliquent à cette session, mais ce navigateur ne peut pas les enregistrer.","summary.load_failed":"Impossible d’ouvrir les paramètres du panneau.","summary.unsupported_schema":"Ce panneau a été créé par une version plus récente de House Plan et ne peut pas être affiché ici.","summary.panel_title":"Titre du panneau","summary.show_mobile":"Afficher sur les appareils mobiles","summary.block_title":"Titre du bloc","summary.up":"Monter","summary.down":"Descendre","summary.drag":"Faire glisser pour réorganiser","summary.select_source":"Sélectionner une source","summary.scope_all":"Tous les espaces","summary.scope_space":"Espace spécifique","summary.system_group":"Valeurs système","summary.entities_group":"Entités Home Assistant","summary.search_entities":"Rechercher par nom ou identifiant d’entité","summary.limit_values":"Un bloc peut contenir jusqu’à 20 valeurs","summary.add_value":"Ajouter une valeur","summary.limit_blocks":"Le panneau peut contenir jusqu’à 10 blocs","summary.add_block":"Ajouter un bloc","summary.problem.required":"Remplissez ce champ.","summary.problem.limit":"La limite autorisée est dépassée.","summary.problem.duplicate_id":"Cet identifiant interne est dupliqué.","summary.problem.invalid_source":"Sélectionnez une source valide.","summary.problem.missing_entity":"Cette entité n’est plus disponible. Sélectionnez une autre source pour la remplacer.","summary.problem.missing_space":"Cet espace n’est plus disponible. Sélectionnez une autre portée pour le remplacer."}};const R=new WeakMap,L=e=>null===e||"object"!=typeof e&&"function"!=typeof e?null:e;function I(e){return e}function E(e){const t=e.localName;return"string"==typeof t&&t?t:"node"}function A(e){const t=e,s=L(t.parentNode);if(s)return s;const r=L(t.host);if(r)return r;if("function"!=typeof t.getRootNode)return null;const i=L(t.getRootNode.call(e));return i&&i!==e?L(i.host):null}function q(e){const t=function(e){let t=e;for(let e=0;t&&e<16;e++){if("hui-card"===E(t))return t;t=A(t)}return e}(e),s=R.get(t);if(s)return s;const r=function(e){const t=[];let s=e;for(let e=0;s&&e<16;e++){const e=A(s);if(!e){t.unshift(E(s));break}const r=I(e).children,i=r?Array.from(r).indexOf(s):-1;t.unshift(`${E(s)}:${Math.max(0,i)}`),s=e}return t.join("/")||"root"}(t);return R.set(t,r),r}const B=(e,t)=>{const s=t?.attributes?.friendly_name;return"string"==typeof s&&s.trim()?s.trim():e};function N(e,t){const s=e||{},r=Object.keys(s);if(t&&r.length===t.labels.size){let e=!0;for(const i of r)if(t.labels.get(i)!==B(i,s[i])){e=!1;break}if(e)return t}const i=r.map(e=>{const t=B(e,s[e]);return{id:e,label:t,search:`${t}\n${e}`.toLocaleLowerCase()}}).sort((e,t)=>e.label.localeCompare(t.label)||e.id.localeCompare(t.id));return{entries:i,labels:new Map(i.map(e=>[e.id,e.label])),rebuilds:(t?.rebuilds||0)+1}}function H(e,t,s=100){const r=t.trim().toLocaleLowerCase(),i=r?e.entries.filter(e=>e.search.includes(r)):e.entries,a=Math.max(0,Math.floor(s));return{entries:i.slice(0,a),total:i.length,truncated:i.length>a}}var O=Object.freeze({__proto__:null,LoadedSummaryPanelRuntime:class{constructor(e){this.dialog=null,this.local={version:1,show:!1,icon_scale:1,font_scale:1},this.storageKey=null,this.stage={width:0,height:0,minimumHeight:162,controlTop:0},this.clock=new Date,this.clockTimer=0,this.deviceMemo=null,this.areaMemo=null,this.storageUnavailable=!1,this.clockContext="",this.editorRenderer=null,this.editorLoad=null,this.metricsModule=null,this.metricsLoad=null,this.metricsRefresh=0,this.areaSteps=null,this.areaStepsEpoch=-1,this.styleSheet=null,this.entityIndex=null,this.lifecycleGeneration=0,this.lifecycleIdentity="",this.connected=!1,this.presentation=new D(()=>this.host.requestUpdate()),this.dialogStyleSheet=null,this.styledDialogRoots=new WeakSet,this.translate=e=>this.t(e),this.host=e}get dialogOpen(){return!!this.dialog}entityIds(){return function(e){if(!e||!h(e))return[];const t=new Set;for(const s of e.blocks)for(const e of s.values){if("entity"!==e.source.type)continue;const s=l(e.source.entity_id);s&&t.add(s)}return[...t]}(this.config().config)}connect(){this.ensureStyle(),this.connected=!0,this.syncLifecycle(),this.loadLocal()}disconnect(){this.connected=!1,this.resetLifecycle()}leaveRoute(){this.resetLifecycle()}applyLocalScaleForCurrentIdentity(){const e=this.preferenceKey();return!!e&&(e!==this.storageKey&&this.loadLocal(),e===this.storageKey&&(this.host._kioskScale={icon:this.local.icon_scale,font:this.local.font_scale},!0))}visibility(e){if("hidden"===e)return this.clockTimer&&clearTimeout(this.clockTimer),this.clockTimer=0,this.syncPresentation(!0),void this.host.requestUpdate();this.clock=new Date,this.syncClock(),this.host.requestUpdate()}updated(){this.syncLifecycle(),this.syncNativeNarrow(),this.loadLocal(),this.measureLayout(),this.syncClock(),this.ensureDialogStyle(),this.presentation.updated(this.host.renderRoot.querySelector(".summary-overlay"))}willUpdate(){this.syncLifecycle()}observeHassComposition(){if(this.syncLifecycle(),!this.dialog||this.dialog.localOnly)return!1;const e=this.entityIndex;return this.refreshEntityIndex(),this.entityIndex!==e}resized(){this.measureLayout()}closeDialogIfIdle(){return!(!this.dialog||this.dialog.busy)&&(this.dialog=null,this.host.requestUpdate(),!0)}blocksOtherDialogs(){return!!this.dialog}saveScale(e){this.saveLocal({icon_scale:e.icon??this.local.icon_scale,font_scale:e.font??this.local.font_scale})}renderMeasure(){const e=this.config().config?.title;return e&&"view"===this.host._mode?s`<div class="summary-measure" aria-hidden="true" inert>
      <h2>${e}</h2><div class="summary-scroll"><section class="summary-block"><h3>${this.t("summary.measure_block")}</h3>
      <div class="summary-value"><span>${this.t("summary.measure_label")}</span>
        <strong>${this.t("summary.unavailable")}</strong></div></section></div>
    </div><div class="summary-safe-probe" aria-hidden="true" inert></div>`:t}renderPanel(){const e=this.config().config;if(this.syncPresentation(),!e)return t;const r=this.layout();if(!this.presentation.mounted)return t;this.ensureMetrics();const i=p(e,this.host._space),a=e=>e.stopPropagation();return s`<aside class="summary-overlay ${r.side}" aria-label=${e.title}
        data-phase=${this.presentation.phase} ?inert=${!this.presentation.interactive}
        aria-hidden=${this.presentation.interactive?"false":"true"}
        style="--summary-height-cap:${Math.floor(r.heightCap)}px;--summary-width-cap:${Math.floor(r.availableWidth)}px;--summary-top:${r.top}px;--summary-bottom:${r.bottom}px"
        @click=${a} @dblclick=${a} @pointerdown=${a} @pointerup=${a}
        @pointermove=${a} @wheel=${a}>
      <h2>${e.title}</h2>
      <div class="summary-scroll">
        ${i.length?i.map(e=>s`<section class="summary-block">
          <h3>${e.title}</h3>
          ${e.values.length?e.values.map(e=>{const t=this.valueState(e);return s`<div class="summary-value">
              <span>${e.label}</span>${"pending"===t.kind?s`<strong class="summary-value-pending" aria-hidden="true"><i></i></strong>`:s`<strong>${"ready"===t.kind?t.text:this.t("summary.unavailable")}</strong>`}
            </div>`}):s`<div class="summary-empty">${this.t("summary.empty_block")}</div>`}
        </section>`):s`<div class="summary-empty">${this.t("summary.empty_space")}</div>`}
      </div>
    </aside>`}renderControls(e=!1){if("view"!==this.host._mode)return t;const r=this.config(),i=this.layout(),a=this.local.show&&(r.unsupported?this.t("summary.unsupported_schema"):r.config?.show_on_mobile||!0!==this.host.narrow?r.config?.show_on_mobile||null!==this.host.narrow?i.fits?"":this.t("summary.hidden_small"):this.t("summary.hidden_narrow_unknown"):this.t("summary.hidden_mobile"))||this.t(this.local.show?"summary.hide":"summary.show"),o=e=>e.stopPropagation();return s`<div class="summary-control ${e?"kiosk":""}" role="group"
        aria-label=${this.t("summary.controls")} @click=${o} @dblclick=${o}
        @pointerdown=${o} @pointerup=${o} @pointermove=${o} @wheel=${o}>
      <button type="button" @click=${()=>{this.openDialog()}}
        title=${this.t("summary.settings")} aria-label=${this.t("summary.settings")}>
        ${C("settings")}
      </button>
      <button type="button" class=${this.local.show?"on":""}
        aria-pressed=${this.local.show?"true":"false"}
        title=${a} aria-label=${a}
        @click=${()=>this.saveLocal({show:!this.local.show})}>
        ${C("sidebar")}
      </button>
    </div>`}renderDialog(){return this.dialog&&this.editorRenderer?(this.dialog.localOnly||this.refreshEntityIndex(),this.editorRenderer({host:this.host,dialog:this.dialog,local:this.local,storageUnavailable:this.storageUnavailable,problems:this.problems(this.dialog),entityIndex:this.entityIndex||N({},null),setDialog:e=>{this.dialog=e,this.host.requestUpdate()},saveLocal:e=>this.saveLocal(e),mutate:e=>this.mutate(e),deleteBlock:e=>{this.deleteBlock(e)},dragStart:(e,t)=>this.dragStart(e,t),drop:(e,t)=>this.drop(e,t),sourceToken:e=>this.sourceToken(e),openSource:(e,t)=>this.openSource(e,t),closeSource:e=>this.closeSource(e),setSource:(e,t,s)=>this.setSource(e,t,s),save:()=>{this.saveDialog()},reload:()=>{this.reloadDialog()},close:()=>this.closeDialogIfIdle(),t:e=>this.t(e)})):t}t(e){return e.startsWith("summary.")?function(e,t){const s=e.toLowerCase().split("-")[0];return(T[s]||T.en)[t]||T.en[t]||t}(r(this.host.hass,this.host._config?.language),e):this.host._t(e)}ensureStyle(){const e=this.host.renderRoot;if(this.styleSheet&&e.adoptedStyleSheets.includes(this.styleSheet))return;const t=this.host.ownerDocument.defaultView?.CSSStyleSheet;if(t&&"adoptedStyleSheets"in e){const s=new t;return s.replaceSync(M),this.styleSheet=s,void(e.adoptedStyleSheets=[...e.adoptedStyleSheets,s])}if(e.querySelector("style[data-hp-summary]"))return;const s=this.host.ownerDocument.createElement("style");s.dataset.hpSummary="true",s.textContent=M,e.insertBefore(s,e.firstChild)}ensureDialogStyle(){const e=this.host.renderRoot.querySelector('hp-dialog[data-kind="summary"]')?.shadowRoot;if(!e||this.styledDialogRoots.has(e))return;const t=this.host.ownerDocument.defaultView?.CSSStyleSheet;if(t&&"adoptedStyleSheets"in e)this.dialogStyleSheet||(this.dialogStyleSheet=new t,this.dialogStyleSheet.replaceSync($)),e.adoptedStyleSheets=[...e.adoptedStyleSheets,this.dialogStyleSheet];else{const t=this.host.ownerDocument.createElement("style");t.dataset.hpSummaryShell="true",t.textContent=$,e.appendChild(t)}this.styledDialogRoots.add(e)}placementSlot(){return q(this.host)}preferenceKey(){return function(e){const t=l(e.userId),s=l(e.slot);return t&&s?`houseplan.summary-panel.v1:${[t,l(e.path)||"/",l(e.host)||"card",s].map(e=>encodeURIComponent(e)).join(":")}`:null}({userId:this.host.hass?.user?.id||this.host.hass?.user?.name,path:location.pathname,host:this.host.panelHost?"panel":"lovelace",slot:this.placementSlot()})}identity(){return JSON.stringify({key:this.preferenceKey(),user:this.host.hass?.user?.id||this.host.hass?.user?.name||"",route:location.pathname,host:this.host.panelHost?"panel":"lovelace",slot:this.placementSlot(),kiosk:this.host._kiosk,canManage:this.host._canManageConfiguration})}syncLifecycle(){const e=this.identity();this.lifecycleIdentity&&e!==this.lifecycleIdentity&&this.resetLifecycle(),this.lifecycleIdentity=e}resetLifecycle(){this.presentation.reset(),this.lifecycleGeneration++,this.dialog=null,this.entityIndex=null,this.deviceMemo=null,this.areaMemo=null,this.clockContext="",this.storageKey=null,this.storageUnavailable=!1,this.local={version:1,show:!1,icon_scale:1,font_scale:1},this.clockTimer&&clearTimeout(this.clockTimer),this.clockTimer=0,this.lifecycleIdentity=this.connected?this.identity():"",this.host.requestUpdate()}current(e){return this.connected&&e===this.lifecycleGeneration&&this.lifecycleIdentity===this.identity()}refreshEntityIndex(){this.entityIndex=N(this.host.hass?.states,this.entityIndex)}syncNativeNarrow(){if(this.host.panelHost)return;let e=this.host;for(let t=0;e&&t<12;t++){const t=e.getRootNode();if(e=e.parentNode||(t instanceof ShadowRoot?t.host:null),!e||e===this.host)continue;const s=e.narrow;if("boolean"==typeof s)return void(this.host.narrow!==s&&(this.host.narrow=s))}}loadLocal(){const e=this.preferenceKey();if(!e||e===this.storageKey)return;let t=null,s=null,r=!0;try{t=JSON.parse(localStorage.getItem(e)||"null")}catch{r=!1}try{s=JSON.parse(localStorage.getItem("houseplan_card_kiosk_v1")||"null")}catch{r=!1}this.storageKey=e,this.storageUnavailable=!r,this.local=function(e,t){const s=e&&"object"==typeof e?e:{},r=t&&"object"==typeof t?t:{};return{version:1,show:!0===s.show,icon_scale:v(m(s,"icon_scale")?s.icon_scale:r.icon),font_scale:v(m(s,"font_scale")?s.font_scale:r.font)}}(t,s),this.host._kioskScale={icon:this.local.icon_scale,font:this.local.font_scale}}saveLocal(e){this.local={...this.local,...e,version:1,icon_scale:v(e.icon_scale??this.local.icon_scale),font_scale:v(e.font_scale??this.local.font_scale)},this.host._kioskScale={icon:this.local.icon_scale,font:this.local.font_scale},this.storageKey||=this.preferenceKey();let t=!1;try{this.storageKey&&(localStorage.setItem(this.storageKey,JSON.stringify(this.local)),t=!0)}catch{}this.storageUnavailable=!t,t||this.host._showToast?.(this.t("summary.storage_unavailable")),this.host.requestUpdate()}config(){return function(e,t){const s=e?.summary_panel;return void 0===s?{config:d(t),derived:!0,unsupported:!1}:h(s)?{config:s,derived:!1,unsupported:!1}:{config:null,derived:!1,unsupported:!0}}(this.host._settings,this.translate)}async openDialog(){const e=this.lifecycleGeneration;this.loadLocal();try{this.editorLoad||=import("./summary-panel-editor-v6P_pydT.js").then(e=>e.renderSummaryPanelEditor),this.editorRenderer=await this.editorLoad}catch(t){if(this.editorLoad=null,!this.current(e))return;return void this.host._showToast?.(`${this.t("summary.load_failed")} ${this.host._errText(t)}`)}if(!this.current(e))return;const t=this.config(),s=t.config||d(this.translate),r=this.host._haSummaryPanelApi!==i,a=t.unsupported?"summary.unsupported_schema":r&&this.host._canManageConfiguration?"summary.backend_required":"summary.local_only";this.dialog={draft:y(s),base:y(s),baseRevision:this.host._cfgRev,localShow:this.local.show,baseLocalShow:this.local.show,localOnly:this.host._kiosk||!this.host._canManageConfiguration||r||t.unsupported,localOnlyHint:a,busy:!1,attempted:!1,entityFilter:"",activeSource:null,error:"",conflict:!1},this.dialog.localOnly||this.refreshEntityIndex(),this.host.requestUpdate()}problems(e=this.dialog){return!e||e.localOnly?[]:g(f(e.draft),e.base,new Set(this.host._model.map(e=>e.id)),new Set(Object.keys(this.host.hass?.states||{})))}mutate(e){if(!this.dialog||this.dialog.busy||this.dialog.localOnly)return;const t=y(this.dialog.draft);e(t);const s=this.dialog.activeSource,r=!s||t.blocks.some(e=>e.id===s.blockId&&e.values.some(e=>e.id===s.valueId));this.dialog={...this.dialog,draft:t,error:"",conflict:!1,activeSource:r?s:null,entityFilter:r?this.dialog.entityFilter:""},this.host.requestUpdate()}async deleteBlock(e){const t=this.dialog?.draft.blocks[e];if(!t)return;const s=this.lifecycleGeneration;if(t.values.length){if(!await this.host._confirmDanger({key:"summary-block",kind:"warning",title:this.t("summary.delete_block_title"),message:this.t("summary.delete_block_body"),objectName:t.title,confirmLabel:this.t("btn.delete"),cancelLabel:this.t("btn.cancel")})||!this.current(s))return}this.mutate(e=>{const s=e.blocks.findIndex(e=>e.id===t.id);s>=0&&e.blocks.splice(s,1)})}sourceToken(e){return"system"===e.type?`system:${e.key}`:`entity:${e.entity_id}`}openSource(e,t){!this.dialog||this.dialog.busy||this.dialog.localOnly||(this.refreshEntityIndex(),this.dialog={...this.dialog,activeSource:{blockId:e,valueId:t},entityFilter:""},this.host.requestUpdate(),this.host.updateComplete.then(()=>{this.dialog?.activeSource?.blockId===e&&this.dialog.activeSource.valueId===t&&this.host.renderRoot.querySelector("[data-summary-picker-search]")?.focus()}))}closeSource(e=!1){const t=this.dialog?.activeSource;this.dialog&&t&&(this.dialog={...this.dialog,activeSource:null,entityFilter:""},this.host.requestUpdate(),e&&this.focusSource(t.blockId,t.valueId))}async focusSource(e,t){await this.host.updateComplete;const s=`${e}\n${t}`,r=this.host.renderRoot.querySelectorAll("[data-summary-source-owner]");[...r].find(e=>e.dataset.summarySourceOwner===s)?.focus()}setSource(e,t,s){this.mutate(r=>{const i=r.blocks.find(t=>t.id===e)?.values.find(e=>e.id===t);if(i)if(s.startsWith("system:")){const e=s.slice(7);(e=>"device_count"===e||"total_area"===e||"datetime"===e)(e)&&(i.source={type:"system",key:e})}else i.source={type:"entity",entity_id:s.startsWith("entity:")?s.slice(7):s}}),this.dialog&&(this.dialog={...this.dialog,activeSource:null,entityFilter:""}),this.host.requestUpdate(),this.focusSource(e,t)}dragStart(e,t){e.dataTransfer?.setData("text/x-houseplan-summary",t),e.dataTransfer&&(e.dataTransfer.effectAllowed="move")}drop(e,t){e.preventDefault(),e.stopPropagation();const s=e.dataTransfer?.getData("text/x-houseplan-summary")||"",r=s.split(":").map(Number),i=t.split(":").map(Number);s.startsWith("block:")&&t.startsWith("block:")?this.mutate(e=>{e.blocks=w(e.blocks,r[1],i[1])}):s.startsWith("value:")&&t.startsWith("value:")&&r[1]===i[1]&&this.mutate(e=>{e.blocks[r[1]].values=w(e.blocks[r[1]].values,r[2],i[2])})}async saveDialog(){const e=this.dialog;if(!e||e.busy)return;const t=this.lifecycleGeneration,s=f(e.draft);if((e.localOnly?[]:g(s,e.base,new Set(this.host._model.map(e=>e.id)),new Set(Object.keys(this.host.hass?.states||{})))).some(e=>"error"===e.kind))return this.dialog={...e,draft:s,attempted:!0},this.host.requestUpdate(),await this.host.updateComplete,void this.host.renderRoot.querySelector('[data-summary-error="true"]')?.focus?.();this.dialog={...e,draft:s,busy:!0,attempted:!1,error:"",conflict:!1},this.host.requestUpdate();try{if(!e.localOnly&&!_(s,e.base)){this.host._writesPending++;const r=a(this.host._writeChain,async()=>{if(!this.current(t))return;if(!this.host._serverCfg)throw new Error(this.t("summary.save_failed"));if(this.host._cfgRev!==e.baseRevision)throw new Error(this.t("summary.conflict"));const r=o({...this.host._serverCfg,settings:{...this.host._serverCfg.settings||{},summary_panel:s}});let i=!1;try{if(await this.host._sendConfigCandidate(r),!this.current(t))return}catch(e){if(!this.current(t))throw e;try{const r=await this.host._getAuthoritativeConfig();if(!this.current(t))throw e;const a=function(e,t){if(!c(e))return null;const s=e.config,r=e.rev;if(!c(s)||!Array.isArray(s.spaces)||"number"!=typeof r||!Number.isSafeInteger(r)||r<0)return null;const i=c(s.settings)?s.settings:null,a=i?.summary_panel;return h(a)&&_(a,t)?{config:s,rev:r}:null}(r,s);if(!a)throw e;const o=await this.host._adoptAuthoritative({cfgResp:r,reason:"summary-recovery",profile:"reload"});if("adopted"!==o.status)throw e;o.spaceChanged&&this.host._restoreZoom(),this.host._regSignature="",this.host._maybeRebuildDevices(),i=!0}catch{throw e}}if(!i){if(!this.current(t))return;this.host._adoption.stageConfigCandidate(r),this.host._cacheSnapshot()}});this.host._writeChain=r,await r.finally(()=>{this.host._writesPending--})}if(!this.current(t))return;this.saveLocal({show:e.localShow}),this.dialog=null}catch(s){if(!this.current(t))return;const r="conflict"===s?.code||this.host._cfgRev!==e.baseRevision;this.dialog={...this.dialog||e,busy:!1,conflict:r,error:r?this.t("summary.conflict"):this.host._errText(s)}}this.current(t)&&this.host.requestUpdate()}async reloadDialog(){const e=this.dialog;if(!e||e.busy)return;const t=this.lifecycleGeneration;this.dialog={...e,busy:!0,error:"",conflict:!1},this.host.requestUpdate();try{if(await this.host._reloadConfigOnly(!0),!this.current(t))return;if(e.conflict&&this.host._cfgRev===e.baseRevision)throw new Error(this.t("summary.load_failed"));const s=this.config().config||d(this.translate);this.dialog={...e,draft:y(s),base:y(s),baseRevision:this.host._cfgRev,busy:!1,attempted:!1,error:"",conflict:!1}}catch(s){if(!this.current(t))return;this.dialog={...e,busy:!1,error:this.host._errText(s),conflict:!0}}this.current(t)&&this.host.requestUpdate()}metricsFresh(){return!!this.deviceMemo&&!!this.areaMemo&&this.deviceMemo.cfgEpoch===this.host._cfgEpoch&&this.deviceMemo.layoutRev===this.host._layoutRev&&this.deviceMemo.registryRev===this.host._haRegistry.revision&&this.areaMemo.cfgEpoch===this.host._cfgEpoch}scheduleMetrics(){if(this.metricsRefresh||!this.metricsModule||this.metricsFresh())return;const e=this.lifecycleGeneration,t="undefined"==typeof window?void 0:window,s=()=>{if(this.metricsRefresh=0,!this.current(e))return;const t=this.advanceMetrics(8);this.host.requestUpdate(),t||this.scheduleMetrics()};this.metricsRefresh=t?.setTimeout(()=>{"function"==typeof t.requestAnimationFrame?t.requestAnimationFrame(()=>t.setTimeout(s,0)):s()},0)||0}advanceMetrics(e=8){const t=this.metricsModule;if(!t)return!0;if(this.computeDeviceCount(),!this.host._serverCfg)return this.areaMemo={cfgEpoch:this.host._cfgEpoch,value:null},!0;if(this.areaMemo&&this.areaMemo.cfgEpoch===this.host._cfgEpoch)return!0;this.areaSteps&&this.areaStepsEpoch===this.host._cfgEpoch||(this.areaSteps=t.cleanFloorAreaSteps(this.host._serverCfg,this.host._model),this.areaStepsEpoch=this.host._cfgEpoch);const s=Date.now();let r=this.areaSteps.next();for(;!r.done&&Date.now()-s<e;)r=this.areaSteps.next();return!!r.done&&(this.areaMemo={cfgEpoch:this.areaStepsEpoch,value:r.value??null},this.areaSteps=null,!0)}computeDeviceCount(){const e=this.metricsModule;if(e&&(!this.deviceMemo||this.deviceMemo.cfgEpoch!==this.host._cfgEpoch||this.deviceMemo.layoutRev!==this.host._layoutRev||this.deviceMemo.registryRev!==this.host._haRegistry.revision)){const t=e.representedHaDeviceIds({registry:this.host._haRegistry,areaToSpace:Object.fromEntries(Object.entries(this.host._areaToSpace).map(([e,t])=>[e,t.space])),spaceIds:new Set(this.host._model.map(e=>e.id)),firstSpaceId:this.host._model[0]?.id||"",markers:this.host._markers});this.deviceMemo={cfgEpoch:this.host._cfgEpoch,layoutRev:this.host._layoutRev,registryRev:this.host._haRegistry.revision,value:t?.size??null}}}computeMetrics(){for(;!this.advanceMetrics(Number.POSITIVE_INFINITY););}metrics(){return{deviceCount:this.deviceMemo?this.deviceMemo.value:null,areaM2:this.areaMemo?this.areaMemo.value:null,now:this.clock}}valueState(e){const t=this.metricsModule;if(!t)return{kind:"pending"};if("entity"===e.source.type){const s=t.summaryEntityValue(this.host.hass,e.source.entity_id);return null===s?{kind:"unavailable"}:{kind:"ready",text:s}}const s="device_count"===e.source.key||"total_area"===e.source.key,i="device_count"===e.source.key?this.deviceMemo:this.areaMemo;if(s&&!i)return this.scheduleMetrics(),{kind:"pending"};s&&this.scheduleMetrics();const a=t.summarySystemValue(e.source,this.metrics(),this.host.hass,r(this.host.hass,this.host._config?.language));return null===a?{kind:"unavailable"}:{kind:"ready",text:a}}value(e){const t=this.valueState(e);return"ready"===t.kind?t.text:this.t("summary.unavailable")}ensureMetrics(){if(this.metricsModule||this.metricsLoad)return;const e=this.lifecycleGeneration;this.metricsLoad=import("./summary-panel-metrics-CWsAhuuf.js"),this.metricsLoad.then(t=>{this.metricsModule=t,this.current(e)&&this.host.requestUpdate()}).catch(()=>{}).finally(()=>{this.metricsLoad=null})}layout(){return function(e){const t=Math.max(0,Number(e.width)||0),s=Math.max(0,Number(e.height)||0),r=t>=s?"right":"bottom",i=Math.max(0,e.safeLeft||0)+12,a=Math.max(0,e.safeRight||0)+12,o=Math.max(Math.max(0,e.safeTop||0)+12,e.controlTop||0),n=Math.max(Math.max(0,e.safeBottom||0)+12,e.controlBottom||0),l=Math.max(0,t-i-a),m=Math.max(0,s-o-n),c="bottom"===r?Math.min(.6*s,m):m;return{side:r,fits:t>0&&s>0&&l>=280&&c>=Math.max(0,e.minimumHeight),availableWidth:l,heightCap:c,top:o,bottom:n}}({width:this.stage.width,height:this.stage.height,...this.safeInsets(),controlTop:this.host._kiosk?this.stage.controlTop:0,minimumHeight:this.stage.minimumHeight})}syncPresentation(e=!1){const t=this.config().config,s=this.layout(),r=!!t&&"view"===this.host._mode&&s.fits&&b({view:!0,localShow:!0,showOnMobile:t.show_on_mobile,narrow:this.host.narrow,fits:!0});this.presentation.sync(r&&this.local.show,s.side,e||!r||"hidden"===this.host.ownerDocument.visibilityState)}measureLayout(){const e=this.host._stageEl;if(!e)return;const t=this.host.renderRoot.querySelector(".summary-measure"),s=this.host.renderRoot.querySelector(".summary-control.kiosk"),r=e.getBoundingClientRect(),i=s?.getBoundingClientRect(),a={width:Math.round(e.clientWidth),height:Math.round(e.clientHeight),minimumHeight:Math.max(162,Math.ceil(t?.getBoundingClientRect().height||0)),controlTop:i?Math.max(0,Math.ceil(i.bottom-r.top+12)):0};a.width===this.stage.width&&a.height===this.stage.height&&a.minimumHeight===this.stage.minimumHeight&&a.controlTop===this.stage.controlTop||(this.stage=a,this.host.requestUpdate())}safeInsets(){const e=this.host.renderRoot.querySelector(".summary-safe-probe");if(!e)return{safeLeft:0,safeRight:0,safeTop:0,safeBottom:0};const t=this.host.ownerDocument.defaultView?.getComputedStyle(e);if(!t)return{safeLeft:0,safeRight:0,safeTop:0,safeBottom:0};const s=e=>Number.parseFloat(e)||0;return{safeLeft:s(t.paddingLeft),safeRight:s(t.paddingRight),safeTop:s(t.paddingTop),safeBottom:s(t.paddingBottom)}}hasVisibleClock(){const e=this.config().config;return!("hidden"===this.host.ownerDocument.visibilityState||!e)&&(!!b({view:"view"===this.host._mode,localShow:this.local.show,showOnMobile:e.show_on_mobile,narrow:this.host.narrow,fits:this.layout().fits})&&p(e,this.host._space).some(e=>e.values.some(e=>"system"===e.source.type&&"datetime"===e.source.key)))}syncClock(){const e=`${r(this.host.hass,this.host._config?.language)}\n${this.host.hass?.config?.time_zone||""}`;e!==this.clockContext&&(this.clockContext=e,this.clock=new Date);const t=this.hasVisibleClock();if(t&&!this.clockTimer){this.clock=new Date;const e=()=>{this.clock=new Date,this.clockTimer=0,this.host.requestUpdate(),this.syncClock()};this.clockTimer=window.setTimeout(e,6e4-Date.now()%6e4+25)}else!t&&this.clockTimer&&(clearTimeout(this.clockTimer),this.clockTimer=0)}}});export{C as a,H as b,k as c,x as d,O as e,w as m,f as n,_ as s};
