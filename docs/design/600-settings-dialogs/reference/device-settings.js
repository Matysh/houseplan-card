/* Device on the plan: design prototype of the marker dialog (edit mode).
   Same visual system as the other forms. Field keys mirror the product's marker dialog state
   (name, bindingMode, binding, showEntities, room, tap, tapConfirm, controls, lightRole, glowMode, glowColor,
   glowBrightness, glowRadius, icon, iconPinned, display, badge*, pulse*, iconScale, rotate, model, link, description, pdfs, isRadar). */
import {registerDemoForm, notifyDemoFormClosed} from './demo-shell.js';
import {$, $$, escape, clone, icon, hydrateIcons, showToast, attachHelp, closeHelp, helpOpen} from './ui.js';

const STORAGE_KEY = 'houseplan-device-settings-design-v1';
const HA_LIST = [
  {value:'device:wall-lamp-3', label:'Wall Lamp 3', sub:'Philips Hue · device', entity:false},
  {value:'entity:light.wall_lamp_3', label:'Wall Lamp 3', sub:'entity:light.wall_lamp_3', entity:true},
  {value:'device:ceiling-spots', label:'Ceiling spots', sub:'Philips Hue · device', entity:false},
  {value:'entity:light.ceiling_spots', label:'Ceiling spots', sub:'entity:light.ceiling_spots', entity:true},
  {value:'device:aqara-th-1', label:'Kitchen climate sensor', sub:'Aqara TH · device', entity:false},
  {value:'entity:sensor.kitchen_temperature', label:'Kitchen temperature', sub:'entity:sensor.kitchen_temperature', entity:true},
];
const ROOMS = [['', '— by device area (auto) —'],['ground:kitchen','Ground Floor · Kitchen & Living'],['ground:hallway','Ground Floor · Hallway'],['first:bedroom','First Floor · Bedroom']];
const LIGHTS = [{id:'light.ceiling_spots',label:'Ceiling spots',sub:'light.ceiling_spots'},{id:'light.floor_lamp',label:'Floor lamp',sub:'light.floor_lamp'},{id:'switch.hallway',label:'Hallway switch',sub:'switch.hallway'},{id:'light.led_strip',label:'LED strip',sub:'light.led_strip'}];
const TAPS = [['info','Device card'],['more_info','HA more-info dialog'],['toggle','Toggle state'],['run','Run automation/script/scene'],['none','Do nothing']];
const DISPLAYS = [['badge','Icon + state','The icon and dynamic plate show device state without the ordinary activity pulse. Red alarms remain visible.'],['icon_ripple','Icon + state and activity','The icon, dynamic plate and pulse show a short pulse for events and a continuous pulse for work, motion or presence. Red alarms have priority.'],['value','Value + state','A selected or automatically resolved Home Assistant value replaces the icon while the plate continues to show state. Red alarms remain visible.'],['static_icon','Always static icon','The theme-aware shell and icon always stay the same. State, activity, unavailability and alarms do not change the face.'],['value_static','Value + static icon','A selected value replaces the icon on a static shell.']];
const BADGE_SOURCES = [['state','State · Wall Lamp 3 · Off','light.wall_lamp_3'],['brightness','Brightness · Wall Lamp 3','light.wall_lamp_3 · brightness'],['lqi','Average Zigbee signal quality','']];
const GENERAL_GLOW_RADIUS = 3;

const defaults = {
  name:'Wall Lamp 3', bindingMode:'ha', binding:'entity:light.wall_lamp_3', showEntities:true, room:'ground:kitchen',
  tap:'toggle', tapConfirm:false, controls:[],
  lightRole:'auto', glowMode:'auto', glowColor:'#ffd9a0', glowBrightness:100, glowRadius:'1.5',
  icon:'', iconPinned:false, display:'badge', badgeEnabled:false, badgeSource:'state', badgePosition:'top',
  pulseColor:'#ffd45c', pulseSize:100, iconScale:1, rotate:0,
  model:'', link:'', description:'', pdfs:[], isRadar:false,
};
function load() {
  try { const d = JSON.parse(localStorage.getItem(STORAGE_KEY)); return d && Object.keys(defaults).every(k => k in d) ? d : clone(defaults); }
  catch { return clone(defaults); }
}
let saved = load(), draft = clone(saved);
let pickOpen = false, pickFilter = '', ctrlFilter = '', ctrlOpen = false;
const dirty = () => JSON.stringify(draft) !== JSON.stringify(saved);

