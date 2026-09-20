/* Room settings: design prototype of the per-room dialog (edit mode).
   Same visual system as Space and General settings. Field keys mirror the product's room dialog state
   (_nameSel, _areaSel, _roomFill, _roomCustomFill, _roomTempMin/Max, _roomTempSrc, _roomHumSrc, _roomNameScale, _roomLabelScale). */
import {registerDemoForm, notifyDemoFormClosed} from './demo-shell.js';
import {$, $$, escape, clone, icon, hydrateIcons, showToast, attachHelp, closeHelp, helpOpen} from './ui.js';

const STORAGE_KEY = 'houseplan-room-settings-design-v1';
/* Demo context: the room lives in Ground Floor; the space fill is Custom #EDEDED, comfort range 20–25 °C. */
const SPACE = {title:'Ground Floor', fill:'custom', customFill:{c:'#ededed',a:1}, tempMin:20, tempMax:25, cardFontScale:1};
const AREAS = [['area_kitchen','Kitchen & Living'],['area_hallway','Hallway'],['area_garage','Garage']];
const SOURCES = [
  {value:'device:aqara-th-1', label:'Kitchen climate sensor', sub:'Aqara TH'},
  {value:'device:sonoff-snzb-2', label:'Living room sensor', sub:'SONOFF SNZB-02'},
  {value:'entity:sensor.kitchen_temperature', label:'Kitchen temperature', sub:'sensor.kitchen_temperature'},
  {value:'entity:sensor.kitchen_humidity', label:'Kitchen humidity', sub:'sensor.kitchen_humidity'},
  {value:'entity:sensor.thermostat_current', label:'Thermostat current temperature', sub:'sensor.thermostat_current'},
];
const defaults = {
  nameSel:'Kitchen & Living', areaSel:'area_kitchen',
  roomFill:'', roomCustomFill:null, roomTempMin:'', roomTempMax:'',
  roomTempSrc:'', roomHumSrc:'', roomNameScale:100, roomLabelScale:100,
};
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return data && Object.keys(defaults).every(k => k in data) ? data : clone(defaults);
  } catch { return clone(defaults); }
}
let saved = load();
let draft = clone(saved);
let srcOpen = null, srcFilter = '';
const dirty = () => JSON.stringify(draft) !== JSON.stringify(saved);

/* Dialog shell. */
const dialog = document.createElement('dialog');
dialog.id = 'room-settings'; dialog.className = 'settings-dialog'; dialog.setAttribute('aria-labelledby', 'rs-title');
dialog.innerHTML = `
  <header class="dialog-header">
    <button type="button" id="rs-close" class="icon-button" aria-label="Close room settings" title="Close" data-icon="close"></button>
    <h1 id="rs-title" tabindex="-1">Room settings</h1>
    <span id="rs-crumb" class="space-badge">${escape(SPACE.title)}</span>
  </header>
  <div class="dialog-scroll" id="rs-scroll"><div class="dialog-body"><div id="rs-content" class="settings-content"></div></div></div>
  <footer class="dialog-footer">
    <div class="footer-tools"></div>
    <div class="save-status" id="rs-status" role="status" hidden></div>
    <div class="footer-commit"><button class="button" id="rs-cancel" type="button">Cancel</button><button class="button primary" id="rs-save" type="button" disabled>Save</button></div>
  </footer>`;
$('#demo-stage').append(dialog);
const subDialog = document.createElement('dialog');
subDialog.id = 'rs-sub-dialog'; subDialog.className = 'sub-dialog'; subDialog.setAttribute('aria-labelledby', 'rs-sub-title');
document.body.append(subDialog);
const content = $('#rs-content');
const scroller = $('#rs-scroll');

const helpCopy = {
  area:['Home Assistant area','Links the room to a Home Assistant area: its sensors feed the room card and its lights count as the room’s lights. Only areas not used by another room are listed.'],
  fill:['Fill in this room','Overrides the space fill for this room only. “As the space” follows the space setting; Custom uses a fixed color that can also be inherited from the space until you change it.'],
  tempRange:['Comfort range','This range applies only to this room. Empty fields inherit the corresponding space bounds; if the bounds are reversed, House Plan uses the smaller value as the minimum.'],
  sources:['Sensor sources','By default the room card averages every temperature or humidity sensor in the room’s area. Pick a specific device or entity to show its reading instead.'],
  sizes:['Font sizes','Scales the name and the metrics of this room card on top of the space-wide card size. 100% is the default.'],
};
const help = attachHelp(content, scroller, helpCopy);

