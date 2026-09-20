/* General settings: design prototype of the house-wide settings dialog.
   Same visual system as Space settings (cards in one flow, "?" help, inline color fields).
   Field keys mirror the product's SettingsDialogState; data stays in this origin's localStorage. */
import {registerDemoForm, notifyDemoFormClosed} from './demo-shell.js';
import {$, $$, escape, clone, icon, hydrateIcons, showToast, attachHelp, closeHelp, helpOpen} from './ui.js';

const STORAGE_KEY = 'houseplan-general-settings-design-v1';
/* DEFAULT_FILL_COLORS from src/logic.ts; opacity kept as a fraction like the product. */
const DEFAULT_COLORS = {
  light_on:{c:'#ffd45c',a:0.18}, light_off:{c:'#9aa0a6',a:0.14}, light_none:{c:'#6b7480',a:0},
  temp_cold:{c:'#4fc3f7',a:0.18}, temp_ok:{c:'#66d17a',a:0.18}, temp_hot:{c:'#ffd45c',a:0.18},
  lqi_low:{c:'#f25a4a',a:0.18}, lqi_high:{c:'#4bd28f',a:0.18},
  glow_base:{c:'#0d1b2a',a:0.5}, glow_light:{c:'#ffd9a0',a:0.85},
  wall_fill:{c:'#ffffff',a:1},
};
const defaults = {
  showRoomTooltip:true, radarShowLive:true,
  zigbeeTopology:{enabled:false, z2mTopics:'zigbee2mqtt'},
  colors:clone(DEFAULT_COLORS), glowRadius:3,
  bgMode:'daynight', bgColor:null, northDeg:null, sunRays:true, sunRayOrigin:'inner',
};
/* Visual example for a fresh browser: matches the current stage (north 165°, Zigbee links on). */
const example = {...clone(defaults), northDeg:165, zigbeeTopology:{enabled:true, z2mTopics:'zigbee2mqtt'}};
const THEME_BG = '#edf1f2';

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!data || typeof data !== 'object') return clone(example);
    const ok = Object.keys(defaults).every(k => k in data) && Object.keys(DEFAULT_COLORS).every(k => data.colors?.[k]?.c);
    return ok ? data : clone(example);
  } catch { return clone(example); }
}
let saved = load();
let draft = clone(saved);
const dirty = () => JSON.stringify(draft) !== JSON.stringify(saved);

/* Dialog shell: same structure and classes as the Space settings dialog. */
const dialog = document.createElement('dialog');
dialog.id = 'general-settings'; dialog.className = 'settings-dialog'; dialog.setAttribute('aria-labelledby', 'gs-title');
dialog.innerHTML = `
  <header class="dialog-header">
    <button type="button" id="gs-close" class="icon-button" aria-label="Close general settings" title="Close" data-icon="close"></button>
    <h1 id="gs-title" tabindex="-1">General settings</h1>
  </header>
  <div class="dialog-scroll" id="gs-scroll"><div class="dialog-body"><div id="gs-content" class="settings-content"></div></div></div>
  <footer class="dialog-footer">
    <div class="footer-tools"><button class="button" id="gs-reset" type="button"><span data-icon="reset"></span>Reset to defaults</button></div>
    <div class="save-status" id="gs-status" role="status" hidden></div>
    <div class="footer-commit"><button class="button" id="gs-cancel" type="button">Cancel</button><button class="button primary" id="gs-save" type="button" disabled>Save</button></div>
  </footer>`;
$('#demo-stage').append(dialog);
const subDialog = document.createElement('dialog');
subDialog.id = 'gs-sub-dialog'; subDialog.className = 'sub-dialog'; subDialog.setAttribute('aria-labelledby', 'gs-sub-title');
document.body.append(subDialog);
const content = $('#gs-content');
const scroller = $('#gs-scroll');

