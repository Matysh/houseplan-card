/* Standalone design prototype. All data stays in this origin's localStorage.
   The field map for the product (SpaceDialogState, i18n keys, controls) is docs/FIELD-MAP.md in the handoff archive. */
import {registerDemoForm, openDemoForm, notifyDemoFormClosed} from './demo-shell.js';
import {DEFAULT_CUSTOM_FILL} from './room-fill.js';
import {$, $$, escape, clone, icon, hydrateIcons, showToast, attachHelp, closeHelp, helpOpen} from './ui.js';
const STORAGE_KEY = 'houseplan-space-settings-design-v1';
const base = {
  title:'Ground Floor', source:'draw', planName:'', planData:'', cellCm:5,
  showBorders:true, zeroWallStyle:'dashed', showNames:true, showLqi:false,
  hideDecor:false, hideOpenings:false, labelTemp:true, labelHum:true, labelLqi:true, labelLight:true,
  cardFontScale:100, roomColor:'#52636b', roomOpacity:85,
  fillMode:'custom', fillColor:DEFAULT_CUSTOM_FILL.c, fillOpacity:DEFAULT_CUSTOM_FILL.a*100, customFillSet:false,
  tempMin:20, tempMax:25, bgMode:'daynight', bgColor:'#edf1f2', bgColorSet:false,
  northDeg:null, sunRays:'inherit', glowEnabled:true,
};
const initialSpaces = [
  // Keep the approved visual example reproducible in a fresh browser.
  {id:'ground-floor', devices:50, settings:{...clone(base),zeroWallStyle:'solid',showLqi:true,roomColor:'#3b4245',fillColor:'#ededed',fillOpacity:100,customFillSet:true}},
  {id:'first-floor', devices:0, settings:{...clone(base),title:'First Floor',source:'file',planName:'first-floor.svg',planData:'assets/sample-plan.svg'}},
];
function loadSpaces() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(data) || !data.length) return clone(initialSpaces);
    const valid = data.every(s => typeof s.id === 'string' && Number.isInteger(s.devices) && s.settings &&
      Object.entries(base).every(([k,v]) => k === 'northDeg' ? s.settings[k] === null || Number.isFinite(s.settings[k]) : typeof s.settings[k] === typeof v));
    return valid ? data : clone(initialSpaces);
  } catch { return clone(initialSpaces); }
}
let spaces = loadSpaces();
let activeId = spaces[0].id;
let saved = clone(spaces[0].settings);
let draft = clone(saved);
const customFill = () => draft.customFillSet?{c:draft.fillColor,a:Number(draft.fillOpacity)/100}:DEFAULT_CUSTOM_FILL;
const currentScroller = () => $('#dialog-scroll');
let lastSubTrigger;
let closeDecision;
const dialog = $('#settings');
const content = $('#settings-content');
const subDialog = $('#sub-dialog');
const dirty = () => JSON.stringify(draft) !== JSON.stringify(saved);
const activeSpace = () => spaces.find(s => s.id === activeId);
function errorFor(key) {
  if(key === 'title' && !draft.title.trim()) return 'Enter a name for this space.';
  if(key === 'cellCm' && (!Number.isFinite(Number(draft.cellCm)) || draft.cellCm === '' || Number(draft.cellCm)<.1 || Number(draft.cellCm)>1000)) return 'Enter a grid size between 0.1 and 1000 cm.';
  if(key === 'source' && draft.source === 'file' && !draft.planData) return 'Choose a floor-plan image to continue.';
  if(key === 'tempMax' && draft.fillMode === 'temp' && (draft.tempMin === '' || draft.tempMax === '' || !Number.isFinite(Number(draft.tempMin)) || !Number.isFinite(Number(draft.tempMax)) || Number(draft.tempMin)>=Number(draft.tempMax))) return 'The maximum must be higher than the minimum.';
  if(key === 'northDeg' && draft.northDeg !== null && (draft.northDeg === '' || !Number.isInteger(Number(draft.northDeg)) || Number(draft.northDeg)<0 || Number(draft.northDeg)>359)) return 'Enter a whole number between 0° and 359°.';
  if(key === 'cardFontScale' && (draft.cardFontScale === '' || draft.cardFontScale<50 || draft.cardFontScale>300)) return 'Choose a size between 50% and 300%.';
  if((key==='roomOpacity' || (key==='fillOpacity' && draft.fillMode==='custom')) && (draft[key] === '' || draft[key]<0 || draft[key]>100)) return 'Enter an opacity between 0% and 100%.';
  return '';
}
const errorFields = ['title','cellCm','source','tempMax','northDeg','cardFontScale','roomOpacity','fillOpacity'];
const allErrors = () => errorFields.map(key => [key,errorFor(key)]).filter(([,message]) => message);
const errorSlot = key => `<div class="error" id="error-${key}" aria-live="polite" ${errorFor(key) ? '' : 'hidden'}>${errorFor(key)}</div>`;
function textField(key, label, options = {}) {
  return `<div class="field"><label class="field-label" for="field-${key}">${label}</label><input class="text-input" id="field-${key}" data-field="${key}" type="${options.type || 'text'}" value="${escape(draft[key])}" ${options.attributes || ''} aria-describedby="${options.hint ? `hint-${key} ` : ''}error-${key}" aria-invalid="${!!errorFor(key)}">${options.hint ? `<p class="field-hint" id="hint-${key}">${options.hint}</p>` : ''}${errorSlot(key)}</div>`;
}
const card = (id, title, body, extra='') => `<section id="section-${id}" class="settings-card" aria-labelledby="heading-${id}"><div class="card-heading"><h2 id="heading-${id}">${title}</h2>${extra}</div><div class="panel-scroll">${body}</div></section>`;
const hint = text => `<p class="field-hint">${text}</p>`;
const info = (text, warning=false) => `<div class="callout ${warning?'warning':''}">${icon('info')}<p>${text}</p></div>`;
const helpCopy = {
  scale:['Grid cell size','The grid sets real-world lengths, areas, wall thickness and opening sizes. Changing it recalculates dimensions for the whole space without moving points on the plan.'],
  floorPlan:['Floor plan','Use an image as a background to draw over. Rooms and devices stay editable on top of it. Switching to drawing by hand keeps the uploaded image available to use again.'],
  borders:['Always show room borders','When off, patterned wall outlines and zero-thickness wall lines are hidden. Plain, light wall bands stay visible, so rooms remain separated. Doors, windows, room fills and lighting keep working.'],
  walls:['Zero-thickness walls','Dashed zero-thickness walls let lamp glow and sunlight pass through. Solid ones block both, even when their lines are hidden on the plan.'],
  fill:['Room fill','Custom uses a fixed color and opacity. Zigbee uses average signal; Lights distinguishes any on, all off and no sources; Temperature uses the comfort range. State colors and opacity come from general settings. Room overrides take priority. If no visible fill is available, enabled light-source glow adds base shading. Sunlight and glow remain separate effects.'],
  layers:['Visible layers','Hiding changes only what you see on the plan. Decorative elements remain available in the background editor. Doors and windows stay in the plan editor, while their sensors, sunlight and lamp glow keep working.'],
  names:['Show room names','Hiding room names also hides their values without clearing your selections. Room-card positions stay where you placed them.'],
  cardSize:['Room-card font size','100% is the default size. This scales every room card in this space while keeping individual card sizes and positions. Changes apply when you save.'],
  north:['North on the plan','North is measured clockwise from the top of the plan: 0° is up, 90° is right. Use general settings follows the home-wide value; a custom direction overrides it only for this space. Your plan does not rotate.'],
  light:['Light-source glow','Lamp glow and sunlight are independent. Hiding opening symbols does not stop either effect. Window glass still lets sunlight in when the window is closed.'],
};
const help = attachHelp($('#settings-content'), $('#dialog-scroll'), helpCopy);
const helpButton = key => help.button(key);
const fieldHeading = (text,help,forId='') => `<div class="field-heading-with-help"><label class="field-label" ${forId?`for="${forId}"`:''}>${text}</label>${helpButton(help)}</div>`;
const subsectionHeading = (text,help) => `<div class="subsection-heading"><h3>${text}</h3>${helpButton(help)}</div>`;
const northNeedle = '<svg class="dial-arrow compass-needle" id="dial-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V3m-6 6 6-6 6 6"/></svg>';
function toggle(key, title, description, name, invert=false, disabled=false, help='') {
  const checked = invert ? !draft[key] : draft[key];
  return `<div class="setting-item"><div class="setting-row"><span class="row-icon">${icon(name)}</span><div class="row-copy"><div class="row-title"><label for="toggle-${key}"><strong>${title}</strong></label>${help?helpButton(help):''}</div>${description?`<small>${description}</small>`:''}</div><span class="switch"><input id="toggle-${key}" type="checkbox" role="switch" aria-label="${title}" data-field="${key}" ${invert?'data-invert="true"':''} ${checked?'checked':''} ${disabled?'disabled':''}><span class="switch-track"></span></span></div></div>`;
}
/* Compact density: one-line rows for uniform on/off lists. The group heading carries the shared explanation. */
function compactToggle(key, title, name, invert=false, disabled=false) {
  const checked = invert ? !draft[key] : draft[key];
  return `<div class="setting-item compact"><div class="setting-row compact"><span class="row-icon">${icon(name)}</span><div class="row-copy"><div class="row-title"><label for="toggle-${key}"><strong>${title}</strong></label></div></div><span class="switch"><input id="toggle-${key}" type="checkbox" role="switch" aria-label="${title}" data-field="${key}" ${invert?'data-invert="true"':''} ${checked?'checked':''} ${disabled?'disabled':''}><span class="switch-track"></span></span></div></div>`;
}
const compactList = rows => `<div class="compact-list">${rows.join('')}</div>`;
/* Icon tiles: a multi-select panel for the values shown on a room card. Pressed tiles use the segmented-control tint. */
function valueTiles(items, label, disabled=false) {
  return `<div class="value-tiles" role="group" aria-label="${label}">${items.map(([key,title,name,full])=>`<label class="value-tile" ${full?`title="${full}"`:''}><input id="toggle-${key}" type="checkbox" data-field="${key}" aria-label="${full||title}" ${draft[key]?'checked':''} ${disabled?'disabled':''}><span class="tile-icon">${icon(name)}</span><span class="tile-label">${title}</span></label>`).join('')}</div>`;
}
function select(key, label, values, note='') {
  return `<div class="field"><label class="field-label" for="field-${key}">${label}</label><select class="select-input" id="field-${key}" data-field="${key}">${values.map(([value,text])=>`<option value="${value}" ${draft[key]===value?'selected':''}>${text}</option>`).join('')}</select>${note?hint(note):''}</div>`;
}
function segmented(key, values, label) {
  return `<div class="segmented" role="radiogroup" aria-label="${label}">${values.map(([value,title,decoration])=>`<label class="segment"><input type="radio" name="${key}" data-field="${key}" value="${value}" ${draft[key]===value?'checked':''}>${decoration || ''}<span>${title}</span></label>`).join('')}</div>`;
}
function colorField(key, opacityKey, label, reset='') {
  const color=key==='fillColor'?customFill().c:draft[key];
  const opacity=key==='fillColor'?customFill().a*100:draft[opacityKey];
  return `<div class="field-stack"><label class="field-label" for="field-${key}">${label}</label><div class="color-field"><input id="field-${key}" class="color-input" type="color" data-field="${key}" value="${color}" aria-label="${label}"><span class="hex-code" data-hex="${key}">${color.toUpperCase()}</span>${opacityKey?`<label class="color-opacity"><span>Opacity</span><span class="unit-inside"><input type="number" aria-label="${label} opacity" min="0" max="100" data-field="${opacityKey}" value="${opacity}" aria-describedby="error-${opacityKey}"><span>%</span></span></label>`:''}${reset?`<button class="text-link" data-action="${reset}" type="button">Reset</button>`:''}</div>${opacityKey?errorSlot(opacityKey):''}</div>`;
}
function generalSection() {
  const upload = draft.source === 'file' ? `<div class="upload-panel" id="upload-panel">${draft.planData ? `<div class="uploaded-file"><img src="${escape(draft.planData)}" alt="Selected floor-plan image"><div><strong>${escape(draft.planName)}</strong><small>Ready to use</small></div><button class="button" data-action="upload">${icon('upload')}Replace</button></div><div class="upload-buttons"><button class="text-link" data-action="gallery">Browse uploaded images</button></div>` : `<div class="upload-icon">${icon('upload')}</div><p>Drop your floor plan here</p><small>SVG, PNG, JPG or WebP · up to 2 MB in this preview</small><div class="upload-buttons"><button class="button" data-action="upload">${icon('upload')}Choose file</button><button class="button" data-action="gallery">${icon('folder')}Browse uploaded</button></div>`}<input hidden type="file" id="plan-upload" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"></div>${errorSlot('source')}` : '';
  const scale = `<div class="field">${fieldHeading('Grid cell size','scale','field-cellCm')}<div class="field-unit"><input id="field-cellCm" class="text-input" type="number" data-field="cellCm" value="${draft.cellCm}" min="0.1" max="1000" step="0.1" aria-describedby="grid-hint error-cellCm"><span>cm / cell</span></div>${errorSlot('cellCm')}<p class="field-hint" id="grid-hint">Scale of the plan.</p></div>`;
  return card('general','Basics',
    `<div class="field-grid general-grid">${textField('title','Space name',{attributes:'maxlength="80" autocomplete="off"',hint:'Shown in the space tabs.'})}${scale}</div>`+
    `${draft.cellCm!==saved.cellCm?info('The scale has changed. Calculated dimensions for this whole space will change when you save.',true):''}`+
    `<div class="subsection">${subsectionHeading('Floor plan','floorPlan')}<div class="source-options" role="radiogroup" aria-label="Floor-plan source"><label class="choice-card"><input type="radio" name="source" data-field="source" value="draw" ${draft.source==='draw'?'checked':''}><strong>Draw it myself</strong><small>Outline rooms in the plan editor.</small></label><label class="choice-card"><input type="radio" name="source" data-field="source" value="file" ${draft.source==='file'?'checked':''}><strong>Use a floor-plan image</strong><small>Add an image to draw over.</small></label></div>${upload}${draft.source==='draw'&&draft.planData?info('Your uploaded image is kept. Switch back to use it again.'):''}</div>`
  );
}
function appearanceSection() {
  const fillOptions = [['custom','Custom'],['lqi','Zigbee'],['light','Lights'],['temp','Temperature']];
  const fillDetail = draft.fillMode==='custom' ? colorField('fillColor','fillOpacity','Fill color','reset-fill') : draft.fillMode==='temp' ? `<div class="field-stack"><span class="field-label">Comfort range</span><div class="temperature-range"><label><span class="field-label">Minimum</span><span class="unit-inside"><input type="number" step="0.5" data-field="tempMin" value="${draft.tempMin}" aria-label="Minimum temperature"><span>°C</span></span></label><label><span class="field-label">Maximum</span><span class="unit-inside"><input type="number" step="0.5" data-field="tempMax" value="${draft.tempMax}" aria-label="Maximum temperature" aria-describedby="error-tempMax"><span>°C</span></span></label></div>${errorSlot('tempMax')}<div class="temp-legend"><span>Cold</span><span>Comfort</span><span>Hot</span></div>${hint('Below the minimum: cold. Within the range: comfort. Above the maximum: hot. Without a temperature reading, light-source glow can still add base shading.')}</div>` : hint(draft.fillMode==='lqi'?'Uses average room LQI: low at 40 or below, high at 180 or above. Colors and opacity follow the general palette.':'Uses separate colors for any light on, all lights off, and no light sources. Colors and opacity follow the general palette.');
  return card('appearance','Appearance',
    toggle('showBorders','Always show room borders','Show patterned outlines around the walls.','borders',false,false,'borders')+
    `<div class="field-stack">${fieldHeading('Zero-thickness walls','walls')}${segmented('zeroWallStyle',[['dashed','Dashed','<span class="line-sample dashed"></span>'],['solid','Solid','<span class="line-sample"></span>']],'Zero-thickness walls')}</div>`+
    colorField('roomColor','roomOpacity','Border & name color','reset-room')+
    `<div class="subsection">${subsectionHeading('Room fill','fill')}${segmented('fillMode',fillOptions,'Room fill')}${fillDetail}`+`</div>`+
    `<div class="subsection">${subsectionHeading('Visible layers','layers')}${compactList([compactToggle('hideDecor','Decorative layer','sofa',true),compactToggle('hideOpenings','Doors, windows & gates','door',true),compactToggle('showLqi','Zigbee signal next to devices','zigbee')])}`+`</div>`
  );
}
function cardsSection() {
  return card('cards','Room cards',
    toggle('showNames','Show room names','Display room names and their selected values.','type',false,false,'names')+
    `<div class="value-block"><span class="field-label" id="card-values-label">Values on the card</span>${valueTiles([['labelTemp','Temperature','temperature'],['labelHum','Humidity','humidity'],['labelLqi','Zigbee signal','zigbee','Average Zigbee signal'],['labelLight','Lights on / off','bulb']],'Values on the card',!draft.showNames)}${!draft.showNames?`<div class="disabled-note">${icon('eyeOff')}<span>Values are saved but hidden. <button data-action="show-cards">Show room names</button> to display them.</span></div>`:''}</div>`+
    `<div class="subsection"><div class="field-heading-inline"><div class="field-heading-with-help"><label class="field-label" for="card-font-range">Room-card font size</label>${helpButton('cardSize')}</div><button class="text-link" data-action="reset-font">Reset to 100%</button></div><div class="range-line"><input id="card-font-range" type="range" min="50" max="300" step="5" data-field="cardFontScale" aria-label="Room-card font size" value="${draft.cardFontScale}"><label class="unit-inside"><input type="number" min="50" max="300" step="5" data-field="cardFontScale" value="${draft.cardFontScale}" aria-label="Room-card font size percent" aria-describedby="error-cardFontScale"><span>%</span></label></div><div class="range-endpoints"><span>50%</span><span>300%</span></div>${errorSlot('cardFontScale')}${hint('Scales every room card in this space.')}`+`</div>`,
    ''
  );
}
function lightSection() {
  return card('light','Sun & light',
    `<div class="field-stack"><span class="field-label">Plan background</span>${segmented('bgMode',[['inherit','General settings'],['static','Static color'],['daynight','Follows the Sun']],'Plan background')}</div>`+
    (draft.bgMode==='static' ? colorField('bgColor',null,'Background color','reset-background') : '')+
    `<div class="subsection divided"><div class="inline-field radio-field" role="radiogroup" aria-labelledby="sun-rays-label"><span class="field-label" id="sun-rays-label">Sunlight through windows</span><div class="radio-row">${[['inherit','Use general settings'],['on','On'],['off','Off']].map(([v,t])=>`<label class="radio-option"><input type="radio" name="sunRays" id="sunRays-${v}" data-field="sunRays" value="${v}" ${draft.sunRays===v?'checked':''}><span>${t}</span></label>`).join('')}</div></div></div>`+
    `<div class="subsection"><div class="north-setting"><div class="north-controls">${fieldHeading('North on the plan','north','north-mode')}<select id="north-mode" class="select-input" data-action="north-mode"><option value="inherit" ${draft.northDeg===null?'selected':''}>Use general settings · 165°</option><option value="custom" ${draft.northDeg!==null?'selected':''}>Custom direction</option></select></div><div class="north-indicator" aria-hidden="true"><span>N</span><div class="north-dial">${northNeedle}</div></div></div>${draft.northDeg!==null?`<div class="field-stack"><label class="field-label" for="field-northDeg">North direction</label><div class="field-unit"><span class="unit-inside"><input id="field-northDeg" type="number" min="0" max="359" step="1" data-field="northDeg" value="${draft.northDeg}" aria-describedby="error-northDeg"><span>°</span></span><button class="text-link" data-action="inherit-north">Use general settings</button></div>${errorSlot('northDeg')}</div>`:''}`+`</div>`+
    `<div class="subsection">${toggle('glowEnabled','Light-source glow','Show a soft glow around lights that are on.','bulb',false,false,'light')}`+`</div>`
  );
}
function renderMain() {
  closeHelp();
  $('#settings-content').innerHTML = generalSection()+appearanceSection()+cardsSection()+lightSection();
}
function render() { renderMain(); updateChrome(); }