/* Rendering helpers. */
const card = (id, title, body, extra='') => `<section id="rs-section-${id}" class="settings-card" aria-labelledby="rs-heading-${id}"><div class="card-heading"><div class="card-title"><h2 id="rs-heading-${id}">${title}</h2>${extra}</div></div><div class="panel-scroll">${body}</div></section>`;
const hint = text => `<p class="field-hint">${text}</p>`;
const fieldHeading = (text, key, forId='') => `<div class="field-heading-with-help"><label class="field-label" ${forId?`for="${forId}"`:''}>${text}</label>${key?help.button(key):''}</div>`;
function segmented(key, values, label, current) {
  return `<div class="segmented" role="radiogroup" aria-label="${label}">${values.map(([value,title])=>`<label class="segment"><input type="radio" name="rs-${key}" data-field="${key}" value="${value}" ${current===value?'checked':''}><span>${title}</span></label>`).join('')}</div>`;
}
function toggle(key, title, description, name, checked) {
  return `<div class="setting-item"><div class="setting-row"><span class="row-icon">${icon(name)}</span><div class="row-copy"><div class="row-title"><label for="rs-toggle-${key}"><strong>${title}</strong></label></div>${description?`<small>${description}</small>`:''}</div><span class="switch"><input id="rs-toggle-${key}" type="checkbox" role="switch" aria-label="${title}" data-field="${key}" ${checked?'checked':''}><span class="switch-track"></span></span></div></div>`;
}
const errorFor = key => {
  if (key==='nameSel' && !draft.nameSel.trim()) return 'Enter a name for this room.';
  if (key==='tempRange') {
    const bad = v => v.trim()!=='' && !Number.isFinite(Number(v.replace(',','.')));
    if (bad(draft.roomTempMin) || bad(draft.roomTempMax)) return 'Enter numbers, or leave a field empty to inherit the space bound.';
  }
  if ((key==='roomNameScale'||key==='roomLabelScale') && (draft[key]===''||draft[key]<50||draft[key]>300)) return 'Choose a size between 50% and 300%.';
  return '';
};
const errorFields = ['nameSel','tempRange','roomNameScale','roomLabelScale'];
const allErrors = () => errorFields.map(k=>[k,errorFor(k)]).filter(([,m])=>m);
const errorSlot = key => `<div class="error" id="rs-error-${key}" aria-live="polite" ${errorFor(key)?'':'hidden'}>${errorFor(key)}</div>`;