/* Help texts: product keys where they exist (gs.*.help, topology help). */
const helpCopy = {
  zigbee:['Zigbee links','Shows which Zigbee devices each device talks to directly. Line colour is link quality (LQI) on the same scale as the device’s LQI reading: red at 40 and below, green at 180 and above. A dashed line means quality was not reported. An arrow points to the next device on the way to the coordinator; a line without an arrow is a spare neighbour. Data comes from the last load and goes stale; links are shown with a mouse only.'],
  fills:['Room fill colors','Fill colors apply to every space; each color has its own opacity. Which fill mode a space uses is set in that space’s dialog.'],
  glowRadius:['Glow radius','Sets the default glow radius in metres or feet; a device-specific radius overrides it.'],
  bgMode:['Plan background','“Follows the Sun” uses sun.sun, falling back to the browser’s local clock; Static always shows the selected colour.'],
  north:['North on the plan','The angle is measured clockwise from the plan’s upward vertical; north is required for window rays, not for the “Follows the Sun” background.'],
};
const help = attachHelp(content, scroller, helpCopy);

/* Rendering helpers (same markup as Space settings). */
const card = (id, title, body, extra='') => `<section id="gs-section-${id}" class="settings-card" aria-labelledby="gs-heading-${id}"><div class="card-heading"><div class="card-title"><h2 id="gs-heading-${id}">${title}</h2>${extra}</div></div><div class="panel-scroll">${body}</div></section>`;
const hint = text => `<p class="field-hint">${text}</p>`;
const callout = (text, warning=false) => `<div class="callout ${warning?'warning':''}">${icon('info')}<p>${text}</p></div>`;
const subsectionHeading = (text, key='') => `<div class="subsection-heading"><h3>${text}</h3>${key?help.button(key):''}</div>`;
function toggle(key, title, description, name, disabled=false) {
  return `<div class="setting-item"><div class="setting-row"><span class="row-icon">${icon(name)}</span><div class="row-copy"><div class="row-title"><label for="gs-toggle-${key}"><strong>${title}</strong></label></div>${description?`<small>${description}</small>`:''}</div><span class="switch"><input id="gs-toggle-${key}" type="checkbox" role="switch" aria-label="${title}" data-field="${key}" ${draft[key]?'checked':''} ${disabled?'disabled':''}><span class="switch-track"></span></span></div></div>`;
}
function segmented(key, values, label) {
  return `<div class="segmented" role="radiogroup" aria-label="${label}">${values.map(([value,title])=>`<label class="segment"><input type="radio" name="gs-${key}" data-field="${key}" value="${value}" ${draft[key]===value?'checked':''}><span>${title}</span></label>`).join('')}</div>`;
}
/* Color tiles: one card per color with a large swatch (system picker), name, hex and opacity. Groups of colors sit in one row. */
const onDark = hex => { const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (0.299*r + 0.587*g + 0.114*b) < 150; };
function colorTile(key, label) {
  const {c, a} = draft.colors[key];
  return `<div class="color-tile"><span class="tile-swatch-wrap ${onDark(c)?'on-dark':''}"><input id="gs-color-${key}" class="color-input tile-swatch" type="color" data-color="${key}" value="${c}" aria-label="${label}"><span class="tile-name">${label}</span></span><div class="tile-meta"><span class="hex-code" data-hex="${key}">${c.toUpperCase()}</span><label class="unit-inside tile-opacity" title="Opacity"><input type="number" aria-label="${label} opacity" min="0" max="100" step="1" data-opacity="${key}" value="${Math.round(a*100)}"><span>%</span></label></div></div>`;
}
const colorTiles = items => `<div class="color-tiles">${items.map(([k,l])=>colorTile(k,l)).join('')}</div>`;
/* Single color: same plate as the Space settings color fields (label above, swatch, hex, optional opacity and Reset). */
function colorPlate(key, label, {opacity=true, reset=''}={}) {
  const {c, a} = draft.colors[key];
  return `<div class="field-stack"><label class="field-label" for="gs-color-${key}">${label}</label><div class="color-field"><input id="gs-color-${key}" class="color-input" type="color" data-color="${key}" value="${c}" aria-label="${label}"><span class="hex-code" data-hex="${key}">${c.toUpperCase()}</span>${opacity?`<label class="color-opacity"><span>Opacity</span><span class="unit-inside"><input type="number" aria-label="${label} opacity" min="0" max="100" step="1" data-opacity="${key}" value="${Math.round(a*100)}"><span>%</span></span></label>`:''}${reset?`<button class="text-link" type="button" data-action="${reset}">Reset</button>`:''}</div></div>`;
}
const northNeedle = '<svg class="dial-arrow compass-needle" id="gs-dial-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V3m-6 6 6-6 6 6"/></svg>';