/* Dialog shell. */
const dialog = document.createElement('dialog');
dialog.id = 'device-settings'; dialog.className = 'settings-dialog'; dialog.setAttribute('aria-labelledby', 'ds-title');
dialog.innerHTML = `
  <header class="dialog-header">
    <button type="button" id="ds-close" class="icon-button" aria-label="Close device settings" title="Close" data-icon="close"></button>
    <h1 id="ds-title" tabindex="-1">Device on the plan</h1>
    <span id="ds-crumb" class="space-badge">Kitchen &amp; Living</span>
  </header>
  <div class="dialog-scroll" id="ds-scroll"><div class="dialog-body"><div id="ds-content" class="settings-content"></div></div></div>
  <footer class="dialog-footer">
    <div class="footer-tools"><button class="button" id="ds-hide" type="button"><span data-icon="eyeOff"></span>Hide</button><button class="button danger-outline" id="ds-delete" type="button"><span data-icon="trash"></span>Delete</button></div>
    <div class="save-status" id="ds-status" role="status" hidden></div>
    <div class="footer-commit"><button class="button" id="ds-cancel" type="button">Cancel</button><button class="button primary" id="ds-save" type="button" disabled>Save</button></div>
  </footer>`;
$('#demo-stage').append(dialog);
const subDialog = document.createElement('dialog');
subDialog.id = 'ds-sub-dialog'; subDialog.className = 'sub-dialog'; subDialog.setAttribute('aria-labelledby', 'ds-sub-title');
document.body.append(subDialog);
const content = $('#ds-content'), scroller = $('#ds-scroll');

const helpCopy = {
  binding:['Bind to an HA device','A bound marker shows the live state of a Home Assistant device or entity and can act on it. A virtual device is a plain marker with no binding.'],
  controls:['Controls other light sources','With the “Toggle state” action, the listed sources toggle together with this marker. Their glow stays at their own markers, and the room counts them as usual.'],
  lightRole:['Is this device a light source?','“Auto” uses the bound device’s resolved role, “Always” forces its own source and “Never” excludes it; linked lights above remain independent.'],
  glowMode:['Glow colour and brightness','Use live source values, override only its colour, or fix both colour and brightness. The minimum is 1%; to disable the source, choose “Never a light source”.'],
  glowRadius:['Glow radius','Sets the glow radius in metres or feet; an empty value uses the radius from general settings.'],
  icon:['Icon','Empty means automatic: the icon comes from the icon rules for this device. Pick one to override, or pin the automatic choice.'],
  display:['Display','How the marker face reacts to state and activity. The value modes replace the icon with a Home Assistant value.'],
  badge:['Value badge','Shows one selected value next to the icon. It does not affect room metrics, light, Glow or the tap action.'],
  badgeSource:['Value','Choose a specific state, supported attribute, or derived value of this device.'],
  badgePosition:['Position','The chosen side stays fixed and does not flip automatically at a plan edge.'],
  size:['Icon size and rotation','Scales and rotates only this marker on the plan. The tap area grows with the icon.'],
};
const help = attachHelp(content, scroller, helpCopy);