function basicsCard() {
  return card('basics','Basics',
    `<div class="field-grid rs-grid"><div class="field"><label class="field-label" for="rs-name">Display name</label><input id="rs-name" class="text-input" type="text" data-field="nameSel" value="${escape(draft.nameSel)}" placeholder="e.g. Terrace" maxlength="80" autocomplete="off" aria-describedby="rs-error-nameSel" aria-invalid="${!!errorFor('nameSel')}">${errorSlot('nameSel')}</div>`+
    `<div class="field">${fieldHeading('Home Assistant area','area','rs-area')}<select id="rs-area" class="select-input" data-field="areaSel"><option value="" ${!draft.areaSel?'selected':''}>— no area —</option>${AREAS.map(([id,name])=>`<option value="${id}" ${draft.areaSel===id?'selected':''}>${name}</option>`).join('')}</select></div></div>`
  );
}
function fillCard() {
  const inherit = draft.roomFill === '';
  const effective = inherit ? SPACE.fill : draft.roomFill;
  const custom = draft.roomCustomFill || SPACE.customFill;
  const own = !!draft.roomCustomFill;
  const modeDetail = inherit ? hint(`Following the space: ${({none:'no fill',lqi:'Zigbee signal',light:'Lights',temp:'Temperature',custom:'Custom color'})[SPACE.fill]}.`)
    : `<div class="field-stack">${segmented('roomFill',[['none','None'],['lqi','Zigbee'],['light','Lights'],['temp','Temperature'],['custom','Custom']],'Fill in this room',draft.roomFill)}</div>`;
  const colorDetail = effective==='custom' && !inherit
    ? `<div class="field-stack"><label class="field-label" for="rs-fill-color">${own?'Room color':'Space color'}</label><div class="color-field"><input id="rs-fill-color" class="color-input" type="color" data-field="fillColor" value="${custom.c}" aria-label="Fill color"><span class="hex-code" data-hex="fill">${custom.c.toUpperCase()}</span><label class="color-opacity"><span>Opacity</span><span class="unit-inside"><input type="number" aria-label="Fill opacity" min="0" max="100" step="1" data-field="fillOpacity" value="${Math.round(custom.a*100)}"><span>%</span></span></label>${own?`<button class="text-link" type="button" data-action="reset-fill">Reset</button>`:''}</div>${hint(own?'Custom color for this room.':'Using the space color until you change it.')}</div>`
    : '';
  const tempDetail = effective==='temp'
    ? `<div class="field-stack">${fieldHeading('Comfort range','tempRange')}<div class="temperature-range"><label><span class="field-label">Minimum</span><span class="unit-inside"><input type="number" step="0.5" data-field="roomTempMin" value="${escape(draft.roomTempMin)}" placeholder="${SPACE.tempMin}" aria-label="Lower comfort-temperature bound"><span>°C</span></span></label><label><span class="field-label">Maximum</span><span class="unit-inside"><input type="number" step="0.5" data-field="roomTempMax" value="${escape(draft.roomTempMax)}" placeholder="${SPACE.tempMax}" aria-label="Upper comfort-temperature bound"><span>°C</span></span></label></div>${errorSlot('tempRange')}<div class="temp-legend"><span>Cold</span><span>Comfort</span><span>Hot</span></div>${draft.roomTempMin.trim()||draft.roomTempMax.trim()?`<p class="field-hint"><button class="text-link" type="button" data-action="reset-temp">As the space</button></p>`:hint(`Empty fields inherit the space bounds (${SPACE.tempMin}–${SPACE.tempMax} °C).`)}</div>`
    : '';
  return card('fill','Fill',
    toggle('fillInherit','As the space','Use the fill mode set for the whole space.','layers',inherit)+modeDetail+colorDetail+tempDetail,
    help.button('fill')
  );
}
function sourceBlock(kind, label) {
  const key = kind==='temp' ? 'roomTempSrc' : 'roomHumSrc';
  const val = draft[key], open = srcOpen===kind;
  const picked = SOURCES.find(s=>s.value===val);
  const picker = val || open ? `<div class="source-picker ${open?'open':''}"><button type="button" class="select-input source-button" data-action="src-toggle" data-kind="${kind}" aria-expanded="${open}">${picked?`<b>${escape(picked.label)}</b><span class="source-ref">${escape(picked.sub)}</span>`:`<span class="source-placeholder">Choose a source…</span>`}</button>${open?`<div class="source-panel"><input class="text-input" type="text" placeholder="Search devices and entities" data-src-filter="${kind}" value="${escape(srcFilter)}" autocomplete="off"><div class="source-list">${SOURCES.filter(s=>!srcFilter||(s.label+' '+s.sub).toLowerCase().includes(srcFilter.toLowerCase())).map(s=>`<button type="button" class="source-candidate ${s.value===val?'selected':''}" data-action="src-pick" data-kind="${kind}" data-value="${s.value}"><span>${escape(s.label)}</span><small>${escape(s.sub)}</small></button>`).join('')||'<p class="field-hint">Nothing matches.</p>'}</div></div>`:''}</div>` : '';
  return `<div class="subsection ${kind==='temp'?'first':''}"><span class="field-label">${label}</span>${segmented(key+'Mode',[['average','Average of the room’s sensors'],['pick','Specific device or entity']],label,val||open?'pick':'average')}${picker}</div>`;
}
function sourcesCard() {
  return card('sources','Sensor sources', sourceBlock('temp','Temperature')+sourceBlock('hum','Humidity'), help.button('sources'));
}
function sizeRow(key, label) {
  return `<div class="field-stack"><div class="field-heading-inline"><label class="field-label" for="rs-${key}-range">${label}</label><button class="text-link" data-action="reset-${key}">Reset to 100%</button></div><div class="range-line"><input id="rs-${key}-range" type="range" min="50" max="300" step="5" data-field="${key}" aria-label="${label}" value="${draft[key]}"><label class="unit-inside"><input type="number" min="50" max="300" step="5" data-field="${key}" value="${draft[key]}" aria-label="${label} percent" aria-describedby="rs-error-${key}"><span>%</span></label></div><div class="range-endpoints"><span>50%</span><span>300%</span></div>${errorSlot(key)}</div>`;
}
function sizesCard() {
  return card('sizes','Font sizes', sizeRow('roomNameScale','Room name size')+sizeRow('roomLabelScale','Metrics size')+hint(`On top of the space-wide card size (${Math.round(SPACE.cardFontScale*100)}%).`), help.button('sizes'));
}