function generalCard() {
  return card('general','Display',
    toggle('showRoomTooltip','Show the room information window on hover','Hover a room on the plan to see its summary.','tooltip')+
    toggle('radarShowLive','Show live presence on the plan','Hides or shows all live radar targets. This does not start or stop observation recording.','radar')
  );
}
function zigbeeCard() {
  const z = draft.zigbeeTopology, savedEnabled = saved.zigbeeTopology.enabled;
  const providers = z.enabled ? `
    ${!savedEnabled?callout('Save this setting before loading topology data.'):''}
    <div class="subsection">${subsectionHeading('ZHA')}${hint('Reads ZHA’s cached topology; it does not start a radio scan.')}<div class="action-line"><button class="button" type="button" data-action="zha" ${savedEnabled?'':'disabled'}>${icon('wifi')}Read ZHA data</button><span class="action-status">Data not loaded</span></div></div>
    <div class="subsection">${subsectionHeading('Zigbee2MQTT')}<div class="field"><label class="field-label" for="gs-z2m-topics">Base topics (one per line)</label><textarea id="gs-z2m-topics" class="text-input textarea" rows="2" data-field="z2mTopics" spellcheck="false">${escape(z.z2mTopics)}</textarea></div>${callout('A network-map scan can take 10 seconds to 2 minutes and may temporarily reduce Zigbee responsiveness.',true)}<div class="action-line"><button class="button" type="button" data-action="z2m" ${savedEnabled?'':'disabled'}>${icon('refresh')}Update map · ${escape(z.z2mTopics.split('\n')[0].trim()||'zigbee2mqtt')}</button><span class="action-status">Data not loaded</span></div></div>` : '';
  return card('zigbee','Zigbee links',
    `<div class="setting-item"><div class="setting-row"><span class="row-icon">${icon('zigbee')}</span><div class="row-copy"><div class="row-title"><label for="gs-toggle-zigbee"><strong>Show Zigbee links when hovering over a device</strong></label></div><small>Shows observed direct neighbours only. Nothing is fetched while you hover.</small></div><span class="switch"><input id="gs-toggle-zigbee" type="checkbox" role="switch" aria-label="Show Zigbee links when hovering over a device" data-field="zigbeeEnabled" ${z.enabled?'checked':''}><span class="switch-track"></span></span></div></div>`+providers,
    help.button('zigbee')
  );
}
function fillsCard() {
  return card('fills','Room fill colors',
    `<div class="subsection first">${subsectionHeading('Lights')}${colorTiles([['light_on','Lights on'],['light_off','All lights off'],['light_none','No light sources']])}</div>`+
    `<div class="subsection">${subsectionHeading('Temperature')}${colorTiles([['temp_cold','Cold'],['temp_ok','Comfortable'],['temp_hot','Hot']])}</div>`+
    `<div class="subsection">${subsectionHeading('Zigbee signal')}${colorTiles([['lqi_low','Weak signal'],['lqi_high','Strong signal']])}</div>`,
    help.button('fills')
  );
}
function glowCard() {
  return card('glow','Light-source glow',
    colorTiles([['glow_base','House darkness'],['glow_light','Default light color / intensity']])+
    `<div class="field-stack"><div class="field-heading-with-help"><label class="field-label" for="gs-glow-radius">Glow radius</label>${help.button('glowRadius')}</div><div class="field-unit"><span class="unit-inside"><input id="gs-glow-radius" type="number" min="0.5" step="0.5" data-field="glowRadius" value="${draft.glowRadius}" aria-describedby="gs-error-glowRadius"><span>m</span></span></div>${errorSlot('glowRadius')}</div>`
  );
}
function planCard() {
  const bgDetail = draft.bgMode==='static'
    ? `<div class="field-stack"><label class="field-label" for="gs-bg-color">Background around the plan</label><div class="color-field"><input id="gs-bg-color" class="color-input" type="color" data-field="bgColor" value="${draft.bgColor||THEME_BG}" aria-label="Background around the plan"><span class="hex-code" data-hex="bg">${(draft.bgColor||THEME_BG).toUpperCase()}</span>${draft.bgColor?`<button class="text-link" type="button" data-action="bg-theme">Reset</button>`:''}</div>${hint(draft.bgColor?'Custom background color.':'Using the theme background.')}</div>`
    : '';
  return card('plan','Plan',
    colorPlate('wall_fill','Wall fill')+
    `<div class="subsection"><div class="field-heading-with-help"><span class="field-label">Plan background</span>${help.button('bgMode')}</div>${segmented('bgMode',[['static','Static color'],['daynight','Follows the Sun']],'Plan background')}${bgDetail}</div>`
  );
}
function sunCard() {
  return card('sun','Sun',
    `<div class="north-setting"><div class="north-controls"><div class="field-heading-with-help"><label class="field-label" for="gs-north">North on the plan</label>${help.button('north')}</div><div class="field-unit north-input"><span class="unit-inside"><input id="gs-north" type="number" min="0" max="359" step="1" data-field="northDeg" value="${draft.northDeg??''}" placeholder="not set" aria-describedby="gs-error-northDeg"><span>°</span></span>${draft.northDeg!==null?`<button class="text-link" type="button" data-action="clear-north">Clear</button>`:''}</div></div><div class="north-indicator" aria-hidden="true"><span>N</span><div class="north-dial">${northNeedle}</div></div></div>${errorSlot('northDeg')}`+
    `<div class="subsection">${toggle('sunRays','Sunlight through windows','Draw sun rays through window openings.','sun')}</div>`+
    `<div class="subsection"><span class="field-label">Sun rays</span>${segmented('sunRayOrigin',[['inner','From the inner window corners'],['outer','From the outer window corners']],'Sun rays')}</div>`
  );
}
function dataCard() {
  return card('data','Data',
    `<div class="subsection first">${subsectionHeading('Backup and transfer')}${hint('Download a portable JSON backup or preview and import a backup made by House Plan.')}<div class="action-line"><button class="button" type="button" data-action="export">${icon('download')}Export</button><button class="button" type="button" data-action="import">${icon('upload')}Import</button></div></div>`+
    `<div class="subsection">${subsectionHeading('Plan maintenance')}${hint('Updates data models, aligns plan elements to the grid and merges redundant wall fragments. An exact report is shown before anything is stored.')}<div class="action-line"><button class="button" type="button" data-action="optimize">${icon('broom')}Optimize plans</button></div></div>`
  );
}

