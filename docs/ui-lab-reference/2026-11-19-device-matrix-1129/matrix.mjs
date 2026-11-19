import {measureMatrix,centerMatrix} from './layout.mjs';
const matrix=await (await fetch('/matrix.json')).json();
for(let i=0;i<200&&!window.__lab?.card?._renderDevices?.length;i++)await new Promise(r=>setTimeout(r,100));
const {card,mock,panel}=window.__lab,root=card.shadowRoot;
const style=document.createElement('style');
style.textContent=`#matrix-tools{position:fixed;z-index:10001;bottom:10px;left:82px;right:12px;display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--card-background-color,#202730);color:var(--primary-text-color,#e6edf6);border:1px solid #65758c;border-radius:8px;box-shadow:0 4px 18px #0006;font:13px system-ui;flex-wrap:wrap}#matrix-tools button,#matrix-tools select{font:inherit;color:inherit;background:transparent;border:1px solid #637288;border-radius:5px;padding:6px 10px;cursor:pointer}#matrix-tools button:hover{background:#64748b40}#matrix-tools select{max-width:270px;background:#263242;color:#fff}#matrix-tools a{color:#8dc5ff}#matrix-tools small{opacity:.75}#matrix-tools button[aria-pressed=true]{background:#3c82c54d;border-color:#8dc5ff}`;
document.head.append(style);
const bar=document.createElement('div');bar.id='matrix-tools';
bar.innerHTML='<strong>#1129 · 42 × 8</strong><button data-mx="prev" aria-label="Предыдущие строки">←</button><select aria-label="Строка матрицы"></select><button data-mx="next" aria-label="Следующие строки">→</button><button data-mx="all">Вся матрица</button><button data-mx="replay">Повторить событие</button><button data-mx="auto" aria-pressed="true">Автоповтор</button><button data-mx="pins" aria-pressed="true">Фиксация UI</button><button data-mx="editor">Редактор</button><button data-mx="theme">Светлая тема</button><a href="/MATRIX.md" target="_blank">Таблица</a><small>Синтетика</small>';
bar.innerHTML=bar.innerHTML.replace('<a href="/MATRIX.md"','<button data-mx="motion" aria-pressed="false">Меньше движения</button><button data-mx="live" aria-pressed="true">Live states</button><a href="/MATRIX.md"');
bar.querySelector('small').textContent += ' · dev '+matrix.base.slice(0,9);document.body.append(bar);
const select=bar.querySelector('select');matrix.rows.forEach(row=>{const o=document.createElement('option');o.value=String(Number(row.id)-1);o.textContent=row.id+' · '+row.title;select.append(o);});
let rowIndex=0,auto=true,pins=true,pending=false,grouped=false;
const byId=new Map(matrix.cells.map(c=>[c.id,c]));
// Selector aliases only: all declarations come from the currently loaded product.
// This pins mutually exclusive interaction styles for an atlas, not new product semantics.
const aliases=[],reduced=[];
function selectors(text){let depth=0,start=0;const out=[];for(let i=0;i<text.length;i++){if(text[i]==='(')depth++;if(text[i]===')')depth--;if(text[i]===','&&!depth){out.push(text.slice(start,i));start=i+1;}}out.push(text.slice(start));return out;}
function readRules(rules){for(const rule of rules){
 if(rule.cssRules&&!rule.selectorText){if(rule.conditionText?.includes('prefers-reduced-motion')){reduced.push([...rule.cssRules].map(r=>r.cssText).join('\n'));continue;}readRules(rule.cssRules);continue;}
 if(!rule.selectorText)continue;
 for(const selector of selectors(rule.selectorText)){
  if(selector.includes('.stage.mode-devices .dev.sel'))aliases.push(selector.replaceAll('.stage.mode-devices .dev.sel','.stage.mode-view .dev[data-matrix-selected]')+'{'+rule.style.cssText+'}');
  if(selector.includes('.dev:focus-visible'))aliases.push(selector.replaceAll('.dev:focus-visible','.dev[data-matrix-focus]')+'{'+rule.style.cssText+'}');
  if(selector.includes('[data-hp-device-hover]'))aliases.push(selector.replaceAll(':host([data-pointer-hover])',':host').replaceAll('[data-hp-device-hover]','[data-matrix-hover]')+'{'+rule.style.cssText+'}');
 }
}}
for(const sheet of [...root.adoptedStyleSheets,...[...root.querySelectorAll('style')].map(s=>s.sheet).filter(Boolean)])try{readRules(sheet.cssRules);}catch{}
const pinStyle=document.createElement('style');pinStyle.textContent=aliases.join('\n');root.append(pinStyle);
const motionStyle=document.createElement('style');root.append(motionStyle);
function mark(){
 pending=false;
 for(const el of root.querySelectorAll('.dev[data-hp="device"]')){
  const cell=byId.get(el.dataset.id);if(!cell)continue;
  if(el.dataset.matrixCase!==cell.code)el.dataset.matrixCase=cell.code;
  for(const [name,on] of [['data-matrix-selected',pins&&cell.key==='selected'],['data-matrix-focus',pins&&cell.key==='focus'],['data-matrix-hover',pins&&cell.key.startsWith('hover')]])if(el.hasAttribute(name)!==on)el.toggleAttribute(name,on);
 }
}
const observer=new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(mark);}});
observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['data-hp-device-hover']});
mark();
async function focusRows(index){
 rowIndex=Math.max(0,Math.min(matrix.rows.length-1,index));select.value=String(rowIndex);
 if(card._space!==matrix.space)card._pickSpace(matrix.space);
 await card.updateComplete;
 const stage=root.querySelector('.stage'),rect=stage.getBoundingClientRect();
 const w=matrix.grid.width+100,h=w*rect.height/rect.width;
 card._cancelCameraTransition?.(false);
 card._view={x:-15,y:Math.max(0,matrix.grid.top+rowIndex*matrix.grid.row-20),w,h};
 card._zoom=card._baseVb().w/w;
 card.requestUpdate();
 await card.updateComplete;
}
function updateStates(changes){
 const states={...mock.hass.states},now=new Date().toISOString();
 for(const [id,value] of changes){if(!states[id])continue;states[id]={...states[id],state:value,last_changed:now,last_updated:now,attributes:{...states[id].attributes,...(id.startsWith('cover.')?{current_position:value==='closed'?0:100}:{})}};}
 mock.hass.states=states;panel.hass={...mock.hass};
}
function replay(){
 updateStates(matrix.events.map(e=>[e.id,e.kind==='event'?'off':'closed']));
 setTimeout(()=>updateStates(matrix.events.map(e=>[e.id,e.kind==='event'?'on':'open'])),180);
}
bar.querySelector('[data-mx=prev]').onclick=()=>focusRows(rowIndex-4);
bar.querySelector('[data-mx=next]').onclick=()=>focusRows(rowIndex+4);
select.onchange=()=>focusRows(Number(select.value));
bar.querySelector('[data-mx=all]').onclick=()=>{card._pickSpace(matrix.space);card._fitAll();};
bar.querySelector('[data-mx=replay]').onclick=replay;
bar.querySelector('[data-mx=auto]').onclick=e=>{auto=!auto;e.currentTarget.setAttribute('aria-pressed',String(auto));};
bar.querySelector('[data-mx=pins]').onclick=e=>{pins=!pins;e.currentTarget.setAttribute('aria-pressed',String(pins));if(!pins)for(const el of root.querySelectorAll('[data-hp-device-hover]'))if(byId.get(el.dataset.id)?.key.startsWith('hover'))el.removeAttribute('data-hp-device-hover');mark();};
bar.querySelector('[data-mx=editor]').onclick=()=>{card._setMode(card._mode==='devices'?'view':'devices');};
bar.querySelector('[data-mx=motion]').onclick=e=>{const on=!card._reducedMotion;motionStyle.textContent=on?reduced.join('\n'):'';card._onMotionChange({matches:on});updateStates([]);e.currentTarget.setAttribute('aria-pressed',String(on));};
bar.querySelector('[data-mx=live]').onclick=e=>{const on=card._config.live_states===false;card.setConfig({...card._config,live_states:on});e.currentTarget.setAttribute('aria-pressed',String(on));};
bar.querySelector('[data-mx=theme]').onclick=e=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';mock.setDarkMode(dark);e.currentTarget.textContent=dark?'Светлая тема':'Тёмная тема';};
setInterval(()=>{if(auto&&card._space===matrix.space&&card._mode==='view'&&!document.hidden)replay();},6000);
// Use measured native contact shapes, not guessed widths, to make G/H actual groups.
async function alignGroups(){
 const scene=card._deviceContacts?.scene;if(!scene?.shapes?.size)return false;
 const layout={...card._layout};let count=0;
 for(const cell of matrix.cells.filter(c=>c.neighbor)){
  const a=scene.shapes.get(cell.id),b=scene.shapes.get(cell.neighbor);if(!a||!b)continue;
  const depth=Math.min(a.marker.diameter,b.marker.diameter)*13/80-(a.marker.diameter+b.marker.diameter)*.009375;
  layout[cell.neighbor]={...layout[cell.neighbor],x:(a.marker.x+a.box.left+depth-b.box.right)/1000,y:a.marker.y/1000};count++;
 }
 if(!count)return false;card._layout=layout;card._deviceContacts?.clear?.();card.requestUpdate();grouped=true;return count;
}
window.__matrix1129={matrix,focusRows,replay,alignGroups,byId,get pinned(){return pins;},get groupsAligned(){return grouped;},report(){return matrix.cells.map(cell=>{const el=root.querySelector('.dev[data-id="'+cell.id+'"]'),d=card._renderDevices?.find(d=>d.id===cell.id),p=d?card._devicePresentation(d):null;return {code:cell.code,key:cell.key,id:cell.id,visible:!!el,classes:el?.className,pulse:p?.pulse,visual:p?.visual,own:p?.ownAvailability,badge:p?.valueBadge?.text,value:p?.valueText,battery:p?.battery?.state,lqi:p?.lqiText,maintenance:p?.maintenance,attention:!!p?.attention,group:el?.dataset.hpDeviceComponent};});}};
Object.assign(window.__matrix1129,{measureLayout:()=>measureMatrix(card,matrix),centerLayout:()=>centerMatrix(card,matrix)});
// Stable screenshot phase; only explicitly requested by a capture tool.
window.__matrix1129.captureFrame=async({row=0,pulseMs=600}={})=>{
 auto=false;bar.querySelector('[data-mx=auto]').setAttribute('aria-pressed','false');
 await focusRows(row);replay();await new Promise(resolve=>setTimeout(resolve,300));
 await card.updateComplete;
 for(const node of root.querySelectorAll('.device-pulse i'))for(const animation of node.getAnimations()){
  animation.pause();animation.currentTime=pulseMs;
 }
 return {row,pulseMs,base:matrix.base,revision:matrix.revision,view:{...card._view}};
};
await document.fonts.ready;
await new Promise(r=>setTimeout(r,1600));
card._setShowHidden(true);await focusRows(0);
if(matrix.layoutCalibrated)grouped=true;
else for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,200));if(await alignGroups())break;}
await focusRows(0);setTimeout(replay,800);