/* Rendering helpers. */
const card = (id, title, body, extra='') => `<section id="ds-section-${id}" class="settings-card" aria-labelledby="ds-heading-${id}"><div class="card-heading"><div class="card-title"><h2 id="ds-heading-${id}">${title}</h2>${extra}</div></div><div class="panel-scroll">${body}</div></section>`;
const hint = text => `<p class="field-hint">${text}</p>`;
const callout = (text, warning=false) => `<div class="callout ${warning?'warning':''}">${icon('info')}<p>${text}</p></div>`;
const fieldHeading = (text, key, forId='') => `<div class="field-heading-with-help"><label class="field-label" ${forId?`for="${forId}"`:''}>${text}</label>${key?help.button(key):''}</div>`;
const subsectionHeading = (text, key='') => `<div class="subsection-heading"><h3>${text}</h3>${key?help.button(key):''}</div>`;
function segmented(key, values, label, current, disabled=false) {
  return `<div class="segmented ${disabled?'disabled':''}" role="radiogroup" aria-label="${label}">${values.map(([value,title])=>`<label class="segment"><input type="radio" name="ds-${key}" data-field="${key}" value="${value}" ${current===value?'checked':''} ${disabled?'disabled':''}><span>${title}</span></label>`).join('')}</div>`;
}
function toggle(key, title, description, name, checked, compact=false, disabled=false) {
  return `<div class="setting-item ${compact?'compact':''}"><div class="setting-row ${compact?'compact':''}"><span class="row-icon">${icon(name)}</span><div class="row-copy"><div class="row-title"><label for="ds-toggle-${key}"><strong>${title}</strong></label></div>${description&&!compact?`<small>${description}</small>`:''}</div><span class="switch"><input id="ds-toggle-${key}" type="checkbox" role="switch" aria-label="${title}" data-field="${key}" ${checked?'checked':''} ${disabled?'disabled':''}><span class="switch-track"></span></span></div></div>`;
}
const selectField = (key, label, options, current, helpKey='', id='') => `<div class="field-stack">${fieldHeading(label, helpKey, id||`ds-${key}`)}<select id="${id||`ds-${key}`}" class="select-input" data-field="${key}">${options.map(([v,t])=>`<option value="${v}" ${current===v?'selected':''}>${t}</option>`).join('')}</select></div>`;
const rangeField = (key, label, min, max, step, value, unit, helpKey='') => `<div class="field-stack"><div class="field-heading-inline">${fieldHeading(label, helpKey, `ds-${key}-range`)}</div><div class="range-line"><input id="ds-${key}-range" type="range" min="${min}" max="${max}" step="${step}" data-field="${key}" aria-label="${label}" value="${value}"><label class="unit-inside"><input type="number" min="${min}" max="${max}" step="${step}" data-field="${key}" value="${value}" aria-label="${label} value"><span>${unit}</span></label></div></div>`;