function updateChrome() {
  $('#space-crumb').textContent = draft.title.trim() || 'Untitled space';
  $('#save-settings').disabled = !dirty() || allErrors().length > 0;
  $('#save-status').classList.toggle('dirty',dirty());
  $('#save-status').textContent = dirty() ? 'Unsaved changes' : '';
  const errors=allErrors();
  $('#save-status').hidden = !dirty() && !errors.length;
  if(errors.length)$('#save-status').innerHTML=`<button class="text-link" data-action="review-errors">Review ${errors.length} ${errors.length===1?'field':'fields'}</button>`;
  errorFields.forEach(key => {
    const el = $(`#error-${key}`), message = errorFor(key);
    if(el){el.hidden = !message;el.textContent = message;}
    $$(`[data-field="${key}"]`,content).forEach(input => input.setAttribute('aria-invalid',String(!!message)));
  });
  $$('[data-hex]',content).forEach(el => {el.textContent=(el.dataset.hex==='fillColor'?customFill().c:draft[el.dataset.hex]).toUpperCase();});
  if($('#dial-arrow'))$('#dial-arrow').style.transform=`rotate(${draft.northDeg??165}deg)`;
}
function updateField(el) {
  const key=el.dataset.field;
  if(!key)return;
  let value=el.type==='checkbox'?(el.dataset.invert?!el.checked:el.checked):el.type==='number'||el.type==='range'?(el.value===''?'':Number(el.value)):el.value;
  if(['fillColor','fillOpacity'].includes(key)&&!draft.customFillSet){draft.fillColor=DEFAULT_CUSTOM_FILL.c;draft.fillOpacity=DEFAULT_CUSTOM_FILL.a*100;}
  draft[key]=value;
  if(['fillColor','fillOpacity'].includes(key))draft.customFillSet=true;
  if(key==='bgColor')draft.bgColorSet=true;
  if(key==='cardFontScale')$$('[data-field="cardFontScale"]',content).filter(x=>x!==el).forEach(x=>{x.value=value;});
  if(['source','fillMode','bgMode','showNames','zeroWallStyle'].includes(key)) {
    const scroll=currentScroller().scrollTop;
    renderMain();currentScroller().scrollTop=scroll;
    const replacement=$(`[data-field="${key}"]${el.type==='radio'?`:checked`:''}`,content);replacement?.focus({preventScroll:true});
  }
  updateChrome();
}
function renderPicker() {
  $('#space-picker').innerHTML=spaces.map(s=>`<button data-space="${escape(s.id)}" class="${s.id===activeId?'selected':''}">${escape(s.settings.title)}</button>`).join('');
}
function openSettings() {
  saved=clone(activeSpace().settings);draft=clone(saved);render();
  if(!dialog.open)dialog.show();
  currentScroller().scrollTop=0;
  $('#dialog-title').focus({preventScroll:true});
}
function closeSettings() {
  dialog.close();renderPicker();notifyDemoFormClosed('space-settings');
}
function showSub(title, content, actions) {
  lastSubTrigger=document.activeElement;
  subDialog.innerHTML=`<div class="sub-heading"><h2 id="sub-title">${title}</h2><button class="icon-button" aria-label="Close dialog" data-sub="close">${icon('close')}</button></div>${content}<div class="sub-actions">${actions}</div>`;
  subDialog.showModal();
}
function closeSub() {
  subDialog.close();lastSubTrigger?.focus({preventScroll:true});
  if(closeDecision){const resolve=closeDecision;closeDecision=undefined;resolve(false);}
}
function requestClose() {
  if(!dirty()){closeSettings();return Promise.resolve(true);}
  showSub('Discard your changes?',`<p>Your changes to <strong>${escape(saved.title)}</strong> haven’t been saved.</p>`,`<button class="button" data-sub="discard">Discard changes</button><button class="button primary" data-sub="close">Keep editing</button>`);
  $('[data-sub="close"].primary',subDialog).focus();
  return new Promise(resolve=>{closeDecision=resolve;});
}
function persist(nextSpaces) {
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(nextSpaces));return true;}
  catch {showToast('Could not save locally. Try a smaller image or enable browser storage.');return false;}
}
function saveSettings() {
  if(!dirty()||allErrors().length)return;
  const normalized={...clone(draft),title:draft.title.trim()};
  const next=spaces.map(s=>s.id===activeId?{...s,settings:normalized}:s);
  if(!persist(next))return;
  spaces=next;saved=clone(normalized);draft=clone(saved);closeSettings();
  showToast('Space settings saved in this browser.');
}
function openGallery() {
  showSub('Uploaded floor plans','<p>Choose an image for this space.</p><div class="gallery-grid"><button class="gallery-item" data-sub="choose-image" data-name="ground-floor.svg"><img src="assets/sample-plan.svg" alt="Ground-floor plan"><strong>ground-floor.svg</strong><small>Sample uploaded image · SVG</small></button><button class="gallery-item" data-sub="choose-image" data-name="first-floor.svg"><img src="assets/sample-plan.svg" alt="First-floor plan"><strong>first-floor.svg</strong><small>Sample uploaded image · SVG</small></button></div>','<button class="button" data-sub="close">Cancel</button>');
}
function readFile(file) {
  if(!file)return;
  if(!/\.(svg|png|jpe?g|webp)$/i.test(file.name)||!['image/svg+xml','image/png','image/jpeg','image/webp'].includes(file.type)){showToast('Choose an SVG, PNG, JPG or WebP image.');return;}
  if(file.size>2*1024*1024){showToast('Choose an image smaller than 2 MB for this preview.');return;}
  const reader=new FileReader();
  reader.onload=()=>{
    const image=new Image();
    image.onload=()=>{draft.planData=String(reader.result);draft.planName=file.name;renderMain();updateChrome();};
    image.onerror=()=>showToast('This image could not be opened. Choose another file.');
    image.src=String(reader.result);
  };
  reader.onerror=()=>showToast('Could not read the image. Please try again.');reader.readAsDataURL(file);
}
function openCopy() {
  let n=2;while(spaces.some(s=>s.settings.title===`${saved.title} (${n})`))n++;
  showSub('Copy space',`<p>Start a new space with the saved layout and display settings. Rooms and device placements are not copied.</p><label class="field-label" for="copy-name">New space name</label><input id="copy-name" class="text-input" maxlength="80" value="${escape(saved.title)} (${n})"><p class="field-hint">This preview creates a local settings copy. The production action also copies the plan geometry.</p>${dirty()?info('The copy will use saved settings. Your unsaved changes stay in the original draft.'):''}`,`<button class="button" data-sub="close">Cancel</button><button class="button primary" data-sub="confirm-copy">${icon('copy')}Copy space</button>`);
  $('#copy-name').focus();$('#copy-name').select();
}
function openDelete() {
  if(activeSpace().devices>0&&spaces.length>1){
    showSub('This space still has devices',`<p><strong>${activeSpace().devices} devices</strong> are placed in ${escape(saved.title)}. Move or remove them before deleting this space.</p>`,`<button class="button primary" data-sub="close">Got it</button>`);return;
  }
  showSub('Delete this space?',`<p>Delete <strong>${escape(saved.title)}</strong> from this design preview? This removes its locally saved settings.</p>`,`<button class="button" data-sub="close">Keep space</button><button class="button danger" data-sub="confirm-delete">Delete space</button>`);
  $('[data-sub="close"].button',subDialog).focus();
}
function handleAction(action) {
  if(action==='review-errors'){
    const first=allErrors()[0];if(!first)return;
    const field=$(`[data-field="${first[0]}"]`,content);field?.scrollIntoView({block:'center'});field?.focus({preventScroll:true});return;
  }
  if(action==='upload'){$('#plan-upload').click();return;}
  if(action==='gallery'){openGallery();return;}
  if(action==='reset-fill'){draft.fillColor=base.fillColor;draft.fillOpacity=base.fillOpacity;draft.customFillSet=false;}
  if(action==='reset-background'){draft.bgColor=base.bgColor;draft.bgColorSet=false;}
  if(action==='reset-room'){draft.roomColor=base.roomColor;draft.roomOpacity=base.roomOpacity;}
  if(action==='reset-font')draft.cardFontScale=100;
  if(action==='show-cards')draft.showNames=true;
  if(action==='inherit-north')draft.northDeg=null;
  const scroll=currentScroller().scrollTop;renderMain();updateChrome();currentScroller().scrollTop=scroll;
}
document.addEventListener('click',e=>{
  const target=e.target.closest('button');
  if(target?.dataset.space){activeId=target.dataset.space;renderPicker();}
  if(target?.dataset.action)handleAction(target.dataset.action);
});
$('#settings-content').addEventListener('input',e=>{
  if(['checkbox','radio','file'].includes(e.target.type)||e.target.tagName==='SELECT')return;
  updateField(e.target);
});
$('#settings-content').addEventListener('change',e=>{
  if(e.target.id==='plan-upload'){readFile(e.target.files[0]);return;}
  if(e.target.id==='north-mode'){draft.northDeg=e.target.value==='inherit'?null:165;renderMain();updateChrome();return;}
  if(['checkbox','radio'].includes(e.target.type)||e.target.tagName==='SELECT')updateField(e.target);
  if(e.target.dataset.field==='cellCm'){const scroll=currentScroller().scrollTop;renderMain();updateChrome();currentScroller().scrollTop=scroll;}
});
$('#settings-content').addEventListener('dragover',e=>{const zone=e.target.closest('#upload-panel');if(zone){e.preventDefault();zone.classList.add('dragging');}});
$('#settings-content').addEventListener('dragleave',e=>{e.target.closest('#upload-panel')?.classList.remove('dragging');});
$('#settings-content').addEventListener('drop',e=>{const zone=e.target.closest('#upload-panel');if(zone){e.preventDefault();zone.classList.remove('dragging');readFile(e.dataTransfer.files[0]);}});
$('#close-settings').addEventListener('click',requestClose);
$('#cancel-settings').addEventListener('click',requestClose);
$('#save-settings').addEventListener('click',saveSettings);
dialog.addEventListener('cancel',e=>{e.preventDefault();requestClose();});
dialog.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&helpOpen()){e.preventDefault();e.stopPropagation();closeHelp();return;}
  if(e.key==='Escape'&&!subDialog.open){e.preventDefault();e.stopPropagation();requestClose();}
});
$('#copy-space').addEventListener('click',openCopy);
$('#delete-space').addEventListener('click',openDelete);
subDialog.addEventListener('cancel',e=>{e.preventDefault();closeSub();});
subDialog.addEventListener('input',e=>{if(e.target.id==='copy-name')$('[data-sub="confirm-copy"]').disabled=!e.target.value.trim();});
subDialog.addEventListener('click',e=>{
  const button=e.target.closest('button[data-sub]');if(!button)return;
  const action=button.dataset.sub;
  if(action==='close'){closeSub();return;}
  if(action==='discard'){
    const resolve=closeDecision;closeDecision=undefined;
    draft=clone(saved);closeSub();closeSettings();resolve?.(true);return;
  }
  if(action==='choose-image'){draft.source='file';draft.planName=button.dataset.name;draft.planData='assets/sample-plan.svg';closeSub();renderMain();updateChrome();return;}
  if(action==='confirm-copy'){
    const title=$('#copy-name').value.trim();if(!title)return;
    const copy={id:crypto.randomUUID(),devices:0,settings:{...clone(saved),title}};
    const next=[...spaces,copy];if(!persist(next))return;
    spaces=next;closeSub();renderPicker();showToast(`“${title}” created. Open it from the space picker.`);return;
  }
  if(action==='confirm-delete'){
    let next=spaces.filter(s=>s.id!==activeId);
    if(!next.length)next=[{id:'new-space',devices:0,settings:{...clone(base),title:'New space'}}];
    if(!persist(next))return;
    spaces=next;activeId=next[0].id;closeSub();closeSettings();showToast('Space deleted from this preview.');
  }
});
window.addEventListener('beforeunload',e=>{if(dialog.open&&dirty()){e.preventDefault();e.returnValue='';}});
hydrateIcons();renderPicker();
registerDemoForm({id:'space-settings',title:'Space settings',description:'Layout, appearance, room cards and lighting for a space.',galleryControls:$('#space-examples'),open:openSettings,requestClose});
openDemoForm('space-settings');