/* Validation, chrome and state. */
function errorFor(key) {
  if (key==='glowRadius' && (draft.glowRadius==='' || !Number.isFinite(Number(draft.glowRadius)) || Number(draft.glowRadius)<=0)) return 'Enter a radius greater than 0.';
  if (key==='northDeg' && draft.northDeg!==null && (draft.northDeg==='' || !Number.isInteger(Number(draft.northDeg)) || draft.northDeg<0 || draft.northDeg>359)) return 'Enter a whole number between 0° and 359°.';
  return '';
}
const errorFields = ['glowRadius','northDeg'];
const allErrors = () => errorFields.map(k=>[k,errorFor(k)]).filter(([,m])=>m);
const errorSlot = key => `<div class="error" id="gs-error-${key}" aria-live="polite" ${errorFor(key)?'':'hidden'}>${errorFor(key)}</div>`;

function renderMain() {
  closeHelp();
  content.innerHTML = generalCard()+zigbeeCard()+fillsCard()+glowCard()+planCard()+sunCard()+dataCard();
}
function updateChrome() {
  const errors = allErrors();
  $('#gs-save').disabled = !dirty() || errors.length>0;
  const status = $('#gs-status');
  status.classList.toggle('dirty', dirty());
  status.hidden = !dirty() && !errors.length;
  status.textContent = dirty() ? 'Unsaved changes' : '';
  if (errors.length) status.innerHTML = `<button class="text-link" data-action="review-errors">Review ${errors.length} ${errors.length===1?'field':'fields'}</button>`;
  errorFields.forEach(key => {
    const el = $(`#gs-error-${key}`), message = errorFor(key);
    if (el) { el.hidden = !message; el.textContent = message; }
    $$(`[data-field="${key}"]`, content).forEach(input => input.setAttribute('aria-invalid', String(!!message)));
  });
  $$('[data-hex]', content).forEach(el => { const k = el.dataset.hex; el.textContent = (k==='bg' ? (draft.bgColor||THEME_BG) : draft.colors[k].c).toUpperCase(); });
  const arrow = $('#gs-dial-arrow'); if (arrow) arrow.style.transform = `rotate(${draft.northDeg??0}deg)`;
  $('#gs-dial-arrow')?.parentElement.classList.toggle('unset', draft.northDeg===null);
}
const render = () => { renderMain(); updateChrome(); };
function rerenderKeepingScroll() { const top = scroller.scrollTop; renderMain(); updateChrome(); scroller.scrollTop = top; }