function renderMain() {
  closeHelp();
  content.innerHTML = basicsCard()+fillCard()+sourcesCard()+sizesCard();
  $$('.panel-scroll>.field-stack:first-child', content).forEach(el => { el.style.marginTop = '0'; });
}
function updateChrome() {
  const errors = allErrors();
  $('#rs-save').disabled = !dirty() || errors.length>0;
  const status = $('#rs-status');
  status.classList.toggle('dirty', dirty());
  status.hidden = !dirty() && !errors.length;
  status.textContent = dirty() ? 'Unsaved changes' : '';
  if (errors.length) status.innerHTML = `<button class="text-link" data-action="review-errors">Review ${errors.length} ${errors.length===1?'field':'fields'}</button>`;
  errorFields.forEach(key => { const el = $(`#rs-error-${key}`), m = errorFor(key); if (el) { el.hidden = !m; el.textContent = m; } });
  $$('[data-field="nameSel"]', content).forEach(i => i.setAttribute('aria-invalid', String(!!errorFor('nameSel'))));
  const hex = $('[data-hex="fill"]', content); if (hex) hex.textContent = (draft.roomCustomFill||SPACE.customFill).c.toUpperCase();
}
const render = () => { renderMain(); updateChrome(); };
function rerender(focusSelector) {
  const top = scroller.scrollTop; renderMain(); updateChrome(); scroller.scrollTop = top;
  if (focusSelector) $(focusSelector, content)?.focus({preventScroll:true});
}
function updateField(el) {
  const key = el.dataset.field; if (!key) return;
  if (key==='fillInherit') { draft.roomFill = el.checked ? '' : (SPACE.fill==='custom'?'custom':SPACE.fill); if (el.checked) draft.roomCustomFill = null; rerender(); return; }
  if (key==='roomFill') { draft.roomFill = el.value; if (el.value!=='custom') draft.roomCustomFill = null; rerender(`[data-field="roomFill"]:checked`); return; }
  if (key==='fillColor' || key==='fillOpacity') {
    const cur = draft.roomCustomFill || clone(SPACE.customFill);
    if (key==='fillColor') cur.c = el.value; else { const n = Math.min(100, Math.max(0, Number(el.value))); if (Number.isFinite(n)) cur.a = n/100; }
    const wasOwn = !!draft.roomCustomFill; draft.roomCustomFill = cur;
    if (!wasOwn) rerender(`[data-field="${key}"]`); else updateChrome(); return;
  }
  if (key==='roomTempSrcMode' || key==='roomHumSrcMode') {
    const kind = key==='roomTempSrcMode' ? 'temp' : 'hum', field = kind==='temp' ? 'roomTempSrc' : 'roomHumSrc';
    if (el.value==='average') { draft[field] = ''; srcOpen = null; } else { srcOpen = kind; srcFilter = ''; }
    rerender(); return;
  }
  if (key==='roomNameScale' || key==='roomLabelScale') { draft[key] = el.value==='' ? '' : Number(el.value); $$(`[data-field="${key}"]`, content).filter(x=>x!==el).forEach(x=>{ x.value = el.value; }); updateChrome(); return; }
  draft[key] = el.value; updateChrome();
}
function handleAction(button) {
  const action = button.dataset.action;
  if (action==='review-errors') { const first = allErrors()[0]; if (!first) return; const field = $(`[data-field="${first[0]==='tempRange'?'roomTempMin':first[0]}"]`, content); field?.scrollIntoView({block:'center'}); field?.focus({preventScroll:true}); return; }
  if (action==='reset-fill') draft.roomCustomFill = null;
  if (action==='reset-temp') { draft.roomTempMin = ''; draft.roomTempMax = ''; }
  if (action==='reset-roomNameScale') draft.roomNameScale = 100;
  if (action==='reset-roomLabelScale') draft.roomLabelScale = 100;
  if (action==='src-toggle') { srcOpen = srcOpen===button.dataset.kind ? null : button.dataset.kind; srcFilter = ''; rerender(srcOpen?`[data-src-filter="${srcOpen}"]`:`[data-action="src-toggle"][data-kind="${button.dataset.kind}"]`); return; }
  if (action==='src-pick') { draft[button.dataset.kind==='temp'?'roomTempSrc':'roomHumSrc'] = button.dataset.value; srcOpen = null; rerender(`[data-action="src-toggle"][data-kind="${button.dataset.kind}"]`); return; }
  rerender();
}

