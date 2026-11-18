import {html,svg,render,nothing} from 'lit';
import {FURNITURE_GALLERY_CATALOG} from './furniture-gallery-catalog.generated';
import {GENERATED_FURNITURE_ART} from './furniture-plan-art.generated';
import {furnitureRenderTransform} from './furniture';
import {furnitureMesh,furnitureParts,furniturePlanPoint} from './iso-lab-furniture';
import {renderIsoLabFurniture} from './iso-lab-furniture-render';
import {FURNITURE_VOLUME_RUNTIME} from './furniture-volume-runtime';
import {isoFloorMatrix,projectPlanPoint,type PlanPoint,type IsoCamera} from './iso-projection';

const mount=document.querySelector<HTMLElement>('#gallery')!;
const state={search:'',group:'all',status:'all',size:'overview',yaw:35,elevation:40,angle:0,flipH:false,flipV:false,width:1,depth:1,opacity:1,color:'#627783',dark:false};
const groups:Record<string,string>={furniture:'Мебель',appliance:'Техника',sanitary:'Сантехника',other:'Прочее'};
type Symbol=(typeof FURNITURE_GALLERY_CATALOG)[number];
const known=Object.keys(GENERATED_FURNITURE_ART);
const symbols=[...FURNITURE_GALLERY_CATALOG].filter(s=>known.includes(s.id));
function fit(points:readonly PlanPoint[]){
 const x=points.map(p=>p[0]),y=points.map(p=>p[1]);
 const left=Math.min(...x),top=Math.min(...y),w=Math.max(...x)-left,h=Math.max(...y)-top,pad=Math.max(w,h)*.13+6;
 return `${left-pad} ${top-pad} ${w+2*pad} ${h+2*pad}`;
}
function views(s:Symbol){
 const art=GENERATED_FURNITURE_ART[s.id],shape={symbol:s.id,x:0,y:0,w:s.width_cm/1000*state.width,h:s.depth_cm/1000*state.depth,angle:state.angle,flip_h:state.flipH,flip_v:state.flipV};
 const camera:IsoCamera={rotDeg:state.yaw,tiltDeg:90-state.elevation,floorScaleY:Math.sin(state.elevation*Math.PI/180),xyScale:1,zScale:1,origin:[0,0]};
 const corners=([[0,0],[1,0],[1,1],[0,1]] as PlanPoint[]).map(p=>furniturePlanPoint(shape,p,1000,1000));
 const transform=furnitureRenderTransform(shape,1000,1000,art.viewW,art.viewH);
 const mesh=furnitureMesh(shape,1000,1000,camera),bounds=corners.map(p=>projectPlanPoint(p,0,camera));
 if(mesh)for(const part of mesh.parts)for(const match of (part.top+' '+part.side).matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g))bounds.push(projectPlanPoint([Number(match[1]),Number(match[2])],0,camera));
 const drawing=svg`<path d=${art.d} transform=${transform} fill="none" stroke=${state.color} stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" opacity=${state.opacity}></path>`;
 return html`<div class="pair">
   <figure><figcaption>Обычный план</figcaption><svg role="img" aria-label=${s.name_ru+' — обычный план'} viewBox=${fit(corners)}>${drawing}</svg></figure>
   <figure class="volume"><figcaption>${mesh?'Объём':'Плоский в проекции'}</figcaption><svg role="img" aria-label=${s.name_ru+' — проекция'} viewBox=${fit(bounds)}><g transform=${`matrix(${isoFloorMatrix(camera).join(' ')})`}>${mesh?renderIsoLabFurniture(mesh,'gallery-'+s.id,s.id,state.color,state.opacity,1):drawing}</g></svg></figure>
 </div>`;
}
function select(label:string,key:string,options:[string,string][]){
 return html`<label>${label}<select aria-label=${label} @change=${(e:Event)=>{const v=(e.target as HTMLSelectElement).value;state[key]=typeof state[key]==='number'?Number(v):v;draw();}}>${options.map(([v,t])=>html`<option value=${v} .selected=${String(state[key])===v}>${t}</option>`)}</select></label>`;
}
function card(s:Symbol){
 const parts=furnitureParts(s.id);
 return html`<article class="model" data-model=${s.id} data-volume=${parts?'ready':'flat'}>
  <header><div><h2>${s.name_ru}</h2><span class="id">${s.id}</span></div><span class=${parts?'badge ready':'badge'}>${parts?'Объём из SVG':'Пока плоская'}</span></header>
  ${views(s)}
  <footer><span>${Math.round(s.width_cm*state.width)} × ${Math.round(s.depth_cm*state.depth)} см</span><span>${parts?'Высота '+Number((Math.max(...parts.map(p=>p.top))-Math.min(...parts.map(p=>p.bottom))).toFixed(1))+' см'+(Math.min(...parts.map(p=>p.bottom))>0?' · от пола '+Math.min(...parts.map(p=>p.bottom))+' см':''):'Разметка объёма впереди'}</span></footer>
  ${parts?html`<details><summary>Детали и высоты <span>см</span></summary><table><thead><tr><th>Деталь</th><th>Низ</th><th>Верх</th></tr></thead><tbody>${parts.map(p=>html`<tr><td>${p.name}</td><td>${p.bottom}</td><td>${p.top}</td></tr>`)}</tbody></table><a href=${'/volume-source/'+s.id+'.svg'} target="_blank" rel="noopener">Открыть SVG с высотами ↗</a></details>`:nothing}
 </article>`;
}
function reset(){Object.assign(state,{search:'',group:'all',status:'all',size:'overview',yaw:35,elevation:40,angle:0,flipH:false,flipV:false,width:1,depth:1,opacity:1,color:'#627783',dark:false});draw();}
function draw(){
 document.documentElement.dataset.theme=state.dark?'dark':'light';
 const ready=symbols.filter(s=>furnitureParts(s.id)).length;
 const filtered=symbols.filter(s=>(state.group==='all'||s.group===state.group)&&(state.status==='all'||(!!furnitureParts(s.id)===(state.status==='ready')))&&`${s.id} ${s.name_ru} ${s.name_en}`.toLowerCase().includes(state.search.toLowerCase()))
  .sort((a,b)=>Number(!!furnitureParts(b.id))-Number(!!furnitureParts(a.id))||a.name_ru.localeCompare(b.name_ru,'ru'));
 render(html`<div class="topbar"><a class="brand" href="/">HOUSE PLAN <span>UI LAB</span></a><nav><a href="/" target="_blank">Новый стенд ↗</a><a href="http://localhost:8891/" target="_blank">Эталон · 8891 ↗</a><button @click=${()=>{state.dark=!state.dark;draw();}}>${state.dark?'Светлая тема':'Тёмная тема'}</button></nav></div>
  <main><section class="intro"><div><p class="eyebrow">Библиотека · исследование 2.5D</p><h1>Мебель в объёме</h1><p>Один предмет, два представления. Сравните форму, высоты и поведение при повороте.</p></div><div class="stats"><div><strong>${symbols.length}</strong><span>в библиотеке</span></div><div class="accent"><strong>${ready}</strong><span>с объёмом</span></div><div><strong>${symbols.length-ready}</strong><span>ждут разметки</span></div></div></section>
  <section class="controls" aria-label="Настройки галереи">
   <div class="filters"><label class="search">Поиск<input type="search" aria-label="Поиск модели" placeholder="Название или ID модели" .value=${state.search} @input=${(e:Event)=>{state.search=(e.target as HTMLInputElement).value;draw();}}></label>${select('Категория','group',[['all','Все категории'],...Object.entries(groups)])}${select('Размер карточек','size',[['overview','Обзор'],['large','Крупно'],['detail','Подробно']])}${select('Готовность','status',[['all','Вся библиотека'],['ready','Объём из SVG'],['flat','Пока плоская']])}</div>
   <div class="settings">${select('Камера','yaw',[35,125,215,305].map(v=>[String(v),v+'°']))}${select('Высота взгляда','elevation',[30,35,40].map(v=>[String(v),v+'°']))}${select('Поворот предмета','angle',[0,35,90,180,270].map(v=>[String(v),v+'°']))}${select('Ширина','width',[['0.7','70%'],['1','100%'],['1.4','140%']])}${select('Глубина','depth',[['0.7','70%'],['1','100%'],['1.4','140%']])}${select('Непрозрачность','opacity',[['0.35','35%'],['0.7','70%'],['1','100%']])}
    <label>Цвет<input aria-label="Цвет мебели" type="color" .value=${state.color} @input=${(e:Event)=>{state.color=(e.target as HTMLInputElement).value;draw();}}></label>
    <button aria-pressed=${String(state.flipH)} @click=${()=>{state.flipH=!state.flipH;draw();}}>Зеркало X</button><button aria-pressed=${String(state.flipV)} @click=${()=>{state.flipV=!state.flipV;draw();}}>Зеркало Y</button><button class="reset" @click=${reset}>Сбросить</button>
   </div></section>
  <div class="section-label"><span aria-live="polite">Показано ${filtered.length} из ${symbols.length}</span><span>${FURNITURE_VOLUME_RUNTIME.state()==='fallback'?'Объёмные модели не загрузились. Показан обычный рисунок; обновите страницу.':`Объём из SVG: ${ready} из ${symbols.length}. Исходный рисунок плана сохранён.`}</span></div>
  <section class="grid" data-size=${state.size} aria-label="Каталог мебели">${filtered.length?filtered.map(card):html`<p class="empty">Модели не найдены. Измените поиск или фильтры.</p>`}</section>
  <p class="footnote">Эта галерея не меняет расстановку и настройки вашего плана. Эталонный стенд работает отдельно.</p></main>`,mount);
}
void FURNITURE_VOLUME_RUNTIME.ensure().then(draw).catch(error=>{mount.textContent='Не удалось загрузить галерею: '+String(error);});