function updateField(el) {
  const key = el.dataset.field;
  if (el.dataset.color) { draft.colors[el.dataset.color].c = el.value; el.parentElement.classList.toggle('on-dark', onDark(el.value)); updateChrome(); return; }
  if (el.dataset.opacity) { const n = Math.min(100, Math.max(0, Number(el.value))); if (Number.isFinite(n)) draft.colors[el.dataset.opacity].a = n/100; updateChrome(); return; }
  if (!key) return;
  if (key==='zigbeeEnabled') { draft.zigbeeTopology.enabled = el.checked; rerenderKeepingScroll(); return; }
  if (key==='z2mTopics') { draft.zigbeeTopology.z2mTopics = el.value; $('[data-action="z2m"]', content).lastChild.textContent = `Update map · ${el.value.split('\n')[0].trim()||'zigbee2mqtt'}`; updateChrome(); return; }
  if (key==='bgColor') { draft.bgColor = el.value; rerenderKeepingScroll(); return; }
  if (key==='northDeg') { draft.northDeg = el.value==='' ? null : Number(el.value); updateChrome(); if ((el.value==='')!==!$('[data-action="clear-north"]', content)) rerenderKeepingScroll(); return; }
  if (el.type==='checkbox') draft[key] = el.checked;
  else if (el.type==='number') draft[key] = el.value==='' ? '' : Number(el.value);
  else draft[key] = el.value;
  if (key==='bgMode') rerenderKeepingScroll(); else updateChrome();
}
function handleAction(action) {
  if (action==='review-errors') { const first = allErrors()[0]; if (!first) return; const field = $(`[data-field="${first[0]}"]`, content); field?.scrollIntoView({block:'center'}); field?.focus({preventScroll:true}); return; }
  if (action==='bg-theme') draft.bgColor = null;
  if (action==='clear-north') draft.northDeg = null;
  if (action==='zha' || action==='z2m') { showToast('Topology data is loaded from Home Assistant in the product; this preview only shows the controls.'); return; }
  if (action==='export') { showToast('The product downloads a JSON backup here.'); return; }
  if (action==='import') { showToast('The product opens a file picker and previews the backup here.'); return; }
  if (action==='optimize') { showToast('The product shows an exact optimization report before storing anything.'); return; }
  rerenderKeepingScroll();
}