/* Open, close, save. */
let closeDecision, lastSubTrigger;
function openSettings() { saved = load(); draft = clone(saved); srcOpen = null; render(); if (!dialog.open) dialog.show(); scroller.scrollTop = 0; $('#rs-title').focus({preventScroll:true}); }
function closeSettings() { dialog.close(); notifyDemoFormClosed('room-settings'); }
function showSub(title, body, actions) {
  lastSubTrigger = document.activeElement;
  subDialog.innerHTML = `<div class="sub-heading"><h2 id="rs-sub-title">${title}</h2><button class="icon-button" aria-label="Close dialog" data-sub="close">${icon('close')}</button></div>${body}<div class="sub-actions">${actions}</div>`;
  subDialog.showModal();
}
function closeSub() { subDialog.close(); lastSubTrigger?.focus({preventScroll:true}); if (closeDecision) { const r = closeDecision; closeDecision = undefined; r(false); } }
function requestClose() {
  if (!dirty()) { closeSettings(); return Promise.resolve(true); }
  showSub('Discard your changes?', `<p>Your changes to <strong>${escape(saved.nameSel)}</strong> haven’t been saved.</p>`, '<button class="button" data-sub="discard">Discard changes</button><button class="button primary" data-sub="close">Keep editing</button>');
  $('[data-sub="close"].primary', subDialog).focus();
  return new Promise(resolve => { closeDecision = resolve; });
}
function saveSettings() {
  if (!dirty() || allErrors().length) return;
  const normalized = {...clone(draft), nameSel:draft.nameSel.trim()};
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch { showToast('Could not save locally. Enable browser storage and try again.'); return; }
  saved = clone(normalized); draft = clone(saved); closeSettings(); showToast('Room settings saved in this browser.');
}

content.addEventListener('input', e => {
  if (e.target.dataset.srcFilter) { srcFilter = e.target.value; const pos = e.target.selectionStart; rerender(`[data-src-filter="${e.target.dataset.srcFilter}"]`); const f = $(`[data-src-filter="${srcOpen}"]`, content); if (f) f.setSelectionRange(pos, pos); return; }
  if (['checkbox','radio'].includes(e.target.type) || e.target.tagName==='SELECT') return;
  updateField(e.target);
});
content.addEventListener('change', e => { if (['checkbox','radio'].includes(e.target.type) || e.target.tagName==='SELECT') updateField(e.target); });
content.addEventListener('click', e => { const b = e.target.closest('button[data-action]'); if (b) handleAction(b); });
$('#rs-status').addEventListener('click', e => { const b = e.target.closest('button[data-action]'); if (b) handleAction(b); });
$('#rs-close').addEventListener('click', requestClose);
$('#rs-cancel').addEventListener('click', requestClose);
$('#rs-save').addEventListener('click', saveSettings);
dialog.addEventListener('cancel', e => { e.preventDefault(); requestClose(); });
dialog.addEventListener('keydown', e => {
  if (e.key==='Escape' && helpOpen()) { e.preventDefault(); e.stopPropagation(); closeHelp(); return; }
  if (e.key==='Escape' && srcOpen) { e.preventDefault(); e.stopPropagation(); const k = srcOpen; srcOpen = null; rerender(`[data-action="src-toggle"][data-kind="${k}"]`); return; }
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
registerDemoForm({id:'room-settings', title:'Room settings', description:'Name, area, fill override, sensor sources and font sizes of one room.', open:openSettings, requestClose});