const errorFor = key => {
  if (key==='name' && !draft.name.trim()) return 'Enter a name for this device.';
  if (key==='binding' && draft.bindingMode==='ha' && !draft.binding) return 'Choose a device or entity to bind.';
  if (key==='glowRadius' && draft.glowRadius!=='' && !(Number(draft.glowRadius.replace(',','.'))>0)) return 'Enter a radius greater than 0, or leave it empty.';
  if (key==='link' && draft.link.trim() && !/^https?:\/\//i.test(draft.link.trim())) return 'Enter a link that starts with http:// or https://.';
  return '';
};
const errorFields = ['name','binding','glowRadius','link'];
const allErrors = () => errorFields.map(k=>[k,errorFor(k)]).filter(([,m])=>m);
const errorSlot = key => `<div class="error" id="ds-error-${key}" aria-live="polite" ${errorFor(key)?'':'hidden'}>${errorFor(key)}</div>`;
const bound = () => HA_LIST.find(x => x.value===draft.binding);
const boundEntity = () => draft.bindingMode==='ha' && draft.binding ? (draft.binding.startsWith('entity:') ? draft.binding.slice(7) : 'light.wall_lamp_3') : '';

function basicsCard() {
  const b = bound();
  const list = HA_LIST.filter(x => (draft.showEntities || !x.entity) && (!pickFilter || (x.label+' '+x.sub).toLowerCase().includes(pickFilter.toLowerCase())));
  const picker = draft.bindingMode==='ha' ? `<div class="source-picker ${pickOpen?'open':''}"><button type="button" class="select-input source-button" data-action="pick-toggle" aria-expanded="${pickOpen}" aria-describedby="ds-error-binding">${b?`<b>${escape(b.label)}</b><span class="source-ref">${escape(b.sub)}</span>`:`<span class="source-placeholder">Choose a device…</span>`}</button>${pickOpen?`<div class="source-panel"><div class="source-toolbar"><input class="text-input" type="text" placeholder="Search device / group…" data-pick-filter value="${escape(pickFilter)}" autocomplete="off"><label class="inline-check" title="Adds not only devices to the list, but all their entities too"><input type="checkbox" data-field="showEntities" ${draft.showEntities?'checked':''}><span>Show entities</span></label></div><div class="source-list">${list.map(x=>`<button type="button" class="source-candidate ${x.value===draft.binding?'selected':''}" data-action="pick" data-value="${x.value}"><span>${escape(x.label)}</span><small>${escape(x.sub)}</small></button>`).join('')||'<p class="field-hint">Nothing found.</p>'}</div></div>`:''}${errorSlot('binding')}</div>` : hint('A virtual device is a plain marker on the plan without live state.');
  return card('basics','Basics',
    `<div class="field"><label class="field-label" for="ds-name">Name</label><input id="ds-name" class="text-input" type="text" data-field="name" value="${escape(draft.name)}" placeholder="Name" maxlength="80" autocomplete="off" aria-describedby="ds-error-name" aria-invalid="${!!errorFor('name')}">${errorSlot('name')}${hint('Shown on the plan.')}</div>`+
    `<div class="field-stack">${fieldHeading('Bind to an HA device','binding')}${segmented('bindingMode',[['virtual','Virtual device'],['ha','Pick from the HA list']],'Bind to an HA device',draft.bindingMode)}${picker}</div>`+
    `<div class="field-stack"><label class="field-label" for="ds-room">Room</label><select id="ds-room" class="select-input" data-field="room">${ROOMS.map(([v,t])=>`<option value="${v}" ${draft.room===v?'selected':''}>${t}</option>`).join('')}</select>${hint(draft.room?'Overrides the placement by device area.':'Placed by the device’s Home Assistant area.')}</div>`
  );
}
function tapCard() {
  const ent = boundEntity();
  const tapNote = draft.tap==='toggle' ? (ent ? hint(`Target: ${escape(draft.name)} (${ent}). Now: Off → will turn on.`) : callout('A virtual device has nothing to toggle. Bind it to a Home Assistant device first.',true))
    : draft.tap==='run' ? `<div class="field-stack"><label class="field-label" for="ds-run">What to run</label><input id="ds-run" class="text-input" type="text" placeholder="Search automations, scripts and scenes…" data-field="runTarget" autocomplete="off"></div>` : '';
  const ctrl = draft.controls.map(id => LIGHTS.find(l=>l.id===id)).filter(Boolean);
  const cands = LIGHTS.filter(l => !draft.controls.includes(l.id) && (!ctrlFilter || (l.label+' '+l.sub).toLowerCase().includes(ctrlFilter.toLowerCase())));
  return card('tap','Tap action',
    selectField('tap','Tap action for this device',TAPS,draft.tap)+tapNote+
    (draft.tap==='none' ? '' : `<div class="subsection">${toggle('tapConfirm','Ask for confirmation','Show a confirmation dialog before acting, a guard against accidental taps.','check',draft.tapConfirm)}</div>`)+
    `<div class="subsection">${fieldHeading('Controls other light sources','controls','ds-ctrl-filter')}${ctrl.length?`<div class="chip-row">${ctrl.map(l=>`<span class="chip">${icon('bulb')}<span>${escape(l.label)}</span><button type="button" class="chip-remove" data-action="ctrl-remove" data-id="${l.id}" aria-label="Remove ${escape(l.label)}">${icon('close')}</button></span>`).join('')}</div>`:''}<div class="source-picker ${ctrlOpen?'open':''}"><input id="ds-ctrl-filter" class="text-input" type="text" placeholder="Search lights and switches…" data-ctrl-filter value="${escape(ctrlFilter)}" autocomplete="off">${ctrlOpen?`<div class="source-panel"><div class="source-list">${cands.map(l=>`<button type="button" class="source-candidate" data-action="ctrl-add" data-id="${l.id}"><span>${escape(l.label)}</span><small>${escape(l.sub)}</small></button>`).join('')||'<p class="field-hint">Nothing found.</p>'}</div></div>`:''}</div></div>`
  );
}
function lightCard() {
  const never = draft.lightRole==='never';
  const roleHint = draft.lightRole==='auto' ? hint(draft.bindingMode==='ha' ? 'Auto: resolved as a light source.' : 'Auto: a virtual device is not a light source.') : '';
  const glowDetail = draft.glowMode==='auto' ? '' : `<div class="field-stack"><label class="field-label" for="ds-glow-color">Glow colour</label><div class="color-field"><input id="ds-glow-color" class="color-input" type="color" data-field="glowColor" value="${draft.glowColor}" aria-label="Glow colour" ${never?'disabled':''}><span class="hex-code" data-hex="glow">${draft.glowColor.toUpperCase()}</span></div></div>`+
    (draft.glowMode==='fixed' ? rangeField('glowBrightness','Brightness',1,100,1,draft.glowBrightness,'%') : '');
  return card('light','Light and glow',
    `<div class="field-stack">${fieldHeading('Is this device a light source?','lightRole')}${segmented('lightRole',[['auto','Auto'],['always','Always'],['never','Never']],'Is this device a light source?',draft.lightRole)}${roleHint}</div>`+
    `<div class="subsection ${never?'is-disabled':''}">${fieldHeading('Glow colour and brightness','glowMode')}${segmented('glowMode',[['auto','From source'],['color','Set colour'],['fixed','Colour and brightness']],'Glow colour and brightness',draft.glowMode,never)}${never?'':glowDetail}`+
    `<div class="field-stack">${fieldHeading('Glow radius','glowRadius','ds-glow-radius')}<div class="field-unit"><span class="unit-inside"><input id="ds-glow-radius" type="number" min="0.1" step="0.1" data-field="glowRadius" value="${escape(draft.glowRadius)}" placeholder="${GENERAL_GLOW_RADIUS}" aria-describedby="ds-error-glowRadius" ${never?'disabled':''}><span>m</span></span></div>${errorSlot('glowRadius')}${draft.glowRadius===''?hint(`Empty: uses the general radius (${GENERAL_GLOW_RADIUS} m).`):''}</div>`+
    (never?callout('Glow settings are unavailable because this marker is explicitly not a light source.'):'')+`</div>`
  );
}
function appearanceCard() {
  const autoIcon = 'mdi:lightbulb';
  const iconField = `<div class="field-stack">${fieldHeading('Icon','icon','ds-icon')}<div class="icon-field"><span class="icon-preview">${icon('bulb')}</span><input id="ds-icon" class="text-input" type="text" data-field="icon" value="${escape(draft.icon)}" placeholder="mdi:… (empty = auto)" autocomplete="off">${draft.icon?`<button type="button" class="icon-button small" data-action="icon-clear" aria-label="Clear icon">${icon('close')}</button>`:''}</div>${draft.icon?hint('Custom icon for this marker.'):`<p class="field-hint">Auto: ${autoIcon} (by icon rules). ${draft.iconPinned?'Pinned.':`<button type="button" class="text-link" data-action="icon-pin">Pin</button>`}</p>`}</div>`;
  const mode = DISPLAYS.find(d=>d[0]===draft.display);
  const displayField = `<div class="field-stack">${fieldHeading('Display','display','ds-display')}<select id="ds-display" class="select-input" data-field="display">${DISPLAYS.map(([v,t])=>`<option value="${v}" ${draft.display===v?'selected':''}>${t}</option>`).join('')}</select>${hint(mode[2])}</div>`+
    (draft.display==='icon_ripple' ? `<div class="field-stack"><label class="field-label" for="ds-pulse-color">Activity pulse color</label><div class="color-field"><input id="ds-pulse-color" class="color-input" type="color" data-field="pulseColor" value="${draft.pulseColor}" aria-label="Activity pulse color"><span class="hex-code" data-hex="pulse">${draft.pulseColor.toUpperCase()}</span></div></div>`+rangeField('pulseSize','Activity pulse size',50,200,5,draft.pulseSize,'%') : '');
  const isStatic = draft.display==='static_icon';
  const badgeSrc = BADGE_SOURCES.find(s=>s[0]===draft.badgeSource);
  const badge = `<div class="subsection">${subsectionHeading('Value badge','badge')}${toggle('badgeEnabled','Show a value badge','',isStatic?'eyeOff':'card',draft.badgeEnabled,true)}${draft.badgeEnabled ? (isStatic ? callout('A static icon does not show live values. The setting is preserved.') : (draft.bindingMode!=='ha' ? callout('A virtual device has no Home Assistant value to show.',true) : `<div class="field-stack">${fieldHeading('Value','badgeSource','ds-badge-source')}<select id="ds-badge-source" class="select-input" data-field="badgeSource">${BADGE_SOURCES.map(([v,t])=>`<option value="${v}" ${draft.badgeSource===v?'selected':''}>${t}</option>`).join('')}</select>${badgeSrc[2]?`<p class="field-hint mono">${badgeSrc[2]}</p>`:''}</div><div class="field-stack">${fieldHeading('Position','badgePosition')}${segmented('badgePosition',[['top','Above'],['right','Right'],['bottom','Below'],['left','Left']],'Position',draft.badgePosition)}</div>`)) : ''}</div>`;
  const preview = `<div class="subsection"><div class="preview-block"><div class="preview-head"><h3>Display preview</h3><span class="preview-tag">Now</span></div><div class="preview-body"><div class="preview-stage"><div class="marker-mock pos-${draft.badgeEnabled&&!isStatic&&draft.bindingMode==='ha'?draft.badgePosition:'none'}" style="--scale:${draft.iconScale};--rot:${draft.rotate}deg"><span class="marker-plate">${icon('bulb')}</span>${draft.badgeEnabled&&!isStatic&&draft.bindingMode==='ha'?'<span class="marker-badge">Off</span>':''}</div></div><dl class="preview-facts"><dt>Provided by</dt><dd>${draft.bindingMode==='ha'?'template':'House Plan · virtual device'}</dd><dt>Display source</dt><dd>${draft.bindingMode==='ha'?`${escape(draft.name)} · ${boundEntity()}`:'No active source'}</dd><dt>Current state</dt><dd>${draft.bindingMode==='ha'?'Off':'No current state'}</dd><dt>On the plan</dt><dd>${isStatic?'Static mode: state does not change the icon':'Neutral dark plate'}</dd></dl></div></div></div>`;
  const size = `<div class="subsection">${subsectionHeading('Icon size and rotation','size')}<div class="field-grid rs-grid">${rangeField('iconScale','Size',0.5,3,0.1,draft.iconScale,'×')}${rangeField('rotate','Rotation',0,359,1,draft.rotate,'°')}</div></div>`;
  return card('appearance','Appearance', iconField+displayField+badge+preview+size);
}
function detailsCard() {
  return card('details','Details',
    `<div class="field-grid rs-grid"><div class="field"><label class="field-label" for="ds-model">Model</label><input id="ds-model" class="text-input" type="text" data-field="model" value="${escape(draft.model)}" placeholder="e.g. Aqara T&H" autocomplete="off"></div><div class="field"><label class="field-label" for="ds-link">Link</label><input id="ds-link" class="text-input" type="url" data-field="link" value="${escape(draft.link)}" placeholder="https://…" autocomplete="off" aria-describedby="ds-error-link" aria-invalid="${!!errorFor('link')}">${errorSlot('link')}</div></div>`+
    `<div class="field-stack"><label class="field-label" for="ds-desc">Description</label><textarea id="ds-desc" class="text-input textarea" rows="3" data-field="description" placeholder="Notes, specs…">${escape(draft.description)}</textarea></div>`+
    `<div class="field-stack"><span class="field-label">Manuals (PDF etc.)</span>${draft.pdfs.length?`<div class="chip-row">${draft.pdfs.map((p,i)=>`<span class="chip">${icon('folder')}<span>${escape(p)}</span><button type="button" class="chip-remove" data-action="pdf-remove" data-index="${i}" aria-label="Remove ${escape(p)}">${icon('close')}</button></span>`).join('')}</div>`:''}<div class="action-line"><button class="button" type="button" data-action="attach">${icon('upload')}Attach…</button></div></div>`+
    `<div class="subsection">${subsectionHeading('Additional actions')}${toggle('isRadar','This is a presence radar','Declares this device as a presence radar and opens its calibration.','radar',draft.isRadar)}</div>`
  );
}

function renderMain() {
  closeHelp();
  content.innerHTML = basicsCard()+tapCard()+lightCard()+appearanceCard()+detailsCard();
  $$('.panel-scroll>.field-stack:first-child', content).forEach(el => { el.style.marginTop = '0'; });
}
function updateChrome() {
  const errors = allErrors();
  $('#ds-save').disabled = !dirty() || errors.length>0;
  const status = $('#ds-status');
  status.classList.toggle('dirty', dirty()); status.hidden = !dirty() && !errors.length; status.textContent = dirty() ? 'Unsaved changes' : '';
  if (errors.length) status.innerHTML = `<button class="text-link" data-action="review-errors">Review ${errors.length} ${errors.length===1?'field':'fields'}</button>`;
  errorFields.forEach(key => { const el = $(`#ds-error-${key}`), m = errorFor(key); if (el) { el.hidden = !m; el.textContent = m; } });
  $$('[data-hex]', content).forEach(el => { el.textContent = (el.dataset.hex==='glow'?draft.glowColor:draft.pulseColor).toUpperCase(); });
  const mock = $('.marker-mock', content); if (mock) { mock.style.setProperty('--scale', draft.iconScale); mock.style.setProperty('--rot', `${draft.rotate}deg`); }
}
const render = () => { renderMain(); updateChrome(); };
function rerender(focusSelector) { const top = scroller.scrollTop; renderMain(); updateChrome(); scroller.scrollTop = top; if (focusSelector) $(focusSelector, content)?.focus({preventScroll:true}); }
const RERENDER_KEYS = new Set(['bindingMode','room','tap','lightRole','glowMode','display','badgeEnabled','badgeSource','badgePosition','showEntities','glowRadius','icon']);
function updateField(el) {
  const key = el.dataset.field; if (!key) return;
  if (['iconScale','rotate','glowBrightness','pulseSize'].includes(key)) { const n = Number(el.value); if (Number.isFinite(n)) draft[key] = n; $$(`[data-field="${key}"]`, content).filter(x=>x!==el).forEach(x=>{ x.value = el.value; }); updateChrome(); return; }
  if (el.type==='checkbox') draft[key] = el.checked; else draft[key] = el.value;
  if (key==='bindingMode' && el.value==='virtual') pickOpen = false;
  if (key==='glowRadius' || key==='icon') { updateChrome(); const wasEmpty = el.value===''; if ((key==='glowRadius' && (wasEmpty || el.value.length===1)) || (key==='icon' && (wasEmpty || el.value.length===1))) rerender(`[data-field="${key}"]`); return; }
  if (RERENDER_KEYS.has(key)) rerender(el.type==='radio'?`[data-field="${key}"]:checked`:`[data-field="${key}"]`); else updateChrome();
}
function handleAction(button) {
  const a = button.dataset.action;
  if (a==='review-errors') { const first = allErrors()[0]; if (!first) return; const field = $(`[data-field="${first[0]}"], [data-action="pick-toggle"]`, content); field?.scrollIntoView({block:'center'}); field?.focus({preventScroll:true}); return; }
  if (a==='pick-toggle') { pickOpen = !pickOpen; pickFilter = ''; rerender(pickOpen?'[data-pick-filter]':'[data-action="pick-toggle"]'); return; }
  if (a==='pick') { draft.binding = button.dataset.value; pickOpen = false; rerender('[data-action="pick-toggle"]'); return; }
  if (a==='ctrl-add') { draft.controls.push(button.dataset.id); ctrlFilter = ''; ctrlOpen = true; rerender('#ds-ctrl-filter'); return; }
  if (a==='ctrl-remove') { draft.controls = draft.controls.filter(id => id!==button.dataset.id); rerender('#ds-ctrl-filter'); return; }
  if (a==='icon-clear') { draft.icon = ''; rerender('#ds-icon'); return; }
  if (a==='icon-pin') { draft.iconPinned = true; draft.icon = 'mdi:lightbulb'; rerender('#ds-icon'); return; }
  if (a==='attach') { draft.pdfs.push(draft.pdfs.length ? `datasheet-${draft.pdfs.length+1}.pdf` : 'manual.pdf'); rerender(); showToast('The product opens a file picker here; a sample file was attached.'); return; }
  if (a==='pdf-remove') { draft.pdfs.splice(Number(button.dataset.index), 1); rerender(); return; }
}

/* Open, close, save. */
let closeDecision, lastSubTrigger;
function openSettings() { saved = load(); draft = clone(saved); pickOpen = false; ctrlOpen = false; render(); if (!dialog.open) dialog.show(); scroller.scrollTop = 0; $('#ds-title').focus({preventScroll:true}); }
function closeSettings() { dialog.close(); notifyDemoFormClosed('device-settings'); }
function showSub(title, body, actions) {
  lastSubTrigger = document.activeElement;
  subDialog.innerHTML = `<div class="sub-heading"><h2 id="ds-sub-title">${title}</h2><button class="icon-button" aria-label="Close dialog" data-sub="close">${icon('close')}</button></div>${body}<div class="sub-actions">${actions}</div>`;
  subDialog.showModal();
}
function closeSub() { subDialog.close(); lastSubTrigger?.focus({preventScroll:true}); if (closeDecision) { const r = closeDecision; closeDecision = undefined; r(false); } }
function requestClose() {
  if (!dirty()) { closeSettings(); return Promise.resolve(true); }
  showSub('Discard your changes?', `<p>Your changes to <strong>${escape(saved.name)}</strong> haven’t been saved.</p>`, '<button class="button" data-sub="discard">Discard changes</button><button class="button primary" data-sub="close">Keep editing</button>');
  $('[data-sub="close"].primary', subDialog).focus();
  return new Promise(resolve => { closeDecision = resolve; });
}
function saveSettings() {
  if (!dirty() || allErrors().length) return;
  const normalized = {...clone(draft), name:draft.name.trim(), link:draft.link.trim()};
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch { showToast('Could not save locally. Enable browser storage and try again.'); return; }
  saved = clone(normalized); draft = clone(saved); closeSettings(); showToast('Device settings saved in this browser.');
}

content.addEventListener('input', e => {
  if (e.target.dataset.pickFilter!==undefined) { pickFilter = e.target.value; const pos = e.target.selectionStart; rerender('[data-pick-filter]'); $('[data-pick-filter]', content)?.setSelectionRange(pos, pos); return; }
  if (e.target.dataset.ctrlFilter!==undefined) { ctrlFilter = e.target.value; ctrlOpen = true; const pos = e.target.selectionStart; rerender('#ds-ctrl-filter'); $('#ds-ctrl-filter', content)?.setSelectionRange(pos, pos); return; }
  if (['checkbox','radio'].includes(e.target.type) || e.target.tagName==='SELECT') return;
  updateField(e.target);
});
content.addEventListener('focusin', e => { if (e.target.id==='ds-ctrl-filter' && !ctrlOpen) { ctrlOpen = true; rerender('#ds-ctrl-filter'); } });
content.addEventListener('change', e => { if (['checkbox','radio'].includes(e.target.type) || e.target.tagName==='SELECT') updateField(e.target); });
content.addEventListener('click', e => { const b = e.target.closest('button[data-action]'); if (b) handleAction(b); });
document.addEventListener('click', e => { if (ctrlOpen && dialog.open && !e.target.closest('#ds-section-tap .source-picker')) { ctrlOpen = false; ctrlFilter = ''; $('#ds-section-tap .source-panel', content)?.remove(); } });
$('#ds-status').addEventListener('click', e => { const b = e.target.closest('button[data-action]'); if (b) handleAction(b); });
$('#ds-close').addEventListener('click', requestClose);
$('#ds-cancel').addEventListener('click', requestClose);
$('#ds-save').addEventListener('click', saveSettings);
$('#ds-hide').addEventListener('click', () => showToast('The product hides the marker on the plan and keeps its settings.'));
$('#ds-delete').addEventListener('click', () => { showSub('Delete this device?', `<p>Remove <strong>${escape(saved.name)}</strong> from the plan? The Home Assistant device itself is not affected.</p>`, '<button class="button" data-sub="close">Keep device</button><button class="button danger" data-sub="delete">Delete device</button>'); $('[data-sub="close"]', subDialog).focus(); });
dialog.addEventListener('cancel', e => { e.preventDefault(); requestClose(); });
dialog.addEventListener('keydown', e => {
  if (e.key==='Escape' && helpOpen()) { e.preventDefault(); e.stopPropagation(); closeHelp(); return; }
  if (e.key==='Escape' && (pickOpen || ctrlOpen)) { e.preventDefault(); e.stopPropagation(); pickOpen = false; ctrlOpen = false; rerender(); return; }
  if (e.key==='Escape' && !subDialog.open) { e.preventDefault(); e.stopPropagation(); requestClose(); }
});
subDialog.addEventListener('cancel', e => { e.preventDefault(); closeSub(); });
subDialog.addEventListener('click', e => {
  const b = e.target.closest('button[data-sub]'); if (!b) return;
  if (b.dataset.sub==='close') { closeSub(); return; }
  if (b.dataset.sub==='discard') { const r = closeDecision; closeDecision = undefined; draft = clone(saved); closeSub(); closeSettings(); r?.(true); return; }
  if (b.dataset.sub==='delete') { closeSub(); closeSettings(); showToast('Device removed from the plan in this preview.'); }
});
window.addEventListener('beforeunload', e => { if (dialog.open && dirty()) { e.preventDefault(); e.returnValue=''; } });
hydrateIcons(dialog);
registerDemoForm({id:'device-settings', title:'Device on the plan', description:'Binding, tap action, light and glow, appearance and details of one device marker.', open:openSettings, requestClose});