/* Open, close, save. */
let closeDecision, lastSubTrigger;
function openSettings() {
  saved = load(); draft = clone(saved); render();
  if (!dialog.open) dialog.show();
  scroller.scrollTop = 0; $('#gs-title').focus({preventScroll:true});
}
function closeSettings() { dialog.close(); notifyDemoFormClosed('general-settings'); }
function showSub(title, body, actions) {
  lastSubTrigger = document.activeElement;
  subDialog.innerHTML = `<div class="sub-heading"><h2 id="gs-sub-title">${title}</h2><button class="icon-button" aria-label="Close dialog" data-sub="close">${icon('close')}</button></div>${body}<div class="sub-actions">${actions}</div>`;
  subDialog.showModal();
}
function closeSub() { subDialog.close(); lastSubTrigger?.focus({preventScroll:true}); if (closeDecision) { const r = closeDecision; closeDecision = undefined; r(false); } }
function requestClose() {
  if (!dirty()) { closeSettings(); return Promise.resolve(true); }
  showSub('Discard your changes?', '<p>Your changes to the general settings haven’t been saved.</p>', '<button class="button" data-sub="discard">Discard changes</button><button class="button primary" data-sub="close">Keep editing</button>');
  $('[data-sub="close"].primary', subDialog).focus();
  return new Promise(resolve => { closeDecision = resolve; });
}
function saveSettings() {
  if (!dirty() || allErrors().length) return;
  const normalized = clone(draft);
  normalized.zigbeeTopology.z2mTopics = normalized.zigbeeTopology.z2mTopics.split('\n').map(s=>s.trim()).filter(Boolean).join('\n') || 'zigbee2mqtt';
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); }
  catch { showToast('Could not save locally. Enable browser storage and try again.'); return; }
  saved = clone(normalized); draft = clone(saved); closeSettings();
  showToast('General settings saved in this browser.');
}

content.addEventListener('input', e => { if (['checkbox','radio'].includes(e.target.type) || e.target.tagName==='SELECT') return; updateField(e.target); });
content.addEventListener('change', e => { if (['checkbox','radio'].includes(e.target.type) || e.target.tagName==='SELECT') updateField(e.target); });
content.addEventListener('click', e => { const b = e.target.closest('button[data-action]'); if (b) handleAction(b.dataset.action); });
$('#gs-status').addEventListener('click', e => { const b = e.target.closest('button[data-action]'); if (b) handleAction(b.dataset.action); });
$('#gs-close').addEventListener('click', requestClose);
$('#gs-cancel').addEventListener('click', requestClose);
$('#gs-save').addEventListener('click', saveSettings);
$('#gs-reset').addEventListener('click', () => { draft = clone(defaults); draft.zigbeeTopology.enabled = saved.zigbeeTopology.enabled; rerenderKeepingScroll(); showToast('Defaults restored. Save to keep them.'); });
dialog.addEventListener('cancel', e => { e.preventDefault(); requestClose(); });
dialog.addEventListener('keydown', e => {
  if (e.key==='Escape' && helpOpen()) { e.preventDefault(); e.stopPropagation(); closeHelp(); return; }
  if (e.key==='Escape' && !subDialog.open) { e.preventDefault(); e.stopPropagation(); requestClose(); }
});
subDialog.addEventListener('cancel', e => { e.preventDefault(); closeSub(); });
subDialog.addEventListener('click', e => {
  const b = e.target.closest('button[data-sub]'); if (!b) return;
  if (b.dataset.sub==='close') { closeSub(); return; }
  if (b.dataset.sub==='discard') { const r = closeDecision; closeDecision = undefined; draft = clone(saved); closeSub(); closeSettings(); r?.(true); }
});
window.addEventListener('beforeunload', e => { if (dialog.open && dirty()) { e.preventDefault(); e.returnValue=''; } });
hydrateIcons(dialog);
registerDemoForm({id:'general-settings', title:'General settings', description:'House-wide display, fill colors, glow, background, sun and maintenance.', open:openSettings, requestClose});
